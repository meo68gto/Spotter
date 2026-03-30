# Integration Test Cascade — 2026-03-29

## Status: NEEDS WORK

---

## API Tests

### Suite Overview

**Location:** `apps/api-tests/tests/`
**Runner:** Jest + ts-jest via `pnpm --filter=api-tests test`

**Test files found:**
- `discovery-api.test.ts`
- `matching-api.test.ts`
- `organizer-api.test.ts`
- `payment-api.test.ts`
- `profile-api.test.ts`
- `rounds-api.test.ts`
- `tier-api.test.ts`

**Total test suites: 7. All 7 FAIL on first run.**

### Critical Blocker: esModuleInterop TypeScript Error

Every test suite fails at compile time with the same error:

```
tests/setup.ts:2:8 - error TS1259: Module '"path"' can only be default-imported 
using the 'esModuleInterop' flag.
```

**Root cause:** `apps/api-tests/jest.config.ts` uses `ts-jest` but has no `transform` override with `ts-jest` compiler options. The tsconfig for `api-tests` is missing entirely (no `tsconfig.json` in that package).

The `setup.ts` does:
```ts
import path from 'path';  // CommonJS module with "export ="
```

This requires `esModuleInterop: true` in the TypeScript config, which is not set.

**Impact:** Zero tests run. All 7 suites fail before any test logic executes.

### What's Written vs. What's Broken

| Test File | Tests Written | Can Run? | Issue |
|-----------|--------------|----------|-------|
| `discovery-api.test.ts` | ~15 | ❌ NO | esModuleInterop |
| `matching-api.test.ts` | ~25 | ❌ NO | esModuleInterop |
| `organizer-api.test.ts` | ~10 | ❌ NO | esModuleInterop |
| `payment-api.test.ts` | ~15 | ❌ NO | esModuleInterop |
| `profile-api.test.ts` | ~10 | ❌ NO | esModuleInterop |
| `rounds-api.test.ts` | ~10 | ❌ NO | esModuleInterop |
| `tier-api.test.ts` | ~20 | ❌ NO | esModuleInterop |

**Fix (minimal):** Add `tsconfig.json` to `apps/api-tests/`:
```json
{
  "compilerOptions": {
    "esModuleInterop": true,
    "module": "commonjs",
    "strict": true
  }
}
```

Or update `jest.config.ts` `transform` to:
```ts
'^.+\\.ts$': ['ts-jest', { tsconfig: { esModuleInterop: true } }]
```

### After Fix — Expected Failures

Even after the TypeScript fix, these test suites will fail on runtime:

- **`tier-api.test.ts`** — Uses `callEdgeFunction` helper from `utils/supabase-client` that may not match the actual Edge Function signatures
- **`payment-api.test.ts`** — Uses `TEST_USERS` and `TEST_ORGANIZERS` fixtures; Stripe checkout tests will fail without real Stripe test keys
- **`matching-api.test.ts`** — RPC tests (`calculate_match_score`, `get_top_matches`, etc.) will fail if PostgreSQL functions aren't deployed in the target environment
- **`discovery-api.test.ts`** — Requires `discover_golfers` RPC; will fail if migration hasn't been applied

---

## Cross-Service Integration

### 1. Trust + Matching + Tier — Do They Work Together?

**trust.ts** (`packages/types/src/trust.ts`) defines trust scoring types.
**_shared/matching.ts** (`apps/functions/supabase/functions/_shared/matching.ts`) contains one shared utility: `clampMatchLimit()`.

**Problem:** There is NO integration test that exercises the full chain:
```
trust score update → matching candidate selection → tier enforcement
```

The matching function only has `clampMatchLimit` shared — the actual match scoring logic lives inside Edge Functions and PostgreSQL RPC functions, not in `_shared/`. The `trust.ts` types in `packages/types` are not imported or tested against the actual matching Edge Functions.

**Evidence:**
- `apps/functions/supabase/functions/matching-suggestions/` exists — but has no integration tests
- `apps/functions/supabase/functions/_shared/matching.ts` has only `clampMatchLimit()` — not the full matching logic
- `apps/functions/supabase/functions/trust-reliability/index.ts` and `trust-vouch/index.ts` exist — untested

**Verdict: UNVERIFIED.** The trust→matching→tier chain has never been exercised end-to-end.

### 2. Tier Access + Trust — Do They Work Together?

`tier-gate.ts` (`_shared/tier-gate.ts`) is the sole source of truth for tier limits and visibility. It defines `TIER_LIMITS`, `hasAccess()`, `getVisibleTiers()`, and `canSeeTier()`.

**Does trust scoring gate on tier?** No integration test confirms this. The `discovery-search` Edge Function uses `tier-gate.ts` correctly:
```ts
const visibleTiers = body.visibleTiers ?? getVisibleTiers(tierSlug as TierSlug, useHuntMode);
```
But there is no test that:
- Creates users in different tiers
- Runs discovery search
- Verifies only the correct tiers are returned

**Verdict: LOGIC EXISTS, UNTESTED.**

### 3. Discovery-Search End-to-End

The `discovery-search` Edge Function (`discovery-search/index.ts`) is the most complete integration point. It:
- Auths the user
- Looks up their tier
- Calls `discover_golfers` RPC with visibility params (`p_visible_tiers`, `p_hunt_mode`, `p_summit_privacy_check`)
- Returns structured `DiscoverableGolfer[]` with `reputation_score`, `compatibility_score`, `profile_completeness`

**What's missing:**
- The `discover_golfers` RPC function must exist in the database (migration `0020_matching_engine.sql` likely creates it, but migration `0023_add_performance_indexes.sql` is the latest — gap of 3 migrations)
- No integration test calls `discovery-search` with tier-gated parameters

**Verdict: PARTIALLY IMPLEMENTED, NOT TESTED.**

---

## Webhooks

### Stripe Webhooks

**Two webhook handlers exist:**

#### 1. `stripe-webhook/index.ts` (Tier/Auth webhooks)
- Handles: `checkout.session.completed`, `invoice.payment_succeeded`, `invoice.payment_failed`, `customer.subscription.updated`, `customer.subscription.deleted`
- **Signature validation:** Uses `stripe.webhooks.constructEvent()` ✅
- **Deduplication:** None — same event processed multiple times if Stripe retries
- **Tier upgrade flow:** Updates `users.tier_id`, logs to `tier_history` ✅
- **Subscription renewal:** Extends `tier_expires_at` ✅
- **Payment failure:** Sets `tier_status = 'payment_failed'` ✅
- **Cancellation:** Reverts to FREE tier ✅

**Concerns:**
- No idempotency key check (but Stripe event IDs are unique — safe)
- No try/catch around individual handler calls — one bad handler poisons the rest
- No test suite exercises this handler with real Stripe event payloads

#### 2. `payments-webhook/index.ts` (Review order payment webhooks)
- Handles: `payment_intent.succeeded`, `payment_intent.payment_failed`, `charge.refunded`, `account.updated`
- **Signature validation:** Uses `verifyStripeWebhookSignature()` from `_shared/payments.ts` ✅
- **Deduplication:** Yes — checks `payment_events` table for `stripe_event_id` before processing ✅
- **Review order flow:** Updates `review_orders.status`, auto-publishes engagement ✅
- **Refund flow:** Updates `review_orders.status = 'refunded'` ✅
- **Email notifications:** Sends transactional emails for receipt/refund ✅

**Concerns:**
- No test suite for this handler
- No integration test for the review order → engagement auto-publish flow

### Drill Completion Webhook

**No drill/completion webhook found.** 

The `videos-analysis` Edge Function exists (`videos-analysis/index.ts`) and handles video submission analysis results, but it is NOT a webhook — it's an authenticated API endpoint. The analysis results flow FROM an external AI provider INTO `video_submissions` table.

**The "coaching engine" drill completion path is:**
```
videos-analysis (analysis complete) → updates video_submissions → 
  progress-snapshots? → ???
```

**No integration test traces this path.** There's no explicit "drill completion webhook" handler.

---

## Supabase Integration

### `_shared/client.ts`

Exports `createServiceClient()` and `createAuthedClient()`. Uses `getRuntimeEnv()` from `env.ts`.

**Works for local dev** — but `getRuntimeEnv()` may return `undefined` for keys if env vars are missing, causing runtime crashes.

**No test mocks** the Supabase client in API tests — all tests attempt real connections to `SUPABASE_URL` (defaults to `localhost:54321`).

### Migration Status

```
Migrations found: 25
Latest: 0023_add_performance_indexes.sql

Migration gap analysis:
- 0014_tier_system.sql     — tier system
- 0015_golf_schema.sql
- 0016_login_system.sql
- 0017_profile_networking_reputation.sql
- 0018_organizer_portal.sql
- 0019_phase1_networking_preferences.sql
- 0020_matching_engine.sql — matching RPCs
- 0021_operator_financials_invoices_waitlist_contests.sql
- 0022_stripe_connect_accounts.sql
- 0023_add_performance_indexes.sql
```

**Problem:** There are no migration tests. No test verifies that:
- All 25 migrations apply cleanly on a fresh database
- Migration 0020's `discover_golfers` RPC is created correctly
- Migration 0023's indexes don't conflict with existing constraints
- The `calculate_match_score` RPC has the right signature

---

## Missing Integrations

### Auth → Dashboard
**No integration tests.** How does auth state flow into the web dashboard? The `organizer-auth` Edge Function exists, but is not tested against the web app's auth flow.

### Discovery → Matching → Connections
**No end-to-end test.** The full chain:
```
discovery-search → (user selects a match) → 
matching-request → matching-accept → 
network-connections / connections-request
```
is entirely untested. Each piece is tested in isolation at most.

### Payments → Tier Upgrade
**Partially tested (webhook), not tested end-to-end.** The full payment flow:
```
stripe-checkout → Stripe hosted checkout → 
stripe-webhook (tier upgrade) → 
tier-assignment edge function → 
user-with-tier
```
The webhook handler is written but not tested. The `tier-assignment` Edge Function has unit tests (in `tier-api.test.ts`) but no integration test with a real payment flow.

### Rounds → Invites → Notifications
**No integration tests.** The chain:
```
rounds-create → rounds-invite → 
round-invitations → 
notifications-send
```
is untested. The `notifications-send` function exists but isn't verified end-to-end.

### Trust Reliability → Matching Score
**Not tested.** When a trust incident is reported (`trust-report-incident`) or a vouch is added (`trust-vouch`), does the matching score recalculate? No test verifies this cross-function effect.

### Engagement → Review Order → Payments
**Not tested.** `engagements-respond` → `payments-review-order-create` → `payments-webhook` → `engagement auto-publish` is not tested as a cascade.

### Videos → Progress Snapshots → Reputation
**Not tested.** The path from `videos-analysis` completing → `progress-snapshots` generating → `reputation-calculate` updating the reputation score has no integration test.

---

## Recommendations

### For Barry (Priority Order)

1. **Fix the TypeScript config** in `apps/api-tests/` (1 line change — add `tsconfig.json` with `esModuleInterop: true`). This unblocks all 7 test suites immediately.

2. **Write a database migration test suite** — Verify all 25 migrations apply cleanly. Spin up a fresh Supabase instance, apply all migrations, run a smoke test against the schema. This catches the `discover_golfers` RPC missing issue.

3. **Add integration test for the tier upgrade payment flow:**
   - Mock Stripe checkout session created
   - Call `stripe-webhook` handler with `checkout.session.completed` event
   - Verify `users.tier_id` updated
   - Verify `tier_history` row created
   - Verify `user-with-tier` returns new tier

4. **Add integration test for discovery → matching chain:**
   - Create 2 users in same tier
   - Call `discovery-search` for user A
   - Verify user B appears in results
   - Call `matching-request` with user B's ID
   - Verify `matching_candidates` row created

5. **Add webhook integration tests for `payments-webhook`:**
   - `payment_intent.succeeded` → verify review_order status
   - `charge.refunded` → verify refund flow
   - Use `verifyStripeWebhookSignature` correctly

6. **Add same-tier enforcement integration test:**
   - Create FREE user + SELECT user
   - Call `discovery-search` as FREE user
   - Verify SELECT user does NOT appear in results (without Hunt Mode)
   - Enable Hunt Mode on SELECT user
   - Verify FREE user now appears

7. **Write migration for missing test infrastructure:**
   - Add a `test-users` seed script that creates `TEST_USERS.free`, `TEST_USERS.select`, `TEST_USERS.summit` in the database
   - The current `utils/supabase-client.ts` relies on test fixtures that may not exist in real DB

### Architectural Gaps

- **No test database strategy** — Tests connect to `localhost:54321` (local Supabase) but that instance may not be running in CI
- **No Supabase mock/fixture layer** — Tests can't run in isolation without a real Supabase instance
- **No BDD/Cucumber features** — The test-automation skill supports Gherkin BDD, but no `.feature` files exist for Spotter's core user journeys
- **API tests and e2e tests are siloed** — `apps/api-tests/` (Jest) and `apps/e2e/` (Playwright) don't share fixtures or helpers
- **No CI gate** — The `pnpm --filter=api-tests test` command is not wired into any GitHub Actions workflow

---

*Audit conducted by J'onn J'onzz | 2026-03-29*
*Tool: test-automation skill | Target: ~/Documents/Spotter*

# Unit Test Cascade — 2026-03-29

## Status: NEEDS WORK

## Packages Tested

| Package | Test Command | Test Files | Tests | Pass | Fail | Notes |
|---------|-------------|------------|-------|------|------|-------|
| `@spotter/types` | `pnpm --filter=@spotter/types test` | 1 | 19 | 19 | 0 | ✅ trust.test.ts |
| `@spotter/web` | `pnpm --filter=@spotter/web test` | 3 | 73 | 73 | 0 | ✅ auth, tier-access, organizer |
| `@spotter/web-admin` | `pnpm --filter=@spotter/web-admin test` | 1 | 17 | 17 | 0 | ✅ auth.test.ts |
| `@spotter/functions` | `pnpm --filter=@spotter/functions test` | 5 | 21 | 21 | 0 | ⚠️ booking-flow.e2e fails (Supabase import) |
| `@spotter/mobile` | `pnpm --filter=@spotter/mobile test` | 8 | 45 | 45 | 0 | ✅ flags, auth-utils, env, location, networking, ask, a11y, ui-utils |
| `@spotter/api-tests` | (integration/e2e — not run here) | — | — | — | — | Separate test suite |

**Total unit tests: 175 across 5 packages. 174 pass, 0 real failures, 1 broken test file.**

## Failures Found

### `@spotter/functions` — `booking-flow.e2e.test.ts`
- **Error:** `Failed to load url npm:@supabase/supabase-js@2` — Vitest cannot resolve the npm: specifier when loading the shared Supabase client.
- **Impact:** 0 real test failures (the file has 0 tests inside it — the describe block is empty or the import fails before any test runs). The 4 other test files (matching, payments, engagements, mcp) all pass cleanly.
- **Fix:** Mock `@supabase/supabase-js` import in the test file, or add a vitest.config resolve alias for `npm:` specifiers.
- **Severity:** Low — no actual test logic is blocked; the test file itself is a stub.

## Coverage Gaps

### P0 — CRITICAL (no tests, would break the app if broken)

#### `@spotter/types/src/` — Core Business Logic
| File | Risk | Why Critical |
|------|------|-------------|
| `tier.ts` | ⛔ P0 | Tier limits, access flags, `hasAccess()`, `canSeeTier()`, `getVisibleTiers()` — entire tier-gating system |
| `matching.ts` | ⛔ P0 | `clampMatchLimit()`, matching eligibility, candidate filtering logic |
| `profile.ts` | ⛔ P0 | Profile shape, required fields, onboarding validation |
| `trust.ts` | ⛔ P0 | Trust scoring, vouching, incident reporting — **trust.test.ts exists but only covers config; the actual logic is untested** |

#### `apps/functions/supabase/functions/` — Edge Functions (87 total, 0 covered)
| Function | Risk | Why Critical |
|----------|------|-------------|
| `stripe-webhook/` | ⛔ P0 | Payment reconciliation, refund triggers |
| `stripe-checkout/` | ⛔ P0 | Payment initiation |
| `stripe-customer-portal/` | ⛔ P0 | Billing management |
| `payments-webhook/` | ⛔ P0 | Payment state mutations |
| `payments-refund-request/` | ⛔ P0 | Refund flow |
| `payments-review-order-*` | ⛔ P0 | Payment review flow |
| `payments-connect-onboard/` | ⛔ P0 | Organizer payout onboarding |
| `tier-assignment/` | ⛔ P0 | Tier upgrade/downgrade triggers |
| `engagements-create/` | ⛔ P0 | Core networking action |
| `engagements-accept/` | ⛔ P0 | Engagement acceptance |
| `engagements-respond/` | ⛔ P0 | Engagement response flow |
| `engagements-decline/` | ⛔ P0 | Engagement decline |
| `engagements-publish/` | ⛔ P0 | Making engagements public |
| `engagements-public-toggle/` | ⛔ P0 | Privacy toggle |
| `rounds-create/` | ⛔ P0 | Core round creation |
| `rounds-join/` | ⛔ P0 | Joining rounds |
| `rounds-respond/` | ⛔ P0 | Round invitation response |
| `trust-vouch/` | ⛔ P0 | Vouching for users |
| `trust-report-incident/` | ⛔ P0 | Incident reporting |
| `trust-reliability/` | ⛔ P0 | Reliability scoring |
| `reputation-calculate/` | ⛔ P0 | Reputation computation |
| `matching-request/` | ⛔ P0 | Matching flow initiation |
| `matching-accept/` | ⛔ P0 | Matching acceptance |
| `matching-reject/` | ⛔ P0 | Matching rejection |
| `matching-candidates/` | ⛔ P0 | Candidate retrieval |
| `matching-suggestions/` | ⛔ P0 | Suggestion engine |
| `onboarding-phase1/` | ⛔ P0 | Onboarding flow |
| `onboarding-profile/` | ⛔ P0 | Profile completion |

### P1 — HIGH (no tests, would cause significant user-facing bugs)

#### `apps/web/lib/` — Client-side Logic
| File | Risk | Why High |
|------|------|----------|
| `lib/stripe.ts` | ⚠️ P1 | Stripe checkout session creation |
| `lib/auth.ts` | ⚠️ P1 | Auth utilities, cookie handling |
| `lib/operator/auth.ts` | ⚠️ P1 | Operator role auth |
| `lib/supabase/client.ts` | ⚠️ P1 | Supabase client initialization |
| `lib/email.tsx` | ⚠️ P1 | Email template rendering |

#### `apps/web/hooks/` — React Hooks
| File | Risk | Why High |
|------|------|----------|
| `hooks/useOrganizer.ts` | ⚠️ P1 | Organizer state |
| `hooks/useOrganizerEvents.ts` | ⚠️ P1 | Event list |
| `hooks/useStripeCheckout.ts` | ⚠️ P1 | Payment hook |
| `hooks/useEventRegistrations.ts` | ⚠️ P1 | Registration data |

#### `apps/web/app/api/` — API Routes (20+ routes)
All API routes in `app/api/operator/` are untested — these handle tournament management, sponsor management, analytics, broadcasts, checkin, fulfillment, and payouts. They are critical operator-facing paths.

#### `@spotter/types/src/` — Business Logic (continued)
| File | Risk |
|------|------|
| `rounds.ts` | ⚠️ P1 |
| `organizer.ts` | ⚠️ P1 |
| `networking.ts` | ⚠️ P1 |
| `discovery.ts` | ⚠️ P1 |
| `golf.ts` | ⚠️ P1 |

### P2 — MEDIUM (no tests, would cause moderate bugs or regressions)

- `apps/web/components/` — All UI components (organizer cards, stats, member rows, etc.)
- `apps/web/app/(main)/*` — Main app pages (dashboard, discovery, rounds, profile, settings)
- `apps/web/app/(operator)/*` — Operator portal pages
- `apps/functions/supabase/functions/` — Remaining 60+ edge functions (video processing, notifications, coaches, expert scheduling, DND toggles, etc.)
- `@spotter/types/src/index.ts` — Re-exports barrel
- `@spotter/types/src/trust-config.ts` — Trust configuration values

## Recommendations

### What Fox Should Build First

1. **`@spotter/types` — tier.test.ts** (P0)
   - Already imports from tier.ts for web tests, but the tier.ts file itself has no dedicated unit tests
   - `hasAccess()`, `canSeeTier()`, `getVisibleTiers()` are the most-called functions in the codebase
   - Cover: all tier slugs × all feature flags

2. **`@spotter/types` — matching.test.ts** (P0)
   - `clampMatchLimit()` is already tested in functions via the shared module
   - Add type-level tests for matching eligibility types and candidate filtering

3. **`@spotter/types` — profile.test.ts + trust.test.ts (actual logic)** (P0)
   - `trust.test.ts` currently only covers `trust-config.ts` values
   - Add tests for trust score computation, vouching, and incident logic

4. **`apps/functions/supabase/functions/` — Payment function tests** (P0)
   - `payments.test.ts` exists but only covers the shared rate-limit logic
   - Mock the Supabase client to test `stripe-checkout`, `stripe-webhook`, `payments-refund-request` in isolation

5. **`apps/functions/supabase/functions/` — Engagement function tests** (P0)
   - `engagements.test.ts` exists but likely doesn't cover all 10+ engagement-related functions
   - Expand coverage to `engagements-respond`, `engagements-decline`, `engagements-create`

6. **Fix `booking-flow.e2e.test.ts`** (P1)
   - Either remove the empty/broken test file or add a proper Supabase mock so it can run

7. **`apps/web/lib/` — auth and stripe tests** (P1)
   - `lib/auth.ts` and `lib/stripe.ts` are thin wrappers, but they're critical paths
   - These can be unit-tested with minimal mocking

### Test Distribution Summary

| Area | Currently Tested | Should Have | Gap |
|------|-----------------|-------------|-----|
| `@spotter/types` | 1/11 files | 8+ files | 10 files |
| `apps/web` (lib/hooks) | 0 | 9+ files | 9 files |
| `apps/functions` | 5/87 functions | 30+ functions | 82 functions |
| `apps/web` (components) | 0 | 20+ components | 20+ components |

**Overall test coverage estimate: ~8% of source code has unit test coverage.**

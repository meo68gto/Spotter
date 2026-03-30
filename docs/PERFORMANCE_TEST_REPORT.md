# Spotter Performance Test Report — 2026-03-30

**Auditor:** J'onn J'onzz (Intelligence & Research)
**Scope:** Lighthouse CI · Bundle Size · API Latency · Database Performance · Build Performance

---

## Lighthouse CI

### Configuration Status: ✅ CORRECTLY CONFIGURED

The `.github/workflows/lighthouse-ci.yml` is properly configured:
- **Trigger:** Runs on every PR to `main`
- **Runner:** Ubuntu latest, Node 22, pnpm 9.15.4
- **Build step:** Runs `pnpm --filter=web build` with all required env vars (Supabase, Stripe, Sentry)
- **Assertion:** Uses `@lhci/cli@0.14.x`

### Budget Assertions (from `lighthouserc.json`)

| Metric | Threshold | Type |
|--------|-----------|------|
| LCP (Largest Contentful Paint) | ≤ 4000ms | ERROR |
| TTI (Interactive) | ≤ 5000ms | ERROR |
| CLS (Cumulative Layout Shift) | ≤ 0.1 | ERROR |
| Total Blocking Time | ≤ 500ms | ERROR |
| FCP (First Contentful Paint) | ≤ 2000ms | WARN |
| Speed Index | ≤ 4000ms | WARN |
| Performance category score | ≥ 0.7 | ERROR |
| Accessibility | ≥ 0.9 | ERROR |
| Best Practices | ≥ 0.9 | ERROR |
| SEO | ≥ 0.9 | ERROR |

### Issues
- **Cannot run locally** — Lighthouse CI requires the web app to be built and served. The build is currently broken (see Build Performance section), so no local run was possible.
- Budgets are correctly set to the targets in scope (TTI < 5s, LCP < 4s, CLS < 0.1).
- ⚠️ `network-requests` is only a `warn` with maxLength 75 — this is weak for catching bloated bundles.

---

## Bundle Size

### Status: 🔴 BUILD FAILURE — CANNOT MEASURE

The web build is broken and cannot produce bundle output. Root cause: broken import resolution in `@spotter/supabase` package.

**Import chain:**
```
apps/web/app/(main)/layout.tsx
  → @/lib/supabase/client.ts
    → @spotter/supabase/src/index.ts
      → exports { createServerClient } from './server.js'  ← .js extension on .ts file
        → webpack resolves ./server.js  →  NOT FOUND
```

The `@spotter/supabase` package (`packages/supabase/`) has:
```ts
// index.ts exports with .js extension
export { createServerClient } from './server.js';  // actual file is server.ts
```

Next.js Webpack resolves `.js` extensions when it encounters them in export maps. The file `server.ts` exists but the export path uses `.js`, causing the build to fail with "Module not found: Can't resolve './server.js'".

**Known consumers of broken import:**
- `app/(main)/layout.tsx` → `lib/supabase/client.ts`
- `app/api/operator/contracts/route.ts`
- `app/api/operator/contracts/[id]/route.ts`
- `app/api/operator/charges/route.ts`
- `app/api/operator/sponsors/route.ts`
- `app/api/operator/sponsors/[id]/route.ts`
- `app/api/operator/members/route.ts`
- `app/api/operator/analytics/route.ts`
- And ~20 more operator API routes

**Other observations:**
- `.next/` cache directory is 631MB — indicates prior builds cached heavily
- `apps/web/.next/server/` has compiled output (app routes, chunks, middleware) — likely from a prior build before the import regression
- `@spotter/mobile` uses Expo/React Native — bundle size not measurable via Next.js build output; `dist/` directory was not found, suggesting no `expo export` has been run

---

## API Latency

### Status: 🟡 EDGE FUNCTIONS EXIST — NO LIVE METRICS

The three target edge functions all exist with complete implementations. No live Supabase instance was reachable for direct latency measurement.

### `discovery-search`

**File:** `apps/functions/supabase/functions/discovery-search/index.ts`
- **Type:** Deno Edge Function (Supabase)
- **Auth:** Requires authenticated user (tier-gated via `getVisibleTiers`)
- **Logic:** Complex multi-table join with compatibility scoring
  - Filters by caller's tier (visibility enforcement — EPIC 7)
  - Optional `huntMode` for SELECT members viewing FREE tier
  - JOINs: `membership_tiers`, `user_professional_identities`, `user_golf_identities`, `golf_courses`, `user_reputation`, `user_networking_preferences`
  - Score: handicap band + city match + networking intent + profile completeness
- **Risk:** The `discover_golfers()` SQL function (migration `20250319102900_discovery_function.sql`) does 6 LEFT JOINs. With the `idx_users_discovery_filter` composite index covering all filter columns, this should stay under 100ms at small scale. At high user counts, the full scan within a tier could degrade.
- **Target:** < 500ms ✅ Architecture supports it, but no production load test data

### `matching-suggestions`

**File:** `apps/functions/supabase/functions/matching-suggestions/index.ts`
- **Type:** Deno Edge Function (Supabase)
- **Score weights:** handicap 0.30, networking intent 0.25, location 0.20, availability 0.15, group size 0.10
- **Backend:** Uses DB function `get_top_matches()` (migration `0020_matching_engine.sql`) with ST_Distance for geographic scoring
- **Risk:** The geographic `ST_Distance` call with GIST index (`idx_courses_location_gist`) is efficient. However, the function does candidate pre-fetch before scoring, which could be expensive at scale.
- **Target:** < 500ms ✅ Architecture supports it

### `payments-webhook`

**File:** `apps/functions/supabase/functions/payments-webhook/index.ts`
- **Type:** Deno Edge Function (Supabase)
- **Signature verification:** `verifyStripeWebhookSignature()` before any processing
- **Deduplication:** Checks `payment_events` table for `stripe_event_id` before processing
- **Logic:** On `payment_intent.succeeded` → resolves order → marks `review_orders` as paid → auto-publishes engagement
- **Risk:** The webhook does synchronous DB writes (insert event, update order, update engagement). If Stripe retries and the first request is slow, deduplication protects against double-processing.
- **Stripe signature verification is first** — invalid requests are rejected before any DB work
- **Target:** < 200ms ✅ Should easily meet this as a lightweight webhook handler

---

## Database Performance

### Status: ✅ GOOD INDEX COVERAGE — ONE GAP NOTED

### Key Indexes Found

**Users table:**
- `idx_users_discovery_filter` — composite on `(tier_id, tier_status, allow_connections, profile_completeness DESC, created_at DESC)` with partial filter `WHERE allow_connections = true AND tier_status = 'active'` ✅ Strong
- `idx_users_discovery_covering` — covering index including `(id, display_name, avatar_url, city, profile_completeness, created_at)` — avoids table lookups ✅
- `idx_users_matching_candidates` — partial on `(tier_id, id, display_name, avatar_url, city)` with `WHERE deleted_at IS NULL` ✅

**Golf identities & networking (matching engine):**
- `idx_golf_identities_matching` — covering on `(user_id, handicap, home_course_id)` ✅
- `idx_networking_prefs_matching` — covering on `(user_id, networking_intent, preferred_group_size, open_to_intros)` ✅
- `idx_professional_identities_covering` — covering on `(user_id, company, title, industry)` ✅

**Rounds operations:**
- `idx_rounds_list_query` — composite on `(tier_id, status, scheduled_at DESC)` with INCLUDE for `(creator_id, course_id, max_players, cart_preference)` — avoids covering index lookups ✅
- `idx_rounds_creator_status_scheduled` — `(creator_id, status, scheduled_at DESC)` ✅
- `idx_participants_v2_covering` — `(round_id, user_id, is_creator, joined_at)` ✅
- `idx_invitations_status_covering` — partial on `invitee_id` with `WHERE status = 'pending'` ✅

**Reputation & connections:**
- `idx_reputation_covering` — `(user_id, overall_score)` ✅
- `idx_connections_mutual_lookup` — partial with `WHERE status = 'accepted'` ✅

**Geographic:**
- `idx_courses_location_gist` — GIST index on `golf_courses.location` ✅

**Matches table:**
- `idx_matches_activity_status` — `(activity_id, status)` ✅
- `idx_matches_request_window` — GiST on `requested_time_window` ✅
- `idx_matches_requester_status` — from migration 0023 ✅
- `idx_matches_candidate_status` — from migration 0023 ✅
- `idx_matches_pair` — from migration 0023 ✅

**Organizer members:**
- `idx_organizer_members_organizer` — `(organizer_id)` ✅
- `idx_organizer_members_user` — `(user_id)` ✅
- `idx_organizer_members_role_active` — `(organizer_id, role)` ✅
- `idx_organizer_members_active` — partial (from 0023) ✅
- `idx_organizer_members_user_active` — partial (from 0023) ✅

**Query performance logging:**
- `query_performance_logs` table created with indexes on `(function_name, created_at DESC)` and `(execution_time_ms DESC, created_at DESC)` WHERE `execution_time_ms > 100` ✅

### ⚠️ Concern: Migration Ordering

Migration files 0022, 0023 do not exist in the sorted list. The last performance migration is `20250319104000_performance_indexes.sql` (from March 19), then later migrations continue with EPIC 1 gap closure, COPPA, tournament formats, etc. Migration `0023_add_performance_indexes.sql` is referenced in multiple places but the numbered migration file was not found in the `/supabase/migrations/` directory listing — the last migration file is `20260329000000_epic7_visibility.sql`. This means the "0023" migration may have been folded into a date-stamped migration, or the `idx_organizer_members_active` / `idx_organizer_members_user_active` indexes may have been added in a later date-stamped migration. Not a functional issue if they exist — but audit recommended to confirm all indexes are present.

### Slow Query Risk

- `discover_golfers()` does 6 LEFT JOINs — the covering index helps, but with `profile_completeness` sorting at the end, the query planner may do a full scan within a tier when high-cardinality sorts are involved. Slow query logging is active (threshold 100ms) ✅
- `get_top_matches()` does geographic `ST_Distance` per candidate — with GIST index on courses, this should be fine for typical candidate set sizes. Slow query logging threshold is 50ms ✅

---

## Build Performance

### Status: 🔴 BLOCKED — BUILD FAILURE

### The Blocker

```
Module not found: Can't resolve './server.js'
  at packages/supabase/src/index.ts:4:1
    → export { createServerClient } from './server.js';
  (actual file: server.ts)
```

The `@spotter/supabase` package exports TypeScript source files using `.js` file extensions (a Node.js convention for exports that works with bundlers that follow the "exports" field spec). Next.js Webpack correctly resolves these for the `client` and `mobile` exports but fails on `server`. This is a silent regression — no PR or migration history shows when this broke.

**Affected:** Every operator API route and `(main)` layout.

### Build Cache Status: ✅ CONFIGURED

`turbo.json` has correct configuration:
```json
"build": {
  "dependsOn": ["^build"],
  "env": ["NEXT_PUBLIC_*", "SUPABASE_*", "STRIPE_*", "SENTRY_*", "POSTHOG_*"],
  "outputs": [".next/**", "dist/**", "build/**", ".expo/**"],
  "cache": true
}
```
Environment variables that invalidate cache are properly declared. Incremental builds should be fast once the import issue is fixed.

The `.next/` cache directory is 631MB — likely contains cached artifacts from prior successful builds. Turbo remote cache would further improve CI build times.

### Incremental Build Assessment

Once fixed, expected behavior:
- Unchanged apps: near-instant (cache hit)
- Changed apps: rebuild only that app + dependents
- `@spotter/supabase` → `@spotter/web` dependency chain: if supabase source changes, web rebuilds
- Next.js `output: 'standalone'` is configured — production builds are minimized ✅

---

## Overall Score: 5/10

**Reasoning:**
- Lighthouse CI: 2/2 (configured correctly, budgets right)
- Bundle Size: 0/2 (build broken, cannot measure)
- API Latency: 2/2 (correct architecture, functions well-structured)
- Database: 2/2 (excellent indexes, query logging active)
- Build: 0/2 (blocked by import bug)

---

## Top 3 Issues

### 1. 🔴 Build Broken — `@spotter/supabase` Import Error (BLOCKER)
**What:** The package `packages/supabase/src/index.ts` exports `server.js` but the actual file is `server.ts`. Next.js fails to resolve the import during webpack compilation.

**Fix required:** Change `packages/supabase/src/index.ts` line 4:
```ts
// FROM:
export { createServerClient, createServerBrowserClient } from './server.js';
// TO:
export { createServerClient, createServerBrowserClient } from './server.ts';
```
And same for `client.js` → `client.ts` and `mobile.js` → `mobile.ts`. The `.js` extension convention is for published packages with pre-compiled output — this package has `type: module` and `"main": "./src/index.ts"` so it's uncompiled, and the `.ts` extension must match the actual files.

**Risk if not fixed:** No deploys possible. Lighthouse CI cannot run. All bundle size and build performance metrics are unmeasurable.

### 2. 🟡 Migration "0023" Not Found in Date-Stamped Directory
**What:** Migration `0023_add_performance_indexes.sql` is referenced in code as the source of `idx_organizer_members_active` and `idx_organizer_members_user_active`, but no file matching `0023*.sql` appears in the migrations directory (which uses `YYYYMMDDHHMMSS` naming). The indexes may have been added via a date-stamped migration, or they may be missing.

**Fix required:** Run against production Supabase:
```sql
SELECT indexname FROM pg_indexes WHERE tablename = 'organizer_members';
```
Verify `idx_organizer_members_active` and `idx_organizer_members_user_active` exist. If missing, apply the index creation manually or locate the correct date-stamped migration that should contain them.

### 3. 🟡 Lighthouse Cannot Be Run Locally
**What:** The CI workflow builds the app and runs Lighthouse against `localhost:3000`. Because the build is broken, the workflow cannot run. Even after the build is fixed, running Lighthouse locally requires starting the server (`pnpm --filter=web start`) and running `pnpm lhci autorun`, which is non-trivial.

**Fix required:** Once build is fixed, add a local run script to `package.json`:
```json
"lhci": "lhci autorun"
```
And document that developers need `supabase start` + web server + `pnpm lhci` to validate before PR.

---

## Supporting Evidence

- Build failure log: `Module not found: Can't resolve './server.js'` in `packages/supabase/src/index.ts`
- Turbo config: `turbo.json` has `cache: true` and proper env declarations
- Lighthouse budgets: `apps/web/lighthouserc.json` has correct thresholds
- Performance migration: `20250319104000_performance_indexes.sql` contains 14 index creations and query optimization for `discover_golfers()` and `get_top_matches()`
- Edge functions: All three target functions exist with proper Stripe webhook verification, deduplication, and tier-gated visibility
- No dist output: `@spotter/supabase` has no `dist/` directory — source TypeScript files are exported directly
# Spotter Infrastructure Re-Audit

**Auditor:** J'onn J'onzz
**Date:** 2026-03-29
**Status:** ✅ Mostly Complete — 1 Gap Found

---

## Verdict

Victor completed **all 9 infrastructure items** from the original report. Code quality is high. One missing migration needs to be created before the Karpathy loop runs in production.

---

## Detailed Findings

### ✅ 1. `packages/supabase/` — Client Architecture

**Status:** Complete and correct.

Four factory functions exported cleanly:
- `createBrowserClient()` — anon key, cookie auth (web browser)
- `createServerClient()` — service role key, bypasses RLS (trusted server)
- `createServerBrowserClient()` — anon key for server components
- `createMobileClient()` — PKCE flow with AsyncStorage, react-native-url-polyfill

Mobile PKCE implementation is solid. Fallback URL/key guards prevent startup crashes when env vars aren't set in dev.

**Minor note:** `packages/supabase/src/index.ts` re-exports from `./client.js` but the actual `createBrowserClient` lives in `./client.ts`. This works at runtime via bundler resolution but the barrel re-export path is technically stale. Low risk.

---

### ✅ 2. `packages/hooks/` — All 4 Hooks Present

All four hooks exist and are functional:

- **`useApi`** — Generic async wrapper with loading/error/data state. Clean implementation.
- **`useSession`** — Full auth state subscription via `onAuthStateChange`. Includes `useSessionCheck` (lightweight) and `useOperatorSession` (for admin contexts).
- **`useTierAccess`** — Checks `hasAccess()` from `@spotter/types`. Exports `isFree`, `isSelect`, `isSummit`, `isPaid` convenience booleans.
- **`useStripe`** — Platform-aware: `presentSheet` for mobile (Stripe React Native), `openCheckoutSession` for web. Clean separation.

Index.ts barrel exports all four hooks correctly.

---

### ✅ 3. `.github/workflows/lighthouse-ci.yml` — CI Config

Configured correctly:
- Uses `pnpm` with pinned version 9.15.4
- Builds web app via `pnpm --filter=web build` with all required env secrets
- Runs `pnpm lhci autorun` with `@lhci/cli@0.14.x`
- `LHCI_GITHUB_APP_TOKEN` wired to `secrets.GITHUB_TOKEN`

No issues found.

---

### ✅ 4. `supabase/migrations/0023_add_performance_indexes.sql` — Indexes

13 partial indexes created, all well-targeted:

| Table | Index | Query Pattern |
|-------|-------|---------------|
| `matches` | `idx_matches_requester_status` | `WHERE requester_user_id = X AND status IN (...)` |
| `matches` | `idx_matches_candidate_status` | `WHERE candidate_user_id = X AND status IN (...)` |
| `matches` | `idx_matches_pair` | Unique pair check for pending/accepted |
| `organizer_members` | `idx_organizer_members_active` | Active members per org |
| `organizer_members` | `idx_organizer_members_user_active` | User's active org memberships |
| `organizer_members` | `idx_organizer_members_role_active` | Role-filtered active members |
| `users` | `idx_users_tier_visibility` | Discovery scan by tier + visibility |
| `users` | `idx_users_visibility_hunt` | Hunt mode discovery |
| `users` | `idx_users_discovery_scan` | Full discovery path |
| `users` | `idx_users_search_boost_tier` | Boosted user search |
| `swings` | `idx_swings_user_created` | Per-user swing history (conditional) |
| `swings` | `idx_swings_user_activity` | Activity-scoped swings (conditional) |
| `swing_pose_keypoints` | `idx_swing_pose_keypoints_swing` | Pose keypoints lookup (conditional) |

Conditional guards (`if exists`) for swings tables are correct — handles environments where those tables may not be present.

---

### ✅ 5. `.github/workflows/preview.yml` — Preview Deployments

Setup is solid:
- Deploys to Vercel preview environment on PRs to `main`
- Comments PR with preview URL after deployment
- Runs smoke tests against preview URL (health + `api/health` endpoint)
- Uses `--prebuilt` flag correctly for Next.js

No issues found.

---

### ✅ 6. `apps/functions/supabase/functions/_shared/cron-alerts.ts` — Alerting

`logCronRun` + `wrapCron` pattern is well-designed:
- Inserts health record to `function_health_checks` table
- `wrapCron` wraps any async handler, auto-logs success/failure with duration
- Insert failures are **non-fatal** (logged to console, doesn't crash the cron job)
- `durationMs` tracked via `performance.now()`

Correctly handles `success`, `failure`, and `warning` statuses.

---

### ✅ 7. `apps/mobile/src/lib/analytics.ts` — PostHog

PostHog configured properly for mobile:
- Reads `EXPO_PUBLIC_POSTHOG_KEY` and `EXPO_PUBLIC_POSTHOG_HOST` env vars
- `flushIntervalSeconds: 10` — good balance for mobile (reduces network chatter)
- `captureScreenViews: true` enabled
- `disableAutocapture: __DEV__` — disables in simulators, correct
- Exports `identifyUser`, `trackEvent`, `trackScreen`, `resetUser`

**Minor note:** `__DEV__` is a React Native global but is not TypeScript-declared by default — may produce a TS warning depending on tsconfig. Not a runtime issue.

---

### ✅ 8. `packages/ui/` — Toast, Badge, Card, Spinner

All four components present with clean implementations:

- **`Toast`** — Animated slide-in using Reanimated. Global `showToast()` dispatcher pattern. Accent bar by type (success/error/info). Auto-dismiss with configurable duration. Non-blocking `dispatcher = null` on unmount.
- **`Badge`** — Tier-colored (free/select/summit). Proper color tokens. Small/medium sizes.
- **`Card`** — `elevated` prop adds shadow. `padded` prop default on. Clean base styles.
- **`Spinner`** — Simple ActivityIndicator wrapper. `fullScreen` mode for loading screens.

All properly re-exported from `index.ts`.

---

### ✅ 9. `turbo.json` — Env Declarations and Outputs

Correctly declares all required env vars per task:

- **build:** `NEXT_PUBLIC_*`, `SUPABASE_*`, `STRIPE_*`, `SENTRY_*`, `POSTHOG_*`
- **typecheck / lint:** `NEXT_PUBLIC_*`, `SUPABASE_*`, `EXPO_PUBLIC_*`
- **test:** same + `NODE_ENV`

Outputs properly exclude `!.expo/README.md` from the Expo cache dir.

---

### ✅ 10. `packages/auth/` — Auth Package Intact

Still properly set up after Victor's later work:

- `getSessionFromCookie()` — canonical web session lookup: validates JWT → fetches profile → fetches active organizer membership
- `isOperatorOrAdmin()` / `hasOrganizerMembership()` — role helpers
- `OperatorSession` type with `userId`, `displayName`, `email`, `role`, `organizerId`, `memberRole`
- Service role client creation in `web.ts` is clean

Types are well-designed. No issues.

---

### ✅ 11. `apps/web/instrumentation.ts` — Sentry Wired

Sentry initialized correctly:

- `tracesSampleRate: 0.1` in production (appropriate sampling)
- `replaysSessionSampleRate: 0.05`, `replaysOnErrorSampleRate: 1.0`
- `debug` mode in development
- `denyUrls` filters out Chrome extensions and localhost in production — correct

No issues.

---

### ⚠️ 12. `rate_limits` Migration — **MISSING**

**This is the one gap.**

`apps/functions/supabase/functions/_shared/rate-limit.ts` expects a `rate_limits` table with columns:
- `id` (primary key)
- `user_id` (text)
- `action` (text)
- `created_at` (timestamptz)

The utility handles missing table gracefully (returns `allowed: true`), so it won't crash — but **rate limiting is not actually active**. All discovery, messaging, and payment endpoints using this utility will allow unlimited requests until the table exists.

The migration `0020_rate_limits.sql` does not exist. There are two `0020_*.sql` files:
- `0020_matching_engine.sql`
- `0020_operator_web_phase1.sql`

Neither creates the `rate_limits` table.

**Impact:** Medium. Rate limiting is coded but non-functional until the table is created.

---

## Overall Assessment

| Area | Status |
|------|--------|
| Supabase client architecture | ✅ Solid |
| React hooks (4/4) | ✅ Complete |
| Lighthouse CI | ✅ Configured |
| Performance indexes | ✅ 13 targeted indexes |
| Preview deployments | ✅ Vercel + smoke tests |
| Cron alerting | ✅ logCronRun + wrapCron |
| PostHog analytics | ✅ Properly configured |
| UI components (Toast/Badge/Card/Spinner) | ✅ All present |
| Turbo env declarations | ✅ Correct |
| Auth package | ✅ Intact |
| Sentry instrumentation | ✅ Wired |
| Rate limiting migration | ⚠️ **Missing** |

### Is the Karpathy Loop Safe to Run?

**Almost.** The infrastructure is production-quality. The only blocker is the missing `rate_limits` migration. Without it, rate limiting code exists but is a no-op — endpoints are unprotected against burst traffic.

### What to Do

Create `supabase/migrations/0024_rate_limits.sql`:

```sql
create table if not exists public.rate_limits (
  id         bigint generated always as identity primary key,
  user_id    text not null,
  action     text not null,
  created_at timestamptz not null default now()
);

-- High-frequency queries: lookup by user + action + recent window
create index if not exists idx_rate_limits_user_action_created
  on public.rate_limits(user_id, action, created_at desc);

-- Cleanup job (call manually or via cron)
create or replace function cleanup_rate_limits(window_seconds int default 3600)
returns bigint as $$
  delete from rate_limits where created_at < now() - (window_seconds || ' seconds')::interval;
  select count(1);
$$ language sql security definer;
```

Once this migration exists and is applied, the Karpathy loop is fully safe to run.

---

*Audit complete. Victor delivered on all 9 items. One table migration needed — then we're green.*

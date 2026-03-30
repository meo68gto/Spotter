# Spotter Infrastructure Improvements

> Audited: 2026-03-29 | J'onn J'onzz, Intelligence & Research
> Purpose: Research what infrastructure Spotter needs to enable safe AI-driven iteration (Karpathy loop) and close critical engineering gaps.

---

## 1. Test Infrastructure Plan

### Current State

Spotter has a **fragmented, partial test setup** spread across multiple packages:

| Package | Runner | Files | Status |
|---|---|---|---|
| `@spotter/mobile` | Vitest | 8 test files in `tests/` | ✅ Minimal unit tests exist |
| `@spotter/functions` | Vitest | 5+ test files in `tests/` | ✅ Some unit coverage |
| `@spotter/api-tests` | Jest (ts-jest) | 7 API-level tests | ✅ Integration tests exist |
| `@spotter/e2e` | Playwright | 5 spec files | ✅ E2E smoke tests exist |
| `@spotter/web` | — | None | ❌ No tests |
| `@spotter/web-admin` | — | None | ❌ No tests |
| `@spotter/types` | — | 1 trust test file | ⚠️ Only trust.test.ts |

The root `pnpm test` task exists but `turbo.json` has no real test task definition — it only propagates a `"test": {}` dep. The web and web-admin packages echo `"No tests yet"`.

### Problems

1. **No unified test runner config** — Vitest in mobile/functions, Jest in api-tests, Playwright in e2e. Each has its own config.
2. **Web apps have zero test coverage** — The Next.js apps are completely untested at unit or integration level.
3. **No CI test target** — `pnpm test` is listed in CI but has no real implementation for most packages.
4. **No coverage enforcement** — No coverage thresholds, no reporting.
5. **Mobile Detox tests** use a separate Jest config (`e2e/jest.config.js`) disconnected from Vitest unit tests.
6. **Test isolation issues** — API tests hit real Supabase (or require a specific setup), no mock layer.

### What a Good Test Pyramid Looks Like for Spotter

```
        /‾‾‾‾‾\
       |  E2E  |   ← Playwright (web), Detox (mobile) — <5 scenarios, slow
        \______/
       /        \
      |  Integ   |   ← Supabase Edge Function tests + API route tests — 50-100 tests
       \________/
      /          \
     |   Unit      |   ← Pure functions, hooks, utils across all packages — 200+ tests
      \__________/
```

### What's Needed

#### Tier 1: Unified Test Infrastructure (Foundation)

**Choose one runner: Vitest**
- Vitest supports Node, Browser (via Vitest Browser), and React Testing Library
- Works for: packages, edge functions, Next.js API routes, React components
- Unify: move mobile/functions off their individual Vitest configs → one workspace root `vitest.config.ts` that packages extend

**Key packages to add:**
```json
{
  "devDependencies": {
    "vitest": "^2.x",
    "@vitest/coverage-v8": "^2.x",
    "@testing-library/react": "^15.x",
    "@testing-library/react-native": "^12.x",
    "msw": "^2.x",
    "vitest-fetch-mock": "^1.x"
  }
}
```

**Coverage targets:**
- Packages (types, env, config): 80%+ line coverage on pure logic
- Functions (edge functions): 70%+ coverage on _shared/ utilities
- Web API routes: mock Supabase, test route logic
- Mobile hooks: React Testing Library + MSW for API mocking

#### Tier 2: Web App Tests (Biggest Gap)

- Add Vitest + React Testing Library to `@spotter/web` and `@spotter/web-admin`
- Test Next.js Server Actions and Route Handlers by mocking Supabase clients
- Priority test areas:
  - Auth flow (middleware, cookie session, role checks)
  - Tier visibility logic (`hasAccess`, `canSeeTier`)
  - Organizer quota enforcement
  - Stripe webhook handlers

#### Tier 3: Mobile Hook Tests

- Expand existing Vitest tests for hooks
- Add MSW (Mock Service Worker) to intercept Supabase function calls
- Test: `useTrust`, `useSessionLifecycle`, `useVideoPipeline`, `useStripe`

#### Tier 4: CI Integration

```yaml
# In CI, after typecheck:
- name: Unit + Integration tests
  run: pnpm test:coverage  # vitest run --coverage

- name: E2E tests
  run: pnpm test:e2e

- name: Mobile Detox
  run: pnpm mobile:e2e:test:ios
```

**Realistic target: Full suite in <5 min**
- Unit/integration: ~2-3 min (parallel via Turbo + Vitest's pool)
- E2E (Playwright): ~1-2 min (5 specs, parallel)
- Total: ~4-5 min ✅

---

## 2. Eval Criteria Readiness (Karpathy Loop Prerequisites)

### What Is the Karpathy Loop?

A self-contained AI-driven iteration cycle:
1. **Edit** a file
2. **Run** a test/eval
3. **Observe** binary pass/fail
4. **Repeat**

The loop requires: **one file, one eval, no ambiguity**.

### Current State: Spotter Cannot Safely Run This Loop

#### Problem 1: No Binary Eval Criteria

Spotter has no automated eval that says "this change is correct." E2E tests exist but are scenario-level, not file-level. There is no:

- Snapshot testing
- Golden file comparison
- Behavioral contract tests
- `git diff`-based validation

#### Problem 2: No Single-File Iteration Targets

The following files are **good candidates** for one-file iteration (they contain self-contained logic with clear inputs/outputs):

| File | Package | Why It Works |
|---|---|---|
| `packages/types/src/trust.ts` | `@spotter/types` | Pure functions, no I/O, easy to test |
| `packages/types/src/matching.ts` | `@spotter/types` | Scoring logic with clear numeric output |
| `packages/types/src/tier.ts` | `@spotter/types` | Access control with boolean output |
| `apps/functions/supabase/functions/_shared/rate-limit.ts` | `@spotter/functions` | Rate limiting logic |
| `apps/functions/supabase/functions/_shared/validation.ts` | `@spotter/functions` | Payload validation |
| `apps/mobile/src/lib/auth-utils.ts` | `@spotter/mobile` | Auth parsing utilities |

#### Problem 3: What Would Good Eval Criteria Look Like?

For Spotter, a practical Karpathy loop needs:

**1. Pass/Fail on Type Validity**
```bash
pnpm typecheck # must be green to proceed
```

**2. Pass/Fail on Unit Tests**
```bash
pnpm vitest run --reporter=basic  # exit 0 = pass, exit 1 = fail
```

**3. Pass/Fail on Lint**
```bash
pnpm lint  # exit 0 = pass
```

**4. Optional: E2E Smoke**
```bash
pnpm test:e2e --grep "core flow"  # run only critical path
```

Combined: `typecheck && lint && vitest run && test:e2e` → if all green, change is safe to merge.

#### What Would Need to Be True for the Loop to Work Safely

1. **Tests must be fast** (<5 min total, <30 sec per file edit cycle)
2. **Tests must be deterministic** — no flaky tests, no dependency on external services
3. **Eval criteria must be binary** — no "looks good", no manual review gate
4. **Each file must have an associated test** — the trust/matching/tier types need companion `.test.ts` files
5. **Supabase mocking must work** — edge function tests currently may hit real Supabase; they need mock clients
6. **No env dependencies in tests** — test env vars must be fake-able, not require real API keys

---

## 3. Critical Infrastructure Gaps

### Priority 1: Observability & Monitoring

**Current state:**
- Mobile has Sentry (`@sentry/react-native`) configured and an `AppErrorBoundary`
- Mobile has PostHog analytics (`lib/analytics.ts`) — but it's a manual `fetch` implementation, not the official SDK
- Web has **zero** observability tooling — no Sentry, no analytics, no error tracking
- Edge functions have no error tracking configured (Sentry DSN env var exists but no SDK init found in function code)

**Gaps:**
- Web error tracking (Sentry for Next.js)
- Edge function error tracking (Sentry for Deno)
- PostHog page/screen analytics on web (only mobile has it)
- No distributed tracing across web → Supabase → edge functions
- No uptime monitoring for Supabase functions (only Vercel cron health check)

**Fix:** Add `@sentry/nextjs` to web, initialize Sentry in edge functions, upgrade PostHog to official SDK everywhere.

### Priority 2: Authentication Gaps

**Current state:**
- Mobile: PKCE flow via `expo-auth-session`, tokens in AsyncStorage, demo token bypass in `api.ts`
- Web: Cookie-based session via Supabase, middleware checks `sb-access-token` cookie
- Web-admin: Reuses web auth + cookie, role check in `withOperatorAuth`
- The demo token bypass in mobile's `api.ts` (`if (token.startsWith('dev-only-demo-')))` is a **risk** — it allows dev tokens to bypass real API calls

**Gaps:**
- Demo token bypass should be compile-time only (guarded by `process.env.NODE_ENV === 'development'`), not runtime token inspection
- No refresh token rotation validation
- No session invalidation on password change
- Web admin middleware only checks cookie existence — doesn't validate token freshness on sensitive routes
- No CSRF protection on web API routes

### Priority 3: Rate Limiting Gaps

**Current state:**
- Rate limiting exists only in `chat-send` and `engagement-chat-send` via `exceededMessageLimit`
- Other edge functions have **no rate limiting**
- No rate limiting on web API routes

**Gaps:**
- `discovery-search` — could be abused for scraping
- `matching` endpoints — compute-heavy
- `payments-*` functions — financial exposure
- No global Supabase rate limiting via Postgres hooks or Supabase's built-in rate limiting

### Priority 4: Database Optimization

**Current state:**
- 21+ migration files, some with overlapping concerns
- RLS is enabled on most tables but policies are spread across migrations
- No index audit documented
- No query performance monitoring

**Gaps:**
- No composite indexes for common query patterns (e.g., `discovery-search` likely does `WHERE tier = X AND location < radius`)
- No connection pool monitoring
- `organizer_members` lookup done on every authenticated request (could be cached)
- No prepared statement usage

### Priority 5: Build Performance

**Current state:**
- Turborepo with `pnpm` workspace
- Web build: Next.js, no explicit caching config
- Mobile: Expo with `expo export` for build
- No incremental build stats tracked

**Gaps:**
- No Next.js SWC compilation stats
- No mobile bundle size tracking in CI (`mobile:bundle:report` exists but not in CI)
- `turbo.json` has no `env` declaration — doesn't cache based on env vars

---

## 4. 3-UI Sync Issues

Spotter has three UIs: **web** (golfer-facing), **mobile** (golfer-facing), and **web-admin/operator portal** (organizer-facing). They share concepts but have separate implementations.

### What Currently Exists as Shared

- `@spotter/types` — central TypeScript types package used by all three UIs ✅
- `@spotter/env` — shared env var types ✅
- Supabase client creation is per-app (separate `client.ts`/`server.ts` for web, `supabase.ts` for mobile)

### What's Duplicated That Shouldn't Be

#### 1. Auth Flow (3 separate implementations)

| UI | Auth Mechanism |
|---|---|
| Web | Supabase cookie auth, `getSessionFromCookie()` |
| Mobile | Expo Auth Session PKCE, `supabase.auth.getSession()` |
| Web-admin | Same as web (cookie auth + `withOperatorAuth`) |

Mobile auth logic in `src/screens/auth/` (LoginScreen, SignUpScreen, SplashScreen, WelcomeScreen) is completely separate from web auth in `apps/web/lib/auth.ts`.

**Fix:** Extract auth utilities into `@spotter/auth` package with:
- `getSession()`, `signIn()`, `signOut()` as platform-agnostic interfaces
- Platform adapters: `WebAuthAdapter`, `MobileAuthAdapter`
- Shared token storage interface

#### 2. Admin/Operator Auth (2 separate implementations)

- `apps/web/lib/auth.ts` — `getSessionFromCookie()`
- `apps/web/lib/operator/auth.ts` — `withOperatorAuth()` (wraps above)
- `apps/mobile/src/hooks/useAdmin.ts` — separate admin auth hook

These duplicate the same session query pattern (user → organizer_members join). The mobile admin screen has its own `AdminUser` type that matches the same data shape.

**Fix:** Extract `OperatorSession` and `getSessionFromCookie` into `@spotter/operator-auth` package. Mobile's `useAdmin.ts` should import from it.

#### 3. Supabase Client Creation (3 separate implementations)

- `apps/web/lib/supabase/client.ts` — browser client
- `apps/web/lib/supabase/server.ts` — service role client
- `apps/mobile/src/lib/supabase.ts` — mobile client with PKCE

The mobile client uses `AsyncStorage` + `detectSessionInUrl: false` + `flowType: 'pkce'`. The web client uses cookies.

**Fix:** Move to `@spotter/supabase` package with `createBrowserClient()`, `createServerClient()`, `createMobileClient()` factories. Each app imports from the package.

#### 4. API Invocation Pattern (2 separate implementations)

- Web: Next.js Route Handlers (`app/api/operator/*`) call Supabase directly
- Mobile: `invokeFunction()` in `src/lib/api.ts` wraps `supabase.functions.invoke()`
- Web operator routes don't use the function invocation pattern — they use direct DB access via service role client

This split means the same business logic is implemented twice: once as a Supabase Edge Function (mobile path) and once as a Next.js Route Handler (web admin path).

**Fix:** Choose one canonical path. If the mobile path (edge functions) is the canonical business logic, web admin should also call edge functions rather than doing direct DB access. This consolidates business logic.

#### 5. Toast/Notification System

Mobile has `ToastHost` and `showToast()`. No shared notification system with web.

#### 6. Hooks with Identical Names, Different Implementations

- `useAdmin.ts` (mobile) vs operator dashboard hooks in `apps/web/hooks/`
- Mobile has `useBookingFlow`, `useStripe`, `useVideoPipeline`
- Web has `useStripeCheckout`, `useOrganizerEvents`, `useEventRegistrations`

These serve similar purposes (state management + API calls) but are not shared.

### Best Way to Unify

```
packages/
  @spotter/types/        ← ✅ Already shared
  @spotter/env/          ← ✅ Already shared
  @spotter/auth/         ← NEW: shared auth primitives
  @spotter/supabase/     ← NEW: client factories
  @spotter/ui/           ← NEW: shared UI primitives (Toast, Spinner, Badge, etc.)
  @spotter/hooks/        ← NEW: shared React hooks (useApi, useSession, useTier)
```

Web and mobile import from these packages instead of having inline implementations.

---

## 5. CI/CD Gaps

### Current CI Workflow (`.github/workflows/ci.yml`)

Runs on PR to main:
1. Install pnpm
2. `env:validate`
3. `gitleaks` secret scan
4. `lint`
5. `typecheck`
6. `test` ← **no-op for most packages**
7. QA static checks (`qa:screen-index:check`, `qa:stock-photo-audit`)
8. `db:check`

**Missing from CI:**

### Gap 1: No Test Execution
`pnpm test` is called but does almost nothing for most packages. CI should run actual tests with coverage.

### Gap 2: No Build Verification
CI doesn't verify that `pnpm build` succeeds. Deploy pipelines run build separately, but a PR should verify the build compiles.

### Gap 3: No Mobile Test in CI
`mobile-nightly-qa.yml` and `mobile-rc-qa.yml` exist as separate workflows but:
- No iOS/Android test runs on every PR
- Detox tests require macOS runner (expensive)
- **Recommendation:** Run mobile smoke tests only on nightly/RC, not every PR

### Gap 4: No Deployment Preview
No Vercel preview deployment on PR branches. Staging deploys on `main` push only.

### Gap 5: No Performance Regression Check
No Lighthouse CI, no bundle size tracking, no Webpack/RSW build stats.

### Gap 6: Missing Deployment Config
- `deploy-production.yml` and `deploy-staging.yml` exist but truncated — need to verify they include migration runs and smoke tests post-deploy
- No rollback strategy documented
- No canary/deploy-wait-confirm pattern

### Gap 7: Cron Job Monitoring
`trust-cron.yml`, `ops-recurring-jobs.yml` exist — but no alerting if they fail. Should hook into PagerDuty/Slack for failures.

---

## 6. Recommended Priority Order

### Immediate (Before Any New Features)

1. **Add Vitest to web and web-admin** — establish test baseline for the largest untested codebase. Add at minimum: auth middleware tests, tier access tests, operator route handler tests. Target: 50 tests.

2. **Unify auth into `@spotter/auth` package** — extract `getSessionFromCookie` and `OperatorSession` into a shared package consumed by web, web-admin, and mobile. This closes a security gap (mobile has a separate admin auth path) and reduces duplication.

3. **Add coverage enforcement in CI** — after tests exist, add `vitest --coverage` to CI with a minimum threshold (e.g., 50% line coverage). Won't pass PRs without tests.

4. **Fix demo token bypass** — the runtime token inspection in mobile's `api.ts` is a security risk. Move to compile-time `NODE_ENV` guard.

### Short-Term (Karpathy Loop Readiness)

5. **Add unit tests for `@spotter/types`** — trust.ts, matching.ts, tier.ts are the best targets for one-file iteration. Add companion `.test.ts` files for all exported functions.

6. **Add MSW to mobile test setup** — enables testing hooks without real Supabase, making tests fast and deterministic.

7. **Add Sentry to web and edge functions** — you can't iterate fast if you don't know what's breaking. Web has zero error tracking.

8. **Add rate limiting to discovery-search and payments-*** — these are financial/computational risks.

### Medium-Term (Engineering Health)

9. **Create `@spotter/supabase` package** — unify client creation across apps.

10. **Add Lighthouse CI for web** — catch bundle size increases and performance regressions.

11. **Add `@spotter/hooks` package** — shared hooks for common patterns (useApi, useSession, useTierAccess).

12. **Database index audit** — review migration files for missing indexes, especially on `discovery_search`, `organizer_members`, `matches`.

13. **Add Vercel preview deployments** — PR-level previews catch integration issues before merge.

14. **Add cron job alerting** — hook failed cron jobs into a notification channel (Slack/PagerDuty).

### Lower Priority (Nice to Have)

15. **Upgrade PostHog to official SDK** — current manual fetch implementation is fragile.

16. **Add `@spotter/ui` package** — shared Toast, Spinner, Badge components.

17. **Detox CI on PR** — requires macOS runner; consider running only on nightly cadence.

18. **Incremental build caching** — add `env` declarations to `turbo.json` tasks.

---

## Summary: What to Tell Michael

| Area | Status | Risk |
|---|---|---|
| Web tests | ❌ None | High — can't safely iterate |
| Mobile tests | ⚠️ Minimal | Medium |
| Functions tests | ⚠️ Partial | Medium |
| Auth (3 implementations) | ⚠️ Duplicated | High — security gap |
| Error tracking (web) | ❌ None | High |
| Error tracking (functions) | ❌ None | High |
| Rate limiting | ❌ Most functions | Medium |
| Database indexes | ❓ Unknown | Medium |
| CI tests | ❌ No-op | High |
| Observability | ⚠️ Mobile only | Medium |

**The Karpathy loop cannot safely run today** because there are no binary eval criteria at the file level. The fastest path to enabling it:

1. Add Vitest tests for `@spotter/types` (trust.ts, matching.ts, tier.ts) — these are pure functions, easiest to test
2. Add a `pnpm vitest run` gate to CI that must pass before merge
3. Add web package tests for auth middleware + tier access

Once those three things exist, you have: **test coverage → deterministic eval → safe loop**.

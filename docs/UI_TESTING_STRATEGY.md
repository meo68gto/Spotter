# Spotter UI Testing Strategy

**Author:** J'onn J'onzz (Intelligence & Research)  
**Date:** 2026-03-29  
**For:** Fox (Engineering) — implementation roadmap  
**Context:** Michael wants the best possible UI testing setup. Current Playwright setup has known issues (auth problems, slow, flaky). This document is the research output that Fox implements.

---

## 1. Current State

### What Exists

#### Web (`apps/e2e/`) — Playwright

| File | Purpose | Status |
|------|---------|--------|
| `playwright.config.ts` | Full multi-browser config (Chromium, Firefox, WebKit, mobile) | ⚠️ Has issues |
| `tests/fixtures/auth.setup.ts` | Auth setup via login page flow | ❌ BROKEN |
| `tests/onboarding-phase1.spec.ts` | ~60 tests for onboarding flow | ⚠️ Depends on auth |
| `tests/rounds.spec.ts` | ~50 tests for rounds creation/invites | ⚠️ Depends on auth |
| `tests/payments.spec.ts` | Stripe checkout redirect tests | ⚠️ No Stripe mocking |
| `tests/discovery.spec.ts`, `profile-networking.spec.ts`, etc. | Feature tests | ⚠️ Various states |
| `test-results.json` | Last run results | Shows failures |

**What's broken:**

1. **Auth setup is fragile** — `auth.setup.ts` does a real login via the UI for every browser/project permutation. This is slow (5+ browser configs × login time) and fragile (any UI change in login breaks all tests).

2. **No Supabase test tenant strategy** — Tests hit real Supabase local dev or cloud. Auth state is stored per-project (`playwright/.auth/user.json`) but the seeding is manual and per-user.

3. **3 browser projects × 3 mobile = 6 browser instances** — Auth setup runs 6 times per test suite run. In CI, this is a massive bottleneck.

4. **Test IDs not consistently implemented** — Many tests use `getByTestId()` but the actual components may not have `data-testid` attributes. Tests likely fail at the element-finding stage, not the logic stage.

5. **No CI execution** — The `.github/workflows/ci.yml` does NOT run Playwright tests at all. It only does lint, typecheck, unit tests, and db checks. E2E tests are never in CI.

6. **No mobile E2E execution** — Detox setup exists in `apps/mobile/e2e/` but the `package.json` only has `detox build` / `detox test` scripts — no CI config and no real tests (the 4 `.e2e.ts` files are stubs with 1-2 lines each).

#### Mobile (`apps/mobile/`) — Detox + Vitest

| Layer | Status |
|-------|--------|
| Unit tests (`tests/*.test.ts`) | ✅ Vitest unit tests exist (~8 files) |
| E2E stubs (`e2e/*.e2e.ts`) | ❌ Barely implemented (1-2 line skeletons) |
| Detox build/test scripts | ⚠️ Configured but never run in CI |
| No Detox config file | Missing `detox.config.ts` |

**What's broken:**

1. Detox config (`detox.config.ts`) is missing — can't actually run `detox test`
2. E2E files are stubs: `auth-onboarding.e2e.ts` has 1 test, `dashboard-core.e2e.ts` has 1 test, etc.
3. No CI integration for mobile E2E
4. Expo SDK 52 + React Native — Detox support is complex and version-sensitive

---

## 2. Competitive Research

### Web UI Testing — Industry Standard (2024-2025)

| Tool | Pros | Cons | Who Uses It |
|------|------|------|-------------|
| **Playwright** | Best multi-browser support, auto-waiting, CI-friendly, Microsoft-backed | Can be slower than Vitest for unit-adjacent | Microsoft, Adobe, Uber, Shopify, Vercel |
| **Cypress** | Great DX, excellent debugging | Single browser (Chromium), slow, poor mobile | Smaller teams, legacy apps |
| **Vitest + Playwright** | Fast unit+integration, Playwright for full E2E | Two tools to maintain | Vercel, Nuxt, Astro |
| **Testing Library + Vitest** | Fast, tests behavior not implementation | No real browser | Shadcn, Radix, Tailwind Labs |

**Vercel's actual recommendation for Next.js apps:**
Vercel's internal tooling and Next.js repo itself use **Vitest for unit/integration** + **Playwright for E2E**. The Next.js repo has ~0 Playwright E2E tests and hundreds of Vitest unit tests. For a Next.js app like Spotter, this is the winning combo.

**Verdict: Playwright is correct for Spotter's web E2E** — multi-browser, auto-waiting, best-in-class locators. The current implementation just needs fixing, not replacement.

### Mobile UI Testing — React Native / Expo

| Tool | Pros | Cons | Who Uses It |
|------|------|------|-------------|
| **Detox** | Most mature RN E2E, grey-box, stable | Hard setup, RN-specific, poor Expo support | Airbnb (legacy), Walmart, Wix |
| **Waldo** | No-code, visual AI, easy | Expensive, not scriptable, no CI | Non-engineers, rapid QA |
| **Appium** | Universal, any platform | Slow, flaky, complex | Cross-platform legacy apps |
| **Maestro** | YAML-based, simple, fast | Newer, less mature | Flying Tiger, smaller apps |
| **Playwright (Mobile)** | Cross-platform, familiar | Web context only, no native | Web-view-heavy apps |
| **Vitest + Testing Library** | Fast unit tests | No real UI | All RN/Expo apps |

**For Expo specifically:**
- **Maestro** is the recommended tool by Expo team (2024+) — it's built for mobile-first, works with Expo, YAML-based, and supports real device + emulator
- **Detox** is effectively deprecated for Expo after SDK 48+ due to native module complexity
- **Waldo** is great but expensive and not engineer-friendly

**Verdict for Spotter Mobile:**
- **Phase 1:** Vitest unit/integration tests (already exist, just needs expansion)
- **Phase 2:** Maestro for smoke tests (simple YAML, fast, Expo-friendly)
- **Avoid Detox** — too much setup pain for marginal benefit

### Golf Apps Competitive Intelligence

No public data on TheGrint or 18Birdies' testing stacks. But general patterns for consumer golf apps:
- Heavy mocking of third-party APIs (golf course APIs, tee time systems)
- Auth flows tested with real Supabase auth in staging tenants
- Stripe payments mocked in test environments (Stripe test mode + webhooks)
- Most QA is manual + screenshot-based for visual regression

---

## 3. Recommended Tools

### Web: Keep Playwright, Fix the Implementation

| Component | Current | Recommended | Why |
|-----------|---------|-------------|-----|
| Test runner | Playwright (as test runner) | Playwright + Vitest for unit | Separate concerns |
| Auth | UI login flow in `auth.setup.ts` | **Supabase admin API + direct DB insert** | 10x faster, no UI dependency |
| Browser scope | 6 projects (3 desktop + 3 mobile) | **2 projects: Chromium + Mobile Chrome** | Cut CI time by 60% |
| Test IDs | Ad-hoc `data-testid` | **Enforce via lint rule + codegen** | Consistency |
| CI execution | None | GitHub Actions matrix | — |
| Reporting | HTML/JSON | Allure + GitHub PR comments | Better DX |

### Mobile: Maestro for E2E, Keep Vitest for Unit

| Component | Current | Recommended | Why |
|-----------|---------|-------------|-----|
| Unit tests | Vitest | Keep + expand | Already working |
| E2E | Detox (broken) | **Maestro** | Expo-native, YAML, fast |
| Visual testing | None | **Playwright screenshots** (web only) | No good mobile solution |
| CI | None | GitHub Actions + Firebase Test Lab | Real devices |

---

## 4. Critical Flows to Cover (Priority Order)

### Tier 1 — P0 (Must have before any release)

1. **Sign up → Login → Dashboard**
   - New user registration flow
   - Email verification (mocked)
   - Login with existing credentials
   - Dashboard renders correctly

2. **Discovery → View Profile → Send Connection Request**
   - Golfers appear in discovery
   - Profile modal/page opens
   - Connection request sent
   - Request appears in Inbox

3. **Create a Round → Invite Members → View Round**
   - Round creation form (tier limits enforced)
   - Same-tier visibility enforcement
   - Invitation flow
   - Round detail view

### Tier 2 — P1 (Before public launch)

4. **Upgrade Tier (FREE → SELECT → SUMMIT)**
   - Tier comparison page
   - Stripe Checkout redirect (mocked)
   - Post-upgrade UI reflects new tier
   - Tier-gated content unlocks

5. **Coach Request Flow**
   - Browse coaches
   - Submit coaching request
   - Request confirmation

### Tier 3 — P2 (Before v1.0)

6. **Organizer Portal — Create Event**
7. **Inbox — Accept/Decline Invitations**
8. **Profile Edit — Handicap, Photos**
9. **Notifications — Round reminders, connection responses**

---

## 5. Test Data Strategy

### Auth — Don't Use UI Login

The current `auth.setup.ts` does:
```
goto /login → fill email/password → click Sign In → waitForURL → save storageState
```

This is slow and fragile. **Replace with Supabase Admin API approach:**

```typescript
// playwright/tests/fixtures/auth.setup.ts — NEW APPROACH
import { createClient } from '@supabase/supabase-js';

const supabase = createAdminClient();

async function seedTestUser(tier: 'free' | 'select' | 'summit') {
  // 1. Create user via Supabase Admin API (bypasses UI)
  const { data: authUser } = await supabase.auth.admin.createUser({
    email: `test-${tier}@spotter-test.local`,
    password: 'TestPassword123!',
    email_confirm: true,
  });

  // 2. Insert into profiles table with correct tier
  await supabase.from('profiles').upsert({
    id: authUser.user!.id,
    tier,
    onboarding_completed: true,
    // ... required fields
  });

  // 3. Return credentials
  return { email: authUser.email, password: 'TestPassword123!' };
}

// Use in test:
// const { email, password } = await seedTestUser('select');
// (no UI login needed — use storageState or cookie directly)
```

**Key points:**
- Use Supabase Service Role key (never exposed to client) in test fixtures
- Seed test users once per test file, not per test
- StorageState approach still works but with pre-authenticated sessions
- Delete users after test suite via `afterAll` hook

### Test Tenants

| Environment | Purpose | Auth Strategy |
|-------------|---------|---------------|
| `localhost:54321` | Local dev | Supabase local Docker |
| `staging.supabase.io` | CI + preview | Test tenant per branch |
| `spotter-test` | Production mirror | Read-only seed data |

**Recommended:** Use **branch-based test tenants** on Supabase. Each PR gets a fresh Supabase branch with pre-seeded test data. The `SUPABASE_TEST_BRANCH` env var determines which tenant to use.

### Seeding Strategy

```typescript
// playwright/tests/fixtures/seed.ts
export async function seedDatabase(tier: 'free' | 'select' | 'summit') {
  const supabase = getTestSupabaseClient();

  // Clean slate
  await supabase.from('profiles').delete().neq('id', '00000000-0000-0000-0000-000000000000');

  // Seed golfers
  const golfers = await seedGolfers(supabase, 10, tier);

  // Seed rounds
  const rounds = await seedRounds(supabase, golfers);

  // Seed connections
  await seedConnections(supabase, golfers);

  return { golfers, rounds };
}
```

### Stripe Payments — Mock, Don't Test Live

```typescript
// Mock Stripe Checkout redirect
await page.route('**/checkout.stripe.com/**', route => {
  // Parse session ID from URL
  const url = new URL(route.request().url());
  const sessionId = url.searchParams.get('session_id');

  // Redirect back with success
  route.fulfill({
    status: 303,
    headers: { location: `/upgrade/success?session_id=${sessionId}` }
  });
});

// Or use Stripe's test mode webhook mocking
```

---

## 6. CI Pipeline — Fastest Approach (<5 min per PR)

### Current CI (Broken)

```
ci.yml:
  - lint
  - typecheck
  - unit tests
  - NO E2E TESTS
```

### Recommended CI Pipeline

#### PR-Level Tests (<5 min target)

```
┌─────────────────────────────────────────────────────────┐
│  Lint + Typecheck (parallel)          ~1 min            │
├─────────────────────────────────────────────────────────┤
│  Unit Tests (Vitest)                  ~1 min            │
├─────────────────────────────────────────────────────────┤
│  Web E2E — Chromium Only              ~2 min           │
│  (skip: Safari, Firefox, WebKit)                          │
│  (skip: auth setup — use Supabase admin API)             │
├─────────────────────────────────────────────────────────┤
│  Mobile Unit Tests (Vitest)         ~1 min              │
└─────────────────────────────────────────────────────────┘
Total: ~5 min
```

#### Nightly Tests (Full Suite, no time pressure)

```
- Full Playwright: 3 browsers × mobile
- Mobile Maestro: Full smoke suite
- Lighthouse CI: Performance budget
- Stripe integration: Live test mode
```

#### Parallelization Strategy

```yaml
# .github/workflows/e2e.yml
jobs:
  web-e2e:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        browser: [chromium]  # Only chromium for PR
        shard: [1, 2, 3]     # Split tests across 3 parallel jobs
    steps:
      - run: pnpm playwright test --project=${{ matrix.browser }} --shard=${{ matrix.shard }}/3

  mobile-unit:
    runs-on: ubuntu-latest
    steps:
      - run: pnpm --filter=mobile vitest run
```

#### What to Mock vs. Test Real

| Component | Strategy | Why |
|-----------|----------|-----|
| Supabase Auth | **Real (admin API)** | Auth logic must be real |
| Supabase Database | **Real (test tenant)** | Data integrity |
| Stripe Checkout | **Mock (route interception)** | Don't test Stripe's checkout |
| Stripe Webhooks | **Mock (local webhook simulator)** | Deterministic |
| Email (Resend) | **Mock (check DB only)** | Don't send real emails |
| Geolocation/Course API | **Mock** | External API, non-deterministic |
| External Golf APIs | **Mock** | Rate limits, costs |

#### GitHub Actions Secrets for Tests

```bash
# .github/workflows/e2e.yml — required secrets
SUPABASE_TEST_URL=https://xxx.supabase.co
SUPABASE_TEST_ANON_KEY=eyJxxx
SUPABASE_TEST_SERVICE_KEY=eyJxxx  # Only in CI, never committed
STRIPE_TEST_PUBLISHABLE_KEY=pk_test_xxx
STRIPE_TEST_SECRET_KEY=sk_test_xxx
```

---

## 7. Recommended Implementation Order

Fox should build in this order:

### Phase 1: Fix Web E2E Auth (Week 1)

1. **Replace `auth.setup.ts`** — swap UI login for Supabase admin API seeding
2. **Add `data-testid` lint rule** — enforce test IDs on all interactive elements
3. **Prune browser projects** — drop Firefox, WebKit, iOS Safari from default run; keep Chromium + Mobile Chrome only
4. **Add E2E to CI** — wire Playwright into `.github/workflows/e2e.yml`

**Deliverable:** PR with passing E2E tests in CI, auth setup under 30 seconds

### Phase 2: Write P0 Critical Path Tests (Week 2)

1. **Sign up → login → dashboard** — 5 tests covering the happy path + validation
2. **Discovery → profile → connection** — 5 tests
3. **Create round → invite → view** — 5 tests

**Deliverable:** All P0 flows covered with passing tests

### Phase 3: Tier Upgrade + Coach Flow Tests (Week 3)

1. **Upgrade tier flow** — Stripe mock, post-upgrade verification
2. **Coach request flow** — 3-5 tests

**Deliverable:** All P1 flows covered

### Phase 4: Mobile Testing Foundation (Week 4)

1. **Install Maestro** — `npm install -g @maestro-cli/maestro`
2. **Write 5-10 Maestro YAML flows** — P0 mobile paths
3. **Wire into GitHub Actions** — Android emulator + iOS simulator

**Deliverable:** Mobile smoke tests running in CI

### Phase 5: Visual Regression + Reporting (Week 5+)

1. **Add Playwright screenshot diffing** — catch UI regressions
2. **Allure reports** — replace JSON reporter
3. **GitHub PR comments** — post test results on PRs

---

## Appendix: Test ID Enforcement

Add to ESLint config:

```json
{
  "rules": {
    "jsx-a11y/interactive-supports-focus": "error",
    "testing-library/await-async-query": "error",
    "testing-library/prefer-screen-queries": "warn"
  }
}
```

Require `data-testid` on all clickable elements via custom ESLint rule or codegen from Figma component names.

---

## Summary for Michael

| Area | Decision |
|------|----------|
| Web E2E | **Keep Playwright**, fix auth + prune browsers |
| Mobile E2E | **Maestro** over Detox (Expo-friendly, simple) |
| Auth in tests | **Supabase admin API** (no UI login) |
| Test data | **Branch-based Supabase tenants** per PR |
| Mobile unit | **Keep Vitest** (already works) |
| Stripe | **Mock** (don't test Stripe) |
| CI goal | **<5 min** via parallelization + browser pruning |
| First fix | Auth setup → 10x speed improvement |

Fox has everything needed to implement. Start with Phase 1.

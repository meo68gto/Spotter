# All Night Auto Research — Final Verification for Spotter

**Date:** 2026-03-29
**Agent:** J'onn J'onzz
**Status:** Final Check Complete

---

## 1. The Skill

The Karpathy-style loop requires:
- One editable **target file**
- One **read-only eval criteria** (binary yes/no questions, 3-6 items)
- One **read-only instruction file**
- The agent touches **only the target file** each round

---

## 2. Eval Criteria Setup — Status

### ✅ `trust.test.ts` — EXISTS (packages/types/src/)
- **139 lines**, 30+ test cases
- Covers `calculateDiscoveryBoost()`, `getReliabilityLabel()`, type guards, and config validation
- **Pass rate:** 100% (all tests green)
- **Exit code:** `0` (clean)

### ❌ `matching.test.ts` — EXISTS BUT BROKEN
- Location: `apps/functions/tests/matching.test.ts`
- Fails to load `npm:@supabase/supabase-js@2` — **not safe as an eval target**
- Cannot be run standalone with `pnpm vitest run`

### ❌ `tier.test.ts` — **DOES NOT EXIST**
- `packages/types/src/tier.ts` (531 lines) has **no test file**
- However, `apps/web/src/__tests__/tier-access.test.ts` exists (46 tests) and covers `hasAccess`, `canSeeTier`, `getVisibleTiers` from `@spotter/types` — ✅ uses the package correctly

---

## 3. CI Gate — Does `pnpm vitest run` Return Clean Exit Codes?

### ✅ Web (73 tests) — **CLEAN**
```
pnpm --filter web test  →  EXIT_CODE: 0
```
All 73 tests pass, 259ms, no failures.

### ✅ Web-Admin (17 tests) — **CLEAN**
```
pnpm --filter web-admin test  →  EXIT_CODE: 0
```
All 17 tests pass, 210ms, no failures.

### ⚠️ Functions (matching.test.ts, booking-flow.e2e.test.ts) — **FAILS**
```
Error: Failed to load url npm:@supabase/supabase-js@2
EXIT_CODE: 1
```
Two test suites fail due to missing Supabase module resolution. These are excluded from a safe loop.

### ⚠️ `@spotter/types` — **NO TEST SCRIPT**
```
package.json: "test": "echo 'No tests yet for @spotter/types'"
EXIT_CODE: 0 (but does nothing)
```
Victor wrote `trust.test.ts` but never wired it into the package's test script. **This is a gap.**

---

## 4. Target File Assessment

### Option A: `packages/types/src/trust.ts` (473 lines)
- ✅ Has a companion test file (`trust.test.ts`, 139 lines)
- ✅ Tests are binary pass/fail
- ✅ Pure TypeScript, no external dependencies
- ✅ Changes can't break downstream (no DB calls, no API calls)
- ✅ Very fast (<1 second to run)
- ❌ But: `trust.test.ts` is not wired into any `pnpm vitest run` call
  - Cannot run via `pnpm --filter @spotter/types test` (echoes "No tests yet")
  - Can only run directly from `apps/web` via workspace import
  - **This is the critical problem:** The eval script can't reliably invoke the test

### Option B: `apps/web/src/__tests__/organizer.test.ts` (17 tests)
- ✅ Part of the web app, covered by `pnpm --filter web test`
- ✅ Binary pass/fail, exit code 0
- ✅ Very fast (<300ms)
- ❌ Target file is `organizer.ts`, but it's in Next.js app directory — changes could affect routing, layout, or server-side behavior
- ⚠️ Single-file constraint is harder to maintain for a large component file

### Option C: `apps/web/src/__tests__/tier-access.test.ts` (46 tests)
- ✅ Part of the web app, covered by `pnpm --filter web test`
- ✅ Tests `hasAccess`, `canSeeTier`, `getVisibleTiers` from `@spotter/types`
- ✅ Binary pass/fail, exit code 0
- ✅ Very fast (<300ms)
- ✅ **Target would be `packages/types/src/tier.ts`** — pure business logic, isolated
- ⚠️ `tier.ts` has no companion unit test, but the 46 web-level tests exercise it

---

## 5. The Loop's Constraint — What Could Go Wrong Even With Perfect Tests?

Even with a clean binary eval, these risks remain:

### Risk 1: Test Coupling to Implementation Details
The loop agent will discover which specific code paths satisfy the tests. If tests check intermediate values (e.g., `reliabilityScore === 85` instead of `reliabilityLabel === 'Reliable'`), the agent may optimize for those exact values rather than the intended behavior.

### Risk 2: Type Coercion Edge Cases
TypeScript's type system isn't enforced at runtime. An agent could pass all tests while introducing type violations that only surface in the actual app at runtime (e.g., passing `undefined` where a `ReliabilityLabel` is expected).

### Risk 3: Trust Logic Has Second-Order Effects
`trust.ts` calculates `discoveryBoost` multipliers used in matching. Even if all trust tests pass, a subtly wrong formula change could silently degrade discovery for certain users. The tests cover the math, not the downstream business outcome.

### Risk 4: The Eval Script Itself Isn't Isolated
If the eval criteria file is in the same repo and the agent can somehow influence how tests are selected or how exit codes are interpreted, the loop could game the eval rather than genuinely improving the code.

### Risk 5: Untested Public API Surface
`trust.ts` exports ~15+ functions. `trust.test.ts` covers 4 (`calculateDiscoveryBoost`, `getReliabilityLabel`, and 4 type guards). The untested 11+ functions could be silently broken.

---

## 6. Final Recommendation

### 🟡 **CONDITIONAL — DO NOT RUN ON trust.ts YET**

**The core blocker:** `trust.test.ts` exists but is **not wired into any package test command**. There is no reliable way to invoke it as a standalone eval. The `@spotter/types` package's `"test"` script is an `echo`. The functions tests that import trust are broken. 

### What Victor Needs to Fix First

Before running the loop, these must be done:

1. **Add a vitest config to `@spotter/types`** with `src/**/*.test.ts` include, then update the test script to `vitest run`
2. **Fix the functions test suite** — `matching.test.ts` and `booking-flow.e2e.test.ts` fail on Supabase import resolution
3. **Add 3-6 binary eval criteria** for trust.ts (even while Victor fixes the test wiring)

### Once Fixed — Recommended Safe Target

**`packages/types/src/tier.ts`**

| Criterion | Status |
|-----------|--------|
| Binary yes/no eval | ✅ `tier-access.test.ts` (46 tests, fast, clean exit) |
| Single file target | ✅ `tier.ts` (531 lines, isolated logic) |
| No downstream deps broken | ✅ Pure shared package, no DB calls |
| Fast iteration | ✅ <1 second per round |
| No broken test suites | ✅ `pnpm --filter web test` returns EXIT 0 |

**Eval criteria for `tier.ts` (example):**
```
- Does hasAccess( tier, 'huntMode') return correct value for all tiers?
- Does canSeeTier compare actual vs requested tier correctly?
- Does getVisibleTiers exclude tiers above the user's tier?
- Are TIER_LIMITS values all positive integers?
- Does tier.ts export no new functions without corresponding test coverage?
```

### What Could Still Go Wrong

- **Business logic drift:** The loop may find local optima that technically satisfy tests but violate product intent
- **Type safety:** TypeScript types aren't runtime-checked; a bad cast could pass all tests
- **Discoverability regression:** Changes to `tier.ts` could break features Victor hasn't written tests for yet

### Safeguards to Implement

1. **Before the loop:** Write and commit the eval criteria file as read-only before starting
2. **Watch the diff:** Review `git diff --stat` each morning — don't let the loop make more than 5-10 commits in one night without a human check
3. **Cap rounds:** Set a hard stop at 20 rounds max; if nothing meaningful improved by round 20, the target isn't fruitful
4. **Snapshot baseline:** Commit a known-good `tier.ts` snapshot before starting, so you can `git checkout` back instantly
5. **Separate concern:** Run only on `packages/types/` — not on `apps/web/` or `apps/functions/` where larger blast radius exists

---

## Summary Table

| Question | Answer |
|----------|--------|
| Is the loop infrastructure ready? | 🟡 Partially — test files exist, but @spotter/types test script isn't wired |
| Is there a safe target file? | ✅ `packages/types/src/tier.ts` — once Victor fixes the test runner |
| Does CI return clean exit codes? | ✅ `web` and `web-admin` yes; `functions` no (broken Supabase import) |
| Is the single-file constraint safe? | ⚠️ Safe in isolation, but type/runtime gaps remain |
| **Recommendation** | **CONDITIONAL — fix the test wiring first, then run on tier.ts only** |

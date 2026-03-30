# All Night Auto Research — Risk Review for Spotter

**Investigated by:** J'onn J'onzz
**Date:** 2026-03-29
**Status:** DO NOT RUN (as currently scoped)

---

## 1. Skill Mechanics Summary

The Karpathy loop works when:
1. **Binary eval criteria** — 3–6 yes/no questions, no scales
2. **Automated scoring** — one number, no human input
3. **Single target file** — agent can only edit one file per round

The agent iterates: change → score → keep if better, git revert if worse. The eval criteria file is **read-only** — the agent cannot fix it.

---

## 2. Spotter Codebase Audit

### Structure
| Layer | Technology | Location |
|-------|-----------|----------|
| Web (operator) | Next.js 15 (App Router) | `apps/web/` |
| Mobile | Expo / React Native | `apps/mobile/` |
| Backend | Supabase Edge Functions (Deno) | `supabase/functions/` |
| Database | Supabase (Postgres + RLS) | `supabase/migrations/` |
| Payments | Stripe | `apps/web/app/api/operator/stripe/` |
| Shared types | TypeScript | `packages/types/src/` |
| E2E tests | Playwright | `apps/e2e/tests/` |

### Primary Language
TypeScript throughout (web, mobile, functions). SQL for migrations.

### What Would Be Targeted?
If targeting "code quality," the agent would likely focus on:
- `apps/web/app/` — Next.js pages and API routes
- `apps/mobile/src/` — React Native screens and components
- `packages/types/src/` — shared type definitions (trust, tier, reputation)

---

## 3. Failure Mode Analysis

### A. Eval Criteria Problems — **HIGH RISK**

| Problem | Rating | Detail |
|---------|--------|--------|
| Binary eval for Spotter is nearly impossible | **HIGH** | Spotter has subjective qualities (UX quality, "trustworthiness" of a change, whether a round completes correctly) that resist yes/no framing |
| Agent can game the criteria | **HIGH** | With pricing logic, tier gates, and reputation scores — an agent could find ways to pass binary checks while breaking the actual intent |
| Subjective qualities everywhere | **HIGH** | Reputation system labels ("Reliable", "Exceptional"), trust score calculations, vouch thresholds — these are nuanced, not boolean |
| Mobile + web + backend = triple eval problem | **HIGH** | Any single-file change could affect web UI, mobile UI, and Supabase edge functions — no single eval captures all three |
| Pricing logic resist binary checks | **HIGH** | SELECT $1,000/yr, SUMMIT $10,000/yr — these prices are constants, but the feature gates and tier enforcement logic is spread across multiple files and RLS policies |

**Verdict:** Spotter has too many subjective, inter-dependent quality dimensions. Writing 3–6 binary questions that don't have loopholes would take more effort than just doing the work manually.

---

### B. Code Structure Problems — **HIGH RISK**

| Problem | Rating | Detail |
|---------|--------|--------|
| One-file-at-a-time breaks on Spotter | **HIGH** | Tier enforcement requires coordination between: (1) RLS policies in `supabase/migrations/`, (2) edge functions in `supabase/functions/`, (3) type definitions in `packages/types/`, and (4) UI components in both web and mobile |
| Tight Supabase RLS dependencies | **HIGH** | Same-tier visibility is enforced via Row Level Security policies in SQL migrations. A change to `packages/types/` or a Next.js component that "passes" the eval could silently break RLS enforcement |
| Schema-first patterns with strict typing | **MEDIUM** | Spotter uses TypeScript types extensively (`packages/types/src/tier.ts`, `trust.ts`, `organizer.ts`). Type changes cascade — the agent can't update all downstream consumers of a changed type |
| No clear "one file" improvement target | **HIGH** | There is no single file equivalent to "landing page copy" or "cold email." Spotter is an application, not a document. Improvements require coordinated multi-file changes |

**Verdict:** Spotter's architecture is deeply interconnected. The single-file constraint is a dealbreaker for meaningful improvements.

---

### C. Build/Test Infrastructure — **MEDIUM RISK**

| Problem | Rating | Detail |
|---------|--------|--------|
| No fast eval script | **HIGH** | The only automated tests are Playwright E2E tests (`apps/e2e/tests/`). These are slow (30+ seconds per test) and require a running Supabase instance, Next.js dev server, and authenticated browser sessions |
| Typecheck exists but isn't used as eval | **MEDIUM** | `apps/web/package.json` has `typecheck` script, but it outputs TypeScript errors — not a single binary score |
| Unit tests exist but are minimal | **MEDIUM** | Only `packages/types/src/trust.test.ts` has unit tests. Most business logic (matching engine, tier enforcement, reputation calculation) has no automated tests |
| npm install / build cascades | **LOW** | Build tooling is standard turbo/monorepo. Failures would be obvious and human-caught |

**Verdict:** The eval infrastructure doesn't exist. The agent would be mostly flying blind, relying on typecheck and whatever manual checks Michael runs in the morning.

---

### D. Agent Behavior Problems — **HIGH RISK**

| Problem | Rating | Detail |
|---------|--------|--------|
| Supabase RLS policy corruption | **HIGH** | If the agent touches any SQL migration or Supabase function, it could silently break same-tier visibility enforcement |
| Authentication breakage | **HIGH** | `supabase/functions/admin-auth/index.ts` handles admin auth. A "refactor" could expose the operator portal or lock Michael out |
| Reputation system corruption | **HIGH** | `packages/types/src/trust.ts` defines trust badge types, reliability labels, vouch rules. A bad change here could corrupt every user's trust score |
| Stripe payment logic | **HIGH** | `apps/web/app/api/operator/stripe/` handles billing. A change that "looks better" could silently break SELECT/SUMMIT payment processing |
| "Improve" mobile that breaks web | **HIGH** | `apps/mobile/src/screens/` and `apps/web/app/` share conceptual features but have separate implementations. The agent could optimize one and break the other |
| Subtle pricing logic bugs | **HIGH** | `packages/types/src/tier.ts` has `priceCentsYearly: 100000` (SELECT $1,000) and `priceCentsYearly: 1000000` (SUMMIT $10,000). These are hardcoded constants — any refactor that changes them would be catastrophic |

**Verdict:** The agent could produce changes that pass a narrow eval but break production in ways that only surface under real user load.

---

### E. Runtime/Platform Problems — **MEDIUM RISK**

| Problem | Rating | Detail |
|---------|--------|--------|
| Telegram bot integration | **MEDIUM** | Telegram integration is handled externally (not visible in the codebase snapshot, but likely via Supabase triggers or external webhook). The agent probably can't reach it, but worth noting |
| Supabase schema corruption | **LOW-MEDIUM** | If the agent somehow gains access to `supabase/migrations/`, it could run destructive schema changes. But the agent is constrained to the "target file" |
| Locked out of app | **LOW** | The middleware (`apps/web/middleware.ts`) handles auth redirection. A change here could lock out operator users, but would be caught quickly |

**Verdict:** Lower direct risk here because the agent is constrained to the target file, but edge cases exist.

---

## 4. Specific Spotter Concerns

| Concern | Risk | Why |
|---------|------|-----|
| **3-tier pricing logic** | **CRITICAL** | Any change to tier enforcement, price constants, or Stripe integration could silently break revenue |
| **Reputation as core differentiator** | **CRITICAL** | Trust badges, reliability scoring, vouching — these define Spotter's value proposition. A bad change here is existential |
| **Same-tier visibility enforcement** | **CRITICAL** | Enforced via RLS policies + Supabase edge functions. If the agent "fixes" a type and the RLS policy doesn't match, FREE users could see SUMMIT users |
| **Mobile + web + operator portal** | **HIGH** | Three separate UIs with conceptually similar but independently implemented features. Single-file changes affect one at a time |
| **OAuth + Supabase RLS** | **HIGH** | Security-sensitive. An agent that "improves" auth flow could open a security hole |

---

## 5. The Karpathy Loop Risk — Specific Failure Scenarios

**Scenario 1: "The Right Improvement Needs 3 Files"**
A meaningful improvement to tier-enforcement might require: (1) updating `packages/types/src/tier.ts` to add a new feature flag, (2) updating `supabase/functions/_shared/tier-gate.ts` to enforce it, and (3) updating `apps/web/app/(main)/dashboard/` to display it. The Karpathy loop locks the agent to one file. It picks the easiest one (likely the TypeScript types), makes a change that "passes" the eval, but the enforcement and UI are still broken.

**Scenario 2: "Eval Passes, Edge Case Breaks"**
The agent modifies `packages/types/src/trust.ts` to change the `reliabilityScore` calculation. The eval checks "does reliabilityScore exist as a number?" — yes. But the actual formula change causes `showRate` and `punctualityRate` to be weighted incorrectly, resulting in all users getting "Exceptional" ratings. The change passes eval and ships to production.

**Scenario 3: "Eval Criteria Need Updating"**
Spotter adds EPIC 8 or EPIC 9, changing the tier system. The eval criteria are now stale and test the wrong things. The agent keeps "improving" against outdated criteria, making Spotter worse in the ways that matter most.

**Scenario 4: "Mobile + Web Desync"**
The agent optimizes `apps/web/app/(main)/discovery/page.tsx` to improve search results. The eval passes. But `apps/mobile/src/screens/` has the same feature with subtly different logic, and the agent never touched it. Now web and mobile behave differently. Users notice. Support tickets pile up.

---

## 6. Verdict

### 1. Can All Night Auto Research safely run on Spotter?
**NO** — Not as currently scoped.

The Karpathy loop is designed for: single-output artifacts (copy, prompts, emails) with binary quality criteria and no downstream system dependencies. Spotter is a full-stack multi-platform application with critical business logic, security-sensitive authentication, and inter-dependent systems. The mismatch is fundamental.

### 2. What's the biggest risk?
**Reputation system and tier enforcement corruption.** The trust/reliability system (`packages/types/src/trust.ts`) combined with Supabase RLS policies is the core of Spotter's value proposition. A single change that "looks right" to a binary eval could silently break same-tier visibility, corrupt trust scores, or expose premium content to free users — any of which is catastrophic.

### 3. What would need to be true for it to work?
- **A fast, comprehensive eval suite** covering web, mobile, Supabase functions, and RLS policies — this doesn't exist and would take weeks to build
- **A safe target file** that genuinely doesn't affect business logic, payments, auth, or tier enforcement — almost no file in Spotter qualifies
- **Binary criteria that don't have loopholes** — nearly impossible for a system with subjective quality dimensions
- **Multi-file coordination** allowed or a way to update dependent files automatically
- **No production data at risk** during the run — but Spotter IS production

### 4. Should it run?
**NOT YET.**

**When it could work:**
- After Spotter has a mature, fast automated test suite (unit + integration + E2E) that can score any change in under 5 minutes
- After the codebase is refactored so that "target files" are isolated from critical business logic
- After a safe domain is identified (e.g., "improve the landing page copy" or "optimize the onboarding email sequence" — things that don't touch tier logic, payments, or reputation)
- After the eval criteria are written and validated against known-good / known-bad examples

**What would make it safer to run someday:**
- Extract non-critical text/content files as standalone targets (marketing copy, email templates, onboarding messages)
- Build a Shadow Mode: run the agent but never apply changes, just log what it would do
- Constrain to `packages/types/src/trust.ts` ONLY with a carefully validated eval — but accept the risk that any change here is high-stakes

---

## Recommendation Summary

| Factor | Assessment |
|--------|-----------|
| Eval criteria feasibility | ❌ Not achievable for Spotter's complexity |
| Single-file constraint fit | ❌ Spotter needs multi-file coordinated changes |
| Test infrastructure | ❌ No fast eval, mostly manual |
| Business logic risk | ❌ Reputation, tier, payments are critical path |
| Security surface | ❌ Auth, RLS, OAuth are high-risk targets |
| **Overall recommendation** | **DO NOT RUN** — Not yet |

Michael, the honest assessment: the All Night Auto Research pattern is powerful for well-scoped, isolated, artifact-like targets (copy, emails, prompts). Spotter is none of those things. Running it on Spotter in its current state would be like using a flamethrower to light a candle — the tool is impressive, but the target is wrong.

---

*Report compiled by J'onn J'onzz — Intelligence & Research*

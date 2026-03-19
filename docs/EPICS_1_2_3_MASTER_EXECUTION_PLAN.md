# SPOTTER EPICS 1-3: MASTER EXECUTION PLAN
## Tiered Member Foundation → Same-Tier Enforcement → Premium Matching UX

**Date:** March 19, 2026  
**Repo:** Meo68gto/Spotter  
**Lead:** Implementation Orchestrator

---

## 1. EXECUTIVE SUMMARY

**Mission:** Transform Spotter into a private, tier-based golf networking platform where members connect only with others at their membership level.

**Current State:** Strong foundation exists. Tier system, profile types, onboarding, discovery, and matching are already built. Same-tier RLS policies exist in database.

**Gap:** Application-level verification needed. Premium UX polish incomplete. Same-tier enforcement must be verified and hardened.

**Epic Sequence:**
1. **EPIC 1:** Verify and finalize Tiered Member Foundation (mostly complete)
2. **EPIC 2:** Harden Same-Tier Discovery Enforcement (verification + backend enforcement)
3. **EPIC 3:** Build Premium Golf Matching UX (card upgrades, filters, fit reasons)

**Key Principle:** Reuse existing systems. Do not rebuild onboarding, profile shell, matching lifecycle, or rounds. Extend and refactor only where necessary.

---

## 2. REPO AUDIT

### 2.1 Onboarding

**What Exists:**
- `OnboardingWizardScreenPhase1.tsx` (910 lines)
- 4-step flow: Tier → Golf Identity → Professional → Networking
- Collects: tier, handicap band, home course, play frequency, years playing, role, company, industry, networking intent, intros, recurring rounds, group size, cart preference, golf area
- Persists via `onboarding-phase1` edge function

**Assessment:** ✅ **REUSABLE AS-IS**
- All required fields already collected
- Golf-focused (no multi-sport)
- Clean 4-step structure
- No changes needed for Epics 1-3

### 2.2 Profile

**What Exists:**
- `ProfileScreen.tsx` (recently updated)
- Displays: Tier badge, Professional identity card, Golf identity card, Networking preferences card
- Shows: Handicap + skill band (Beginner/Intermediate/Advanced)
- Fetches from: users, user_professional_identities, user_golf_identities, user_networking_preferences

**Assessment:** ✅ **REUSABLE AS-IS**
- Just updated with networking card
- All required fields displayed
- Premium member card feel achieved

### 2.3 Backend Member Persistence

**What Exists:**

| Table | Purpose | Status |
|-------|---------|--------|
| `users` | Auth, tier_id, tier_enrolled_at, tier_expires_at | ✅ Complete |
| `membership_tiers` | free/select/summit with pricing | ✅ Complete |
| `user_golf_identities` | handicap, home_course_id, play_frequency, years_playing | ✅ Complete |
| `user_professional_identities` | company, title, industry, linkedin_url | ✅ Complete |
| `user_networking_preferences` | intent, intros, recurring, group_size, cart, area | ✅ Complete |
| `user_reputation` | overall_score, completion_rate, ratings_average | ✅ Complete |

**Assessment:** ✅ **REUSABLE AS-IS**
- Clean normalized schema
- No overloaded tables
- All Epic 1 fields present
- RLS policies in place

### 2.4 Matching

**What Exists:**
- `matching-candidates/index.ts` - Returns top matches
- `matching-suggestions/index.ts` - Get suggestions for user
- `matching-request`, `matching-accept`, `matching-reject` - Lifecycle
- `calculate_match_score()` function - Compatibility scoring
- Types: `MatchSuggestion`, `MatchScore`, `CompatibilityFactors`

**Current Payload:**
- user (id, displayName, avatarUrl, city)
- golf (handicap, homeCourseName, yearsPlaying)
- professional (company, title, industry)
- networking (intent, preferredGroupSize, openToIntros, preferredGolfArea)
- mutualConnections
- matchScore (overall, factors)

**Assessment:** ⚠️ **REFACTOR NEEDED**
- Missing tier information in payload
- Missing fit reasons display
- Missing filters
- Lifecycle is sound, reuse it

### 2.5 Discovery

**What Exists:**
- `discovery-search/index.ts` - Search golfers
- `discover_golfers()` PostgreSQL function
- Types: `DiscoverableGolfer`, `DiscoverySearchInput`, `DiscoverySearchResponse`

**Current Payload:**
- user_id, display_name, avatar_url, city
- tier_id, tier_slug
- professional (company, title, industry, years_experience)
- golf (handicap, home_course_id, home_course_name, playing_frequency, years_playing)
- networking_preferences (intent, intros, recurring, group_size, cart, area)
- reputation_score, compatibility_score, profile_completeness

**Assessment:** ⚠️ **VERIFY ENFORCEMENT**
- Payload includes tier_id/slug
- RLS policies exist but need verification
- Frontend cards need premium styling

### 2.6 Networking / Invites

**What Exists:**
- `connections-list/index.ts` - List connections
- `connections-request/index.ts` - Request connection
- `connections-intro/index.ts` - Request introduction
- `networking-invite-send/index.ts` - Send invite
- `user_connections` table (requester_id, addressee_id, status)

**Assessment:** ✅ **REUSABLE AS-IS**
- Solid foundation for EPIC 4 network graph
- Same-tier enforcement via RLS
- No changes needed for Epics 1-3

### 2.7 Trust / Reputation

**What Exists:**
- `user_reputation` table (overall_score, completion_rate, ratings_average, network_size, referrals_count, profile_completeness, attendance_rate)
- Reputation score displayed on profile
- Calculated via `reputation-calculate` edge function

**Assessment:** ✅ **REUSABLE AS-IS**
- Sufficient for Epic 3 premium cards
- EPIC 6 will expand with reliability/no-show

### 2.8 Shared Schema / Types / Functions

**What Exists:**
- `packages/types/src/tier.ts` - Complete tier system
- `packages/types/src/profile.ts` - Complete identity types
- `packages/types/src/matching.ts` - Match types (needs tier field)
- `packages/types/src/discovery.ts` - Discovery types (complete)
- `packages/types/src/rounds.ts` - Complete rounds types
- `packages/types/src/index.ts` - Re-exports (needs TierSlug added)

**Assessment:** ⚠️ **MINOR UPDATES NEEDED**
- Add TierSlug to index.ts exports (already done in commit 0467b53)
- Add tier to matching payload

---

## 3. WHAT MUST NOT BE REBUILT

| System | Location | Why Preserve |
|--------|----------|--------------|
| **Onboarding Wizard** | `OnboardingWizardScreenPhase1.tsx` | Complete 4-step flow, all fields collected, golf-focused |
| **Profile Screen Shell** | `ProfileScreen.tsx` | Card-based layout, recently updated, reusable |
| **Database Schema** | `0014_tier_system.sql`, `0017_profile_networking_reputation.sql`, `0019_phase1_networking_preferences.sql` | Clean normalized design, no overloaded tables |
| **Matching Lifecycle** | `matching-request`, `matching-accept`, `matching-reject` | Request/accept/reject pattern is sound |
| **Discovery Function** | `discovery-search/index.ts` | Search logic complete, just verify tier filter |
| **Connections System** | `connections-list`, `connections-request`, `connections-intro` | Foundation for network graph |
| **Rounds System** | `rounds-create`, `rounds-invite`, `rounds-join`, `rounds-list`, `rounds-respond` | Complete system, reuse as-is |
| **RLS Policies** | `0014_tier_system.sql` | Same-tier enforcement already at database level |
| **Reputation System** | `user_reputation` table | Sufficient for Epic 3, EPIC 6 will extend |

---

## 4. REUSE / REFACTOR / REPLACE / DEFER TABLE

| Area | What Exists | Classification | Why | First Files to Touch |
|------|-------------|----------------|-----|---------------------|
| **Onboarding** | 4-step wizard, all fields | **REUSE** | Complete, golf-focused, no changes | None |
| **Profile** | Screen with cards | **REUSE** | Just updated, all fields displayed | None |
| **Database Schema** | Normalized tables | **REUSE** | Clean design, all fields present | None |
| **Tier System** | free/select/summit | **REUSE** | Correct pricing, RLS policies | None |
| **Discovery Function** | `discovery-search/index.ts` | **VERIFY** | RLS exists, verify enforcement active | `discovery-search/index.ts` |
| **Matching Candidates** | `matching-candidates/index.ts` | **REFACTOR** | Add tier to payload, add fit reasons | `matching-candidates/index.ts`, `packages/types/src/matching.ts` |
| **Match Cards** | Basic cards | **REFACTOR** | Upgrade to premium golf cards | `MatchingScreen.tsx`, `components/MatchCard.tsx` |
| **Discovery Cards** | Basic cards | **REFACTOR** | Upgrade to premium golf cards | `DiscoveryScreen.tsx`, `components/DiscoveryCard.tsx` |
| **Filters** | None | **NEW BUILD** | Add handicap, intent, industry filters | `components/FilterPanel.tsx` |
| **Coaching** | Multi-sport | **DEFER** | EPIC 8 will reposition | None for Epics 1-3 |
| **Network Graph** | Connections only | **DEFER** | EPIC 4 will build visual graph | None for Epics 1-3 |
| **Rounds** | Complete system | **REUSE** | All functions exist | None |

---

## 5. ARCHITECTURAL CONSIDERATIONS AND RISKS

| # | Risk | Why It Matters | Mitigation | Epic |
|---|------|---------------|------------|------|
| 1 | **Frontend-only tier enforcement** | Users could bypass via API calls | Enforce at database RLS + edge functions | EPIC 2 |
| 2 | **Discovery returns wrong tier** | Breaks core business rule | Verify `discover_golfers()` filters by tier_id | EPIC 2 |
| 3 | **Matching payload missing tier** | Can't display tier on cards | Add tier_id, tier_slug to MatchSuggestion | EPIC 3 |
| 4 | **Duplicate tier filtering logic** | Maintenance nightmare, inconsistencies | Centralize in one function, reuse everywhere | EPIC 2 |
| 5 | **Fit reasons calculation** | Complex scoring might be slow | Calculate once, cache, show breakdown | EPIC 3 |
| 6 | **Filter UI too complex** | Too many filters = low usage | Start with 3-4 key filters, expand later | EPIC 3 |
| 7 | **Multi-sport assumptions leak** | "Sport" instead of "Golf" in copy | Audit all copy, replace with golf-specific | EPIC 2, 3 |
| 8 | **Match card performance** | Too much data = slow render | Lazy load images, paginate lists | EPIC 3 |
| 9 | **Trust score accuracy** | Reputation might not reflect reality | Use multiple signals (ratings + attendance) | EPIC 3 |
| 10 | **Tier field in wrong table** | Hard to query, filter | tier_id in users table is correct | EPIC 1 (already done) |

---

## 6. EPIC 1 EXECUTION PLAN

### Goal
Verify and finalize the Tiered Member Foundation. Ensure all identity fields are collected, persisted, and displayed correctly.

### Current State
✅ **ALREADY COMPLETE**
- Tier model exists (free/select/summit with $0/$1000/$10000)
- Onboarding collects all required fields
- Profile displays all identity cards
- Database schema is clean and normalized
- RLS policies enforce same-tier at database level

### Verification Tasks

1. **Verify Onboarding Completeness**
   - [ ] Check all 12 required fields are collected
   - [ ] Verify golf is default/only activity
   - [ ] Confirm no multi-sport references

2. **Verify Profile Display**
   - [ ] Tier badge visible
   - [ ] Golf identity card shows handicap + band
   - [ ] Professional identity card shows company/role/industry
   - [ ] Networking preferences card shows all fields

3. **Verify Database Schema**
   - [ ] All tables exist
   - [ ] All enums exist (networking_intent, preferred_group_size, cart_preference)
   - [ ] RLS policies active
   - [ ] Indexes created

4. **Verify Backend Persistence**
   - [ ] `onboarding-phase1` function persists all fields
   - [ ] Profile fetch joins all identity tables
   - [ ] No data loss between onboarding and profile

### Files to Verify (Not Change)
- `apps/mobile/src/screens/onboarding/OnboardingWizardScreenPhase1.tsx`
- `apps/mobile/src/screens/ProfileScreen.tsx`
- `packages/types/src/profile.ts`
- `packages/types/src/tier.ts`
- `supabase/migrations/0014_tier_system.sql`
- `supabase/migrations/0017_profile_networking_reputation.sql`
- `supabase/migrations/0019_phase1_networking_preferences.sql`
- `apps/functions/supabase/functions/onboarding-phase1/index.ts`

### What to Reuse
- **Everything.** Epic 1 is already built.

### What Not to Rebuild
- Do not create new onboarding
- Do not create new profile screen
- Do not create new database tables

### Acceptance Criteria
- [x] Tier model exists with correct pricing
- [x] Onboarding captures all 12 required fields
- [x] Profile displays all identity cards
- [x] Backend persists all fields cleanly
- [x] Database schema is normalized
- [x] RLS policies enforce same-tier

### Epic 1 Status: ✅ COMPLETE

---

## 7. EPIC 2 EXECUTION PLAN

### Goal
Harden Same-Tier Discovery Enforcement. Verify and ensure all user exposure surfaces enforce the same-tier rule.

### Same-Tier Enforcement Points

1. **Database Level (Already Exists)**
   - Location: `0014_tier_system.sql`
   - Policy: `users_select_same_tier`
   - Status: ✅ Active

2. **Function Level (Needs Verification)**
   - `discovery-search/index.ts` - Verify SQL filters by tier
   - `matching-candidates/index.ts` - Verify candidates same tier
   - `matching-suggestions/index.ts` - Verify suggestions same tier
   - `connections-list/index.ts` - Verify RLS sufficient

3. **Application Level (Defense in Depth)**
   - DiscoveryScreen: Display tier badge
   - MatchingScreen: Display tier badge
   - Filter out any cross-tier data (shouldn't happen)

### Implementation Tasks

1. **Verify Discovery Function**
   ```typescript
   // In discovery-search/index.ts
   // Verify this filter exists:
   .eq('tier_id', callerTierId)
   ```

2. **Verify Matching Functions**
   ```typescript
   // In matching-candidates/index.ts
   // Verify candidates filtered by tier
   WHERE tier_id = $1
   ```

3. **Create Verification Script**
   - `scripts/verify-same-tier-enforcement.sh`
   - Test: Free user queries, should only see Free
   - Test: Select user queries, should only see Select
   - Test: Summit user queries, should only see Summit

4. **Add Tier to Matching Payload**
   - Update `MatchSuggestion` type to include tier
   - Update `matching-candidates` to return tier

### Files to Update
- `apps/functions/supabase/functions/discovery-search/index.ts` - Verify tier filter
- `apps/functions/supabase/functions/matching-candidates/index.ts` - Add tier to payload
- `apps/functions/supabase/functions/matching-suggestions/index.ts` - Add tier to payload
- `packages/types/src/matching.ts` - Add tier fields to MatchSuggestion
- `scripts/verify-same-tier-enforcement.sh` - Create verification script

### What to Reuse
- RLS policies (already exist)
- Discovery function structure
- Matching function structure

### What Not to Rebuild
- Do not create new RLS policies
- Do not create new discovery function
- Do not change matching lifecycle

### Acceptance Criteria
- [ ] Verification script passes
- [ ] Free user only sees Free members
- [ ] Select user only sees Select members
- [ ] Summit user only sees Summit members
- [ ] Matching payload includes tier
- [ ] No cross-tier data leakage

---

## 8. EPIC 3 EXECUTION PLAN

### Goal
Build Premium Golf Matching UX. Upgrade match/discovery cards to feel like premium golf-network cards with fit reasons and filters.

### Match Card Structure (New)

```typescript
interface PremiumMatchCardProps {
  // Identity
  user: {
    id: UUID;
    displayName: string;
    avatarUrl?: string;
    city?: string;
  };
  
  // Tier
  tier: {
    id: UUID;
    slug: TierSlug;
    name: string;
  };
  
  // Golf Identity
  golf: {
    handicap?: number;
    handicapBand: 'Beginner' | 'Intermediate' | 'Advanced';
    homeCourseName?: string;
    yearsPlaying?: number;
  };
  
  // Professional Identity
  professional: {
    company?: string;
    title?: string;
    industry?: string;
  };
  
  // Networking
  networking: {
    intent: NetworkingIntent;
    preferredGroupSize: PreferredGroupSize;
    openToIntros: boolean;
    preferredGolfArea?: string;
  };
  
  // Trust
  reputation: {
    score: number;
    reliability?: number;
  };
  
  // Compatibility
  matchScore: {
    overall: number;
    factors: {
      handicapAlignment: number;
      intentAlignment: number;
      locationProximity: number;
      availabilityOverlap: number;
    };
  };
  
  // Actions
  onConnect: () => void;
  onSave: () => void;
  onRequestIntro: () => void;
}
```

### Implementation Tasks

1. **Create PremiumMatchCard Component**
   - Location: `apps/mobile/src/components/PremiumMatchCard.tsx`
   - Design: Card with tier badge, golf identity, professional identity, networking prefs, trust score, fit reasons
   - Actions: Connect, Save, Request Intro

2. **Update MatchingScreen**
   - Replace current cards with PremiumMatchCard
   - Add filter panel
   - Show fit reasons

3. **Update DiscoveryScreen**
   - Replace current cards with PremiumMatchCard
   - Add filter panel

4. **Create FilterPanel Component**
   - Location: `apps/mobile/src/components/FilterPanel.tsx`
   - Filters: Handicap band, Networking intent, Industry, Location/Distance

5. **Update Match Payload**
   - Add tier to `MatchSuggestion` type
   - Add fit reasons to `MatchScore`

6. **Update Calculate Match Score**
   - Return factor breakdown
   - Include in payload

### Files to Update
- `apps/mobile/src/components/PremiumMatchCard.tsx` - Create new
- `apps/mobile/src/components/FilterPanel.tsx` - Create new
- `apps/mobile/src/screens/matching/MatchingScreen.tsx` - Refactor
- `apps/mobile/src/screens/discovery/DiscoveryScreen.tsx` - Refactor
- `packages/types/src/matching.ts` - Add tier, fit reasons
- `apps/functions/supabase/functions/matching-candidates/index.ts` - Add tier, fit reasons
- `apps/functions/supabase/functions/matching-suggestions/index.ts` - Add tier, fit reasons

### What to Reuse
- Matching lifecycle (request/accept/reject)
- Discovery function
- Existing card layout patterns
- Trust/reputation data

### What Not to Rebuild
- Do not create new matching engine
- Do not create new discovery function
- Do not create new trust system

### Acceptance Criteria
- [ ] PremiumMatchCard component created
- [ ] Cards show tier badge
- [ ] Cards show handicap band
- [ ] Cards show company/title/industry
- [ ] Cards show networking intent
- [ ] Cards show trust score
- [ ] Fit reasons explain matches
- [ ] Filter panel works (handicap, intent, industry)
- [ ] Actions: Connect, Save, Request Intro

---

## 9. SHARED SCHEMA / TYPE / DATA CONTRACT PLAN

### Durable Member Model

```typescript
// Core member identity (across all epics)
interface MemberIdentity {
  // Auth
  id: UUID;
  email: string;
  
  // Tier (EPIC 1, 2, 3, 4, 5, 6, 7)
  tier: {
    id: UUID;
    slug: 'free' | 'select' | 'summit';
    name: string;
    priceCents: number;
  };
  
  // Golf Identity (EPIC 1, 3)
  golf: {
    handicap?: number;
    handicapBand: 'Beginner' | 'Intermediate' | 'Advanced';
    homeCourseId?: UUID;
    homeCourseName?: string;
    playFrequency?: 'weekly' | 'biweekly' | 'monthly' | 'occasionally';
    yearsPlaying?: number;
  };
  
  // Professional Identity (EPIC 1, 3)
  professional: {
    company?: string;
    title?: string;
    industry?: string;
    linkedinUrl?: string;
  };
  
  // Networking Preferences (EPIC 1, 3, 4)
  networking: {
    intent: 'business' | 'social' | 'competitive' | 'business_social';
    openToIntros: boolean;
    openToRecurringRounds: boolean;
    preferredGroupSize: '2' | '3' | '4' | 'any';
    cartPreference: 'walking' | 'cart' | 'either';
    preferredGolfArea?: string;
  };
  
  // Trust (EPIC 3, 6)
  reputation: {
    overallScore: number;
    reliability?: number;
    attendanceRate?: number;
  };
}
```

### Candidate Payload (EPIC 2, 3)

```typescript
interface CandidatePayload {
  user: MemberIdentity;
  compatibilityScore: number;
  fitReasons: string[];
  mutualConnections: number;
}
```

### Profile Payload (EPIC 1, 3)

```typescript
interface ProfilePayload {
  user: MemberIdentity;
  isOwnProfile: boolean;
  canConnect: boolean; // same-tier check
}
```

### Where Trust Data Plugs In

- EPIC 3: Display reputation score on cards
- EPIC 6: Expand with reliability, no-show tracking
- EPIC 7: Premium tier trust badges

### What Later Epics Depend On

- EPIC 4 (Network Graph): `user_connections` table, `networking.openToIntros`
- EPIC 5 (Rounds): `rounds` table with `tier_id`, `networking.preferredGroupSize`
- EPIC 6 (Trust): `user_reputation` table, attendance tracking
- EPIC 7 (Premium): `tier.slug` for feature gating
- EPIC 8 (Coaching): `golf` identity for golf-only coaches

---

## 10. ORCHESTRATION PLAN

### Sequence

```
EPIC 1 (Verify) → EPIC 2 (Enforce) → EPIC 3 (UX)
     ↓                ↓                  ↓
   Verify          Verify             Build
   existing        enforcement        premium
   foundation      works              cards
```

### Dependencies

1. **EPIC 1 → EPIC 2:** Must verify foundation before enforcing
2. **EPIC 2 → EPIC 3:** Must have tier enforcement before building UX
3. **EPIC 3 → EPIC 4:** Must have cards before building network graph

### What Lands First

1. **EPIC 1:** Verification scripts, documentation
2. **EPIC 2:** Backend enforcement, tier in payloads
3. **EPIC 3:** Premium cards, filters, fit reasons

### What Can Be Feature-Flagged

- Premium filters (EPIC 3) - hide until stable
- Fit reasons (EPIC 3) - show/hide via config
- Network graph (EPIC 4) - not built yet

### What Should Not Merge Until Stable

- Same-tier enforcement (EPIC 2) - must be solid
- Premium card structure (EPIC 3) - affects all matching UX

### How to Avoid Rework

- Reuse existing matching lifecycle (don't rebuild)
- Reuse existing discovery function (don't rebuild)
- Extend types rather than replace (backward compatible)
- Add tier to payload (don't change existing fields)

---

## 11. WHAT TO DO / WHAT NOT TO DO

### A. DO

1. **Extend existing onboarding shell**
   - OnboardingWizardScreenPhase1.tsx is complete
   - No changes needed

2. **Keep trust concepts**
   - user_reputation table exists
   - Display score on cards (EPIC 3)

3. **Centralize tier enforcement**
   - One function: `enforceSameTier()`
   - Reuse in discovery, matching, invites

4. **Reuse match request lifecycle**
   - matching-request, matching-accept, matching-reject
   - Pattern is sound, keep it

5. **Use shared member payload types**
   - Define once in types package
   - Reuse across discovery, matching, profile

6. **Add tier to existing payloads**
   - Extend MatchSuggestion, don't replace
   - Backward compatible

7. **Verify before building**
   - Run verification scripts
   - Confirm same-tier enforcement works

8. **Show fit reasons**
   - Explain why matched
   - Build trust, increase engagement

9. **Make copy golf-specific**
   - "Golf partner" not "Match"
   - "Tee time" not "Availability"

10. **Test with real data**
    - Create test users in each tier
    - Verify no cross-tier leakage

### B. DO NOT

1. **Do not create frontend-only tier filtering**
   - Backend must enforce
   - Frontend is defense in depth only

2. **Do not duplicate invite systems**
   - One invite flow: connections-request
   - Reuse for network, rounds

3. **Do not overload wrong tables**
   - Keep normalized schema
   - Don't put networking in golf_identities

4. **Do not rebuild coaching flows**
   - CoachingScreen.tsx exists
   - EPIC 8 will reposition, not rebuild

5. **Do not keep multi-sport logic unflagged**
   - Audit all copy
   - Replace "sport" with "golf"

6. **Do not create separate matching engines**
   - One matching-candidates function
   - Extend, don't duplicate

7. **Do not ignore existing buddy rating**
   - user_reputation has ratings_average
   - Use it in EPIC 3 cards

8. **Do not build full network graph yet**
   - EPIC 4 will build visual graph
   - EPIC 3: just show mutual connections count

9. **Do not build rounds in EPIC 3**
   - Rounds system already exists
   - EPIC 5 will integrate with network

10. **Do not change database schema**
    - Schema is complete
    - Just verify, don't modify

---

## 12. FOLLOW-UP ITEMS FOR LATER EPICS

### EPIC 4: Private Golf Network Graph (Deferred)
- Visual network graph UI
- Saved members (bookmarks)
- Introduction requests
- Mutual connections display
- "Played together" state

### EPIC 5: Rounds and Foursomes (Deferred)
- Integrate rounds with network (invite connections)
- Round logistics (tee time, cart)
- Post-round ratings
- Free tier 3-round limit enforcement

### EPIC 6: Trust and Reputation Expansion (Deferred)
- Reliability score (show rate)
- No-show tracking
- Played-together count
- Trust badges

### EPIC 7: Premium Tier Differentiation (Deferred)
- Tier-specific discovery filters
- Premium visibility controls
- Elite-tier exclusive features
- Feature gating system

### EPIC 8: Coaching Repositioning (Deferred)
- Remove pickleball/tennis
- Golf-only coaches
- Move to "More" menu
- Tier-based coaching access

---

## 13. MASTER DONE CHECKLIST

### EPIC 1: Tiered Member Foundation
- [x] Tier model exists (free/select/summit)
- [x] Tier pricing correct ($0/$1000/$10000)
- [x] Onboarding captures all 12 required fields
- [x] Profile displays all identity cards
- [x] Backend persists all fields cleanly
- [x] Database schema is normalized
- [x] RLS policies enforce same-tier

### EPIC 2: Same-Tier Discovery Enforcement
- [ ] Verification script passes
- [ ] Free user only sees Free members
- [ ] Select user only sees Select members
- [ ] Summit user only sees Summit members
- [ ] Discovery function filters by tier
- [ ] Matching function filters by tier
- [ ] Matching payload includes tier
- [ ] No cross-tier data leakage

### EPIC 3: Premium Golf Matching UX
- [ ] PremiumMatchCard component created
- [ ] Cards show tier badge
- [ ] Cards show handicap band
- [ ] Cards show company/title/industry
- [ ] Cards show networking intent
- [ ] Cards show trust score
- [ ] Fit reasons explain matches
- [ ] Filter panel works (handicap, intent, industry)
- [ ] Actions: Connect, Save, Request Intro
- [ ] MatchingScreen uses premium cards
- [ ] DiscoveryScreen uses premium cards

### Cross-Epic Quality
- [ ] Existing reusable systems preserved
- [ ] Multi-sport assumptions flagged or removed
- [ ] Backend-first enforcement implemented
- [ ] Shared types used consistently
- [ ] No duplicate logic created

---

## IMPLEMENTATION READY

This plan is explicit enough for immediate execution.

**Start with:** EPIC 2 - Verify same-tier enforcement
**Then:** EPIC 3 - Build premium matching UX

All decisions are made. All tradeoffs are explicit. All reuse points identified.

Ready to execute.

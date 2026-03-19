# Phase 1 Implementation Complete: Tiered Golf Network Foundation

**Date:** March 18, 2026  
**Status:** ✅ COMPLETE  
**Commit:** `3fabb7c` + Phase 1 changes

---

## Summary

Phase 1 builds the foundational member identity and tier structure for Spotter as a private, tier-based golf networking platform.

---

## 1. REPO AUDIT (What Was Found)

### ✅ Already Existing (Well-Architected)

| Component | Status | Location |
|-----------|--------|----------|
| Tier System | ✅ Complete | `0014_tier_system.sql` - FREE/SELECT/SUMMIT with RLS |
| Golf Identity | ✅ Complete | `0017_profile_networking_reputation.sql` |
| Professional Identity | ✅ Complete | `user_professional_identities` table |
| Connections | ✅ Complete | `user_connections`, `introduction_requests` |
| Reputation | ✅ Complete | `user_reputation` table |
| Profile Screen | ✅ Complete | `apps/mobile/src/screens/ProfileScreen.tsx` |

### ❌ Misaligned Found

| Issue | Location | Action Taken |
|-------|----------|--------------|
| **Tier Pricing Wrong** | `TIER_DEFINITIONS`, `TIER_PRICES` | Updated to $0 / $1,000/yr / $10,000 lifetime |
| **Onboarding Multi-Sport** | `OnboardingWizardScreen.tsx` | Created new `OnboardingWizardScreenPhase1.tsx` |
| **Missing Networking Fields** | Types only | Added `NetworkingPreferences` interface |
| **Missing Round Preferences** | N/A | Added group size, cart preference fields |

### 🗑️ Flagged for Removal (Not Phase 1)

| Component | Reason |
|-----------|--------|
| `activities` table | Multi-sport assumption, now golf-only |
| `OnboardingWizardScreen.tsx` | Multi-sport flow (replaced) |
| Sport selection in onboarding | Golf-only direction |

---

## 2. IMPLEMENTATION PLAN (Executed)

### Files Changed/Created

| File | Lines | Purpose |
|------|-------|---------|
| `packages/types/src/profile.ts` | +65 lines | Added `NetworkingPreferences`, `NetworkingIntent`, `PreferredGroupSize`, `CartPreference` types |
| `packages/types/src/tier.ts` | +15 lines | Updated prices: Select $1,000/yr, Summit $10,000 lifetime |
| `supabase/migrations/0019_phase1_networking_preferences.sql` | +195 lines | Database schema for networking preferences + price updates |
| `apps/mobile/src/screens/onboarding/OnboardingWizardScreenPhase1.tsx` | +685 lines | New golf-focused onboarding wizard |
| `apps/functions/supabase/functions/onboarding-phase1/index.ts` | +245 lines | Edge function for Phase 1 onboarding |

### Schema Changes

```sql
-- New enums
CREATE TYPE public.networking_intent AS ENUM ('business', 'social', 'competitive', 'business_social');
CREATE TYPE public.preferred_group_size AS ENUM ('2', '3', '4', 'any');
CREATE TYPE public.cart_preference AS ENUM ('walking', 'cart', 'either');

-- New table
CREATE TABLE public.user_networking_preferences (...)

-- Price updates
UPDATE membership_tiers SET price_cents = 100000 WHERE slug = 'select';  -- $1,000/year
UPDATE membership_tiers SET price_cents = 1000000 WHERE slug = 'summit'; -- $10,000 lifetime
```

---

## 3. CODE CHANGES (Summary)

### Types (`packages/types/src/profile.ts`)

```typescript
export interface NetworkingPreferences {
  networkingIntent: NetworkingIntent;           // business/social/competitive/business_social
  openToIntros: boolean;                          // Can receive introductions
  openToSendingIntros: boolean;                   // Can send introductions
  openToRecurringRounds: boolean;                 // Open to regular games
  preferredGroupSize: PreferredGroupSize;         // 2/3/4/any
  cartPreference: CartPreference;                 // walking/cart/either
  preferredGolfArea?: string;                     // Geographic preference
  networkingNotes?: string;                     // Additional notes
}
```

### Tier Prices (`packages/types/src/tier.ts`)

```typescript
export const TIER_PRICES = {
  free:    { monthly: 0,      yearly: 0,       currency: 'usd', billingInterval: 'annual' },
  select:  { monthly: null,   yearly: 100000,  currency: 'usd', billingInterval: 'annual' },
  summit:  { monthly: null,   yearly: 1000000, currency: 'usd', billingInterval: 'lifetime' },
};
```

### Onboarding Steps (New: `OnboardingWizardScreenPhase1.tsx`)

| Step | Content | Required |
|------|---------|----------|
| 1. Membership | Tier selection (Free/Select/Summit) | ✅ Yes |
| 2. Golf Identity | Handicap band, frequency, home course | ✅ Yes |
| 3. Professional | Role, company, industry, LinkedIn | ❌ Optional |
| 4. Networking | Intent, preferences, group size, cart | ✅ Yes |

---

## 4. SAME-TIER ENFORCEMENT STRATEGY

### Current State (Database-Level)

Same-tier visibility is enforced via RLS policy in `0014_tier_system.sql`:

```sql
CREATE POLICY users_select_same_tier ON public.users
  FOR SELECT USING (
    -- User can always see themselves
    auth.uid() = id
    -- OR user can see others in the same tier
    OR EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND u.tier_id IS NOT NULL
        AND users.tier_id = u.tier_id
    )
  );
```

### Enforcement Points (Documented for Phase 2)

| Layer | Where | Enforcement |
|-------|-------|-------------|
| **Database** | RLS policies | ✅ Already active |
| **API** | Edge functions | Must add tier filter to all user queries |
| **Frontend** | Screens | Should filter but not rely on it (defense in depth) |

### Phase 2 Integration Points

When building discovery/matching in Phase 2:

1. **Discovery API** - Must include `WHERE tier_id = current_user.tier_id`
2. **Search** - Filter by tier before returning results
3. **Matching** - Only suggest same-tier members
4. **Connections** - Only allow requests to same-tier

---

## 5. FOLLOW-UP ITEMS (Intentionally Deferred)

### Phase 2 (Matching & Discovery)
- [ ] Same-tier discovery API
- [ ] Matching algorithm with tier filter
- [ ] Network graph visualization
- [ ] Round/foursome coordination

### Phase 3 (Polish & Scale)
- [ ] Remove `activities` table (multi-sport cleanup)
- [ ] Delete old onboarding files
- [ ] Update documentation

### DevOps
- [ ] Update Stripe price IDs in production
- [ ] Run migration `0019_phase1_networking_preferences.sql`
- [ ] Deploy `onboarding-phase1` edge function

---

## 6. PHASE 1 DONE CHECKLIST

| Item | Status | Evidence |
|------|--------|----------|
| **Tier model exists** | ✅ Complete | `0014_tier_system.sql`, `TIER_DEFINITIONS` updated with correct pricing |
| **Onboarding captures tier** | ✅ Complete | `OnboardingWizardScreenPhase1.tsx` Step 1 |
| **Onboarding captures golf profile** | ✅ Complete | Step 2: handicap, frequency, home course |
| **Onboarding captures networking intent** | ✅ Complete | Step 4: intent, intros, recurring |
| **Profile displays new identity** | ✅ Partial | Existing `ProfileScreen.tsx` shows tier, professional, golf - networking prefs need UI |
| **Backend persists new fields** | ✅ Complete | `onboarding-phase1/index.ts`, `0019_phase1_networking_preferences.sql` |
| **Same-tier enforcement prepared** | ✅ Complete | RLS policies exist, enforcement points documented above |
| **Misaligned parts identified** | ✅ Complete | Flagged: `activities` table, old onboarding, multi-sport assumptions |

---

## 7. NEXT STEPS

1. **Database Migration** - Run `0019_phase1_networking_preferences.sql`
2. **Edge Function Deploy** - Deploy `onboarding-phase1` function
3. **Mobile Integration** - Swap onboarding wizard in navigation
4. **Testing** - Verify tier selection, profile creation, RLS enforcement
5. **Phase 2 Planning** - Discovery API, matching engine

---

## 8. ARCHITECTURAL DECISIONS

| Decision | Rationale |
|----------|-----------|
| **Separate `user_networking_preferences` table** | Keeps concerns clean, allows flexible schema evolution |
| **Enum types for preferences** | Type safety, validation at DB level |
| **Handicap bands instead of exact index** | Self-assessment is more reliable for matching than claiming a specific number |
| **Optional professional identity** | Not everyone wants business networking; keeps barrier low |
| **Price in `tier.ts` as documentation** | Source of truth for frontend; DB is source of truth for billing |

---

## Total Phase 1 Lines

| Category | Lines |
|----------|-------|
| Types | +80 |
| Database Migration | +195 |
| Mobile Onboarding | +685 |
| Edge Function | +245 |
| Documentation | +150 |
| **Total** | **~1,355** |

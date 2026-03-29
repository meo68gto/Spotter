# EPIC 7: Premium Tier Differentiation

**Status:** SPEC  
**Author:** J'onn J'onzz (Intelligence & Research)  
**Date:** March 29, 2026  
**Sprint:** Phase 1 — Premium Infrastructure  
**Epic Goal:** Differentiate paid tiers with exclusive discovery filters, visibility controls, and elite-gated features, unified under a single feature-gating system.  
**Success Metric:** SELECT/SUMMIT members have measurably higher profile visibility and access to exclusive discovery/search features; FREE members remain able to discover and connect with paid tiers.

---

## 1. Epic Overview

| Field | Value |
|---|---|
| **Epic Name** | EPIC 7 — Premium Tier Differentiation |
| **Sprint** | Phase 1 — Premium Infrastructure |
| **Lead** | J'onn J'onzz (Intelligence & Research) |
| **Status** | ✅ SPEC APPROVED — Implementation pending |

### Goal

Transform Spotter's tier system from a flat access model into a differentiated premium experience where SELECT and SUMMIT members pay for **exclusivity, visibility, and discovery advantage**. The FREE tier remains functional but deliberately constrained in search depth and profile visibility.

### 4 Core Objectives

1. **Tier-Specific Discovery Filters** — Each tier gets a curated view of the member network with appropriate visibility rules.
2. **Premium Visibility Controls** — Paid members can manage how they appear to lower tiers (SUMMIT privacy mode).
3. **Elite-Tier Exclusive Features** — SELECT and SUMMIT unlock features unavailable to FREE users.
4. **Feature Gating System** — A unified `hasAccess()` function that governs all tier-based access decisions.

### Success Metrics

| Metric | Target |
|---|---|
| SELECT upgrade conversion rate | +15% within 30 days of launch |
| SUMMIT lifetime conversions | +5 lifetime members within 60 days |
| FREE → SELECT discovery frustration signals | < 5% of support tickets mention "can't find members" |
| Discovery page engagement (SELECT/SUMMIT) | +25% increase in connections made |
| SUMMIT member privacy compliance | 100% of SUMMIT members' visibility settings honored |

---

## 2. What EPIC 7 Is About

### The Core Insight

Premium tier members pay for **two things**:

1. **Access to a higher-quality network** — being surrounded by more serious, committed golfers.
2. **Visibility advantage** — being seen by the right people, appearing higher in search results, and having their profile stand out.

Spotter's current tier system defines **quantitative limits** (maxSearchResults, maxConnections, maxRoundsPerMonth) but lacks **qualitative differentiation**. EPIC 7 adds the qualitative layer.

### Tier Visibility Hierarchy

The visibility model is **asymmetric upward**:

```
SUMMIT members:
  ✅ See all SUMMIT members
  ✅ See their own connections (any tier)
  ✅ Hidden from FREE and SELECT by default (privacy mode)
  ✅ Can appear in SELECT/FREE search results if they opt in

SELECT members:
  ✅ See all SELECT members
  ✅ See all SUMMIT members
  ✅ See their own connections (any tier)
  ✅ Can hide from FREE members
  ✅ Cannot see FREE members by default ("Hunt Mode" unlocks this for coaches)

FREE members:
  ✅ See all FREE members
  ✅ See SELECT and SUMMIT members (paid tiers are discoverable)
  ✅ Limited to 20 search results
  ✅ Cannot see private/pro-hide SUMMIT members
```

### Discovery Philosophy

- **FREE users** should feel the **pull** of the paid network — they can see SELECT and SUMMIT profiles and understand what they're missing.
- **SELECT users** should feel **networked** — unlimited search, connections with similar golfers, visibility into the elite tier.
- **SUMMIT users** should feel **exclusive** — private, priority-placed, accessible only on their terms.

---

## 3. Unified TierFeatures Interface

### 3.1 The Conflict

Two `TierFeatures` interfaces exist and are functionally incompatible:

**`packages/types/src/tier.ts`** — defines features as **boolean capability flags**:

```typescript
export interface TierFeatures {
  matchmaking: boolean;
  unlimitedSessions: boolean;
  videoAnalysis: boolean;
  priorityMatching: boolean;
  advancedAnalytics: boolean;
  coachMessaging: boolean;
  eventAccess: boolean;
  profileBadges: boolean;
  earlyAccess: boolean;
  adFree: boolean;
  boostedVisibility: boolean;
  groupSessions: boolean;
}
```

**`apps/functions/supabase/functions/_shared/tier-gate.ts`** — defines features as **quantitative limits**:

```typescript
export interface TierFeatures {
  maxSearchResults: number | null;
  maxConnections: number | null;
  maxRoundsPerMonth: number | null;
  introCreditsMonthly: number | null;
  canCreateRounds: boolean;
  canSendIntros: boolean;
  canReceiveIntros: boolean;
  profileVisibility: 'public' | 'tier_only' | 'connections_only' | 'priority';
  priorityBoosts?: boolean;
  exclusiveAccess?: boolean;
}
```

### 3.2 Resolution: Two-Abstraction Model

**Decision: Keep both interfaces but designate a canonical source of truth.**

These two abstractions serve **different purposes** and should not be merged into one:

| Abstraction | File | Purpose |
|---|---|---|
| `TierLimits` | `_shared/tier-gate.ts` | **Quantitative limits** — enforces how much a user can do (searches, connections, rounds). This is the operational tier gate. |
| `TierCapabilities` | `packages/types/src/tier.ts` | **Feature booleans** — declares what capabilities are unlocked. This is the business logic interface. |

**Canonical Source of Truth:** `_shared/tier-gate.ts`

All tier limit configuration lives here. The types package should **import from** `_shared/tier-gate.ts` rather than duplicating definitions.

### 3.3 Proposed Unified TierLimits (Canonical)

```typescript
// apps/functions/supabase/functions/_shared/tier-gate.ts
// This file is the SOLE SOURCE OF TRUTH for tier definitions.

export const TIER_SLUGS = {
  FREE: 'free',
  SELECT: 'select',
  SUMMIT: 'summit'
} as const;
export type TierSlug = typeof TIER_SLUGS[keyof typeof TIER_SLUGS];

// Discovery visibility levels
export type VisibilityLevel = 
  | 'public'           // Visible to all tiers
  | 'select_and_above' // Visible to SELECT and SUMMIT
  | 'summit_only';     // Visible to SUMMIT only (SUMMIT members' choice)

// Hunt mode for SELECT coaches/teachers
export type HuntMode = 'off' | 'view_free' | 'connect_free';

// Tier-specific discovery filters
export interface DiscoveryFilters {
  // Which tiers this user can see in discovery
  visibleTiers: TierSlug[];
  // Hunt mode status
  huntMode: HuntMode;
  // Priority boost in search results
  searchBoost: boolean;
  // Whether to appear in lower-tier discovery
  appearInLowerTierSearch: boolean;
}

// Canonical tier features interface
export interface TierLimits {
  // Quantitative limits
  maxSearchResults: number | null;       // null = unlimited
  maxConnections: number | null;         // null = unlimited
  maxRoundsPerMonth: number | null;     // null = unlimited
  introCreditsMonthly: number | null;   // null = unlimited

  // Access booleans
  canCreateRounds: boolean;
  canSendIntros: boolean;
  canReceiveIntros: boolean;

  // Discovery & visibility
  discoveryFilters: DiscoveryFilters;
  visibilityLevel: VisibilityLevel;
  searchBoost: boolean;

  // Exclusive features (SELECT+)
  exclusiveAccess: boolean;             // true for SUMMIT only
  profileBadge: 'none' | 'verified' | 'gold' | 'summit';
  analyticsAccess: 'none' | 'basic' | 'advanced';
  eventAccess: 'none' | 'select_events' | 'all_events';
  customProfileUrl: boolean;

  // Feature flags (for capability checks)
  flags: {
    canUseHuntMode: boolean;            // SELECT only
    canHideFromLowerTiers: boolean;     // SUMMIT only
    canSeeAllSummits: boolean;          // SELECT+ (can always see SUMMIT)
    canSeeAllSelects: boolean;          // SELECT+ and FREE
    canCreateExclusiveEvents: boolean;  // SUMMIT only
    canAccessVerifiedDirectory: boolean; // SELECT+
  };
}
```

### 3.4 Tier Definitions

```typescript
export const TIER_LIMITS: Record<TierSlug, TierLimits> = {
  [TIER_SLUGS.FREE]: {
    maxSearchResults: 20,
    maxConnections: 50,
    maxRoundsPerMonth: 0,
    introCreditsMonthly: 0,
    canCreateRounds: false,
    canSendIntros: false,
    canReceiveIntros: true,
    discoveryFilters: {
      visibleTiers: [TIER_SLUGS.FREE],
      huntMode: 'off',
      searchBoost: false,
      appearInLowerTierSearch: true,
    },
    visibilityLevel: 'public',
    searchBoost: false,
    exclusiveAccess: false,
    profileBadge: 'none',
    analyticsAccess: 'none',
    eventAccess: 'none',
    customProfileUrl: false,
    flags: {
      canUseHuntMode: false,
      canHideFromLowerTiers: false,
      canSeeAllSummits: false,
      canSeeAllSelects: true,
      canCreateExclusiveEvents: false,
      canAccessVerifiedDirectory: false,
    },
  },

  [TIER_SLUGS.SELECT]: {
    maxSearchResults: null,           // unlimited
    maxConnections: 500,
    maxRoundsPerMonth: 4,
    introCreditsMonthly: 3,
    canCreateRounds: true,
    canSendIntros: true,
    canReceiveIntros: true,
    discoveryFilters: {
      visibleTiers: [TIER_SLUGS.SELECT, TIER_SLUGS.SUMMIT],
      huntMode: 'off',               // enabled via flag, not default
      searchBoost: false,
      appearInLowerTierSearch: true,
    },
    visibilityLevel: 'select_and_above',
    searchBoost: false,
    exclusiveAccess: false,
    profileBadge: 'verified',        // Golf-verified badge
    analyticsAccess: 'basic',         // Profile views, connection stats
    eventAccess: 'select_events',    // SELECT-tier events
    customProfileUrl: false,
    flags: {
      canUseHuntMode: true,           // SELECT can enable Hunt Mode
      canHideFromLowerTiers: false,   // SELECT cannot fully hide
      canSeeAllSummits: true,
      canSeeAllSelects: true,
      canCreateExclusiveEvents: false,
      canAccessVerifiedDirectory: true, // Verified instructor directory
    },
  },

  [TIER_SLUGS.SUMMIT]: {
    maxSearchResults: null,           // unlimited
    maxConnections: null,             // unlimited
    maxRoundsPerMonth: null,          // unlimited
    introCreditsMonthly: null,        // unlimited
    canCreateRounds: true,
    canSendIntros: true,
    canReceiveIntros: true,
    discoveryFilters: {
      visibleTiers: [TIER_SLUGS.SUMMIT],
      huntMode: 'off',
      searchBoost: true,
      appearInLowerTierSearch: false, // Privacy by default
    },
    visibilityLevel: 'summit_only',   // Hidden from lower tiers by default
    searchBoost: true,               // Priority placement in search
    exclusiveAccess: true,            // Exclusive features unlocked
    profileBadge: 'summit',          // Gold/Summit badge
    analyticsAccess: 'advanced',      // Full analytics including profile viewers
    eventAccess: 'all_events',       // All events including exclusive SUMMIT events
    customProfileUrl: true,
    flags: {
      canUseHuntMode: true,
      canHideFromLowerTiers: true,    // Full privacy control
      canSeeAllSummits: true,
      canSeeAllSelects: true,
      canCreateExclusiveEvents: true, // Can create exclusive events
      canAccessVerifiedDirectory: true,
    },
  },
};
```

### 3.5 hasAccess() — Unified Access Function

```typescript
// apps/functions/supabase/functions/_shared/tier-gate.ts

export type FeatureKey = keyof TierLimits['flags'] | 
  | 'unlimitedSearch'
  | 'unlimitedConnections'
  | 'unlimitedRounds'
  | 'createRounds'
  | 'sendIntros'
  | 'receiveIntros'
  | 'huntMode'
  | 'hideFromLowerTiers'
  | 'seeAllSummits'
  | 'seeAllSelects'
  | 'createExclusiveEvents'
  | 'verifiedDirectory'
  | 'advancedAnalytics'
  | 'eventAccess'
  | 'customProfileUrl'
  | 'searchBoost';

/**
 * Primary access check function — use this for ALL feature gating.
 * 
 * @param userTier - The user's current tier slug
 * @param feature - The feature to check access for
 * @returns true if the user has access, false otherwise
 */
export function hasAccess(userTier: TierSlug, feature: FeatureKey): boolean {
  const limits = TIER_LIMITS[userTier];
  
  switch (feature) {
    // Flag-based checks
    case 'huntMode':
      return limits.flags.canUseHuntMode;
    case 'hideFromLowerTiers':
      return limits.flags.canHideFromLowerTiers;
    case 'seeAllSummits':
      return limits.flags.canSeeAllSummits;
    case 'seeAllSelects':
      return limits.flags.canSeeAllSelects;
    case 'createExclusiveEvents':
      return limits.flags.canCreateExclusiveEvents;
    case 'verifiedDirectory':
      return limits.flags.canAccessVerifiedDirectory;

    // Quantitative limit checks (true if value exists and > 0)
    case 'unlimitedSearch':
      return limits.maxSearchResults === null;
    case 'unlimitedConnections':
      return limits.maxConnections === null;
    case 'unlimitedRounds':
      return limits.maxRoundsPerMonth === null;
    case 'createRounds':
      return limits.canCreateRounds;
    case 'sendIntros':
      return limits.canSendIntros;
    case 'receiveIntros':
      return limits.canReceiveIntros;

    // Qualitative checks
    case 'searchBoost':
      return limits.searchBoost;
    case 'advancedAnalytics':
      return limits.analyticsAccess === 'advanced';
    case 'eventAccess':
      return limits.eventAccess !== 'none';
    case 'customProfileUrl':
      return limits.customProfileUrl;

    default:
      console.warn(`[hasAccess] Unknown feature: ${feature}`);
      return false;
  }
}

/**
 * Check if a user can see members of a target tier.
 * Used in discovery queries and profile visibility checks.
 * 
 * @param viewerTier - The viewer's tier
 * @param targetTier - The target member's tier
 * @param viewerIsConnected - Whether the viewer has a connection with the target
 * @returns true if the viewer can see the target's profile
 */
export function canSeeTier(
  viewerTier: TierSlug,
  targetTier: TierSlug,
  viewerIsConnected: boolean = false
): boolean {
  // Always see own connections regardless of tier
  if (viewerIsConnected) {
    return true;
  }

  // FREE sees FREE, SELECT, and SUMMIT (but with limited results)
  if (viewerTier === TIER_SLUGS.FREE) {
    return true; // FREE can see all tiers
  }

  // SELECT sees SELECT and SUMMIT (not FREE without Hunt Mode)
  if (viewerTier === TIER_SLUGS.SELECT) {
    return targetTier !== TIER_SLUGS.FREE;
  }

  // SUMMIT only sees SUMMIT (and their connections of any tier)
  if (viewerTier === TIER_SLUGS.SUMMIT) {
    return targetTier === TIER_SLUGS.SUMMIT;
  }

  return false;
}

/**
 * Get the discovery-visible tiers for a given viewer tier.
 */
export function getVisibleTiers(viewerTier: TierSlug, huntModeEnabled: boolean = false): TierSlug[] {
  switch (viewerTier) {
    case TIER_SLUGS.FREE:
      return [TIER_SLUGS.FREE];
    case TIER_SLUGS.SELECT:
      const selectTiers = [TIER_SLUGS.SELECT, TIER_SLUGS.SUMMIT];
      if (huntModeEnabled) {
        selectTiers.push(TIER_SLUGS.FREE);
      }
      return selectTiers;
    case TIER_SLUGS.SUMMIT:
      return [TIER_SLUGS.SUMMIT];
    default:
      return [TIER_SLUGS.FREE];
  }
}
```

---

## 4. Tier-Specific Discovery Filters

### 4.1 Default Discovery Views Per Tier

| Viewer Tier | Sees by Default | Hunt Mode | Result Limit |
|---|---|---|---|
| **FREE** | FREE members only | Not available | 20 results |
| **SELECT** | SELECT + SUMMIT + own connections | Can enable to see FREE | Unlimited |
| **SUMMIT** | SUMMIT + own connections | N/A | Unlimited |

### 4.2 Discovery Filter Options Per Tier

**Available to ALL tiers:**

- `handicap_band` — low / mid / high
- `location` — city or region text search
- `intent` — business / social / competitive / business_social

**Tier-specific filters:**

| Filter | FREE | SELECT | SUMMIT |
|---|---|---|---|
| Filter by tier | ❌ Not shown | ✅ Can filter to SHOW only SELECT | ✅ Can filter to SHOW only SUMMIT |
| Filter by skill level | ✅ | ✅ | ✅ |
| Filter by geography | ✅ | ✅ | ✅ |
| Filter by availability | ✅ | ✅ | ✅ |
| Filter by company/industry | ❌ | ✅ | ✅ |
| Filter by reputation score | ❌ | ✅ (top 25%) | ✅ (top 10%) |
| Filter by verified status | ❌ | ✅ | ✅ |

### 4.3 Hunt Mode (SELECT Only)

**What it is:** Hunt Mode allows SELECT members (typically coaches, instructors, club pros) to discover and connect with FREE-tier members. This is a **permissioned privilege** for SELECT members, not a default behavior.

**Enabling Hunt Mode:**

1. User must be on SELECT tier (verified automatically via `hasAccess(userTier, 'huntMode')`)
2. User explicitly opts in via Profile Visibility Settings
3. When enabled, the discovery filter toggle "Include FREE members" appears

**UX for Hunt Mode:**

- FREE members appear with a distinct `coach_viewer` badge when viewed by SELECT in Hunt Mode
- FREE members are **not notified** that they are in Hunt Mode
- SELECT member's profile shows a small `👁️ Hunt Mode Active` indicator on their own discovery screen
- Hunt Mode can be toggled off at any time

**Why this exists:** Golf coaches, instructors, and club pros need to find BEGINNER golfers (who are typically on the FREE tier) to offer lessons. Without Hunt Mode, SELECT coaches cannot see the FREE tier at all.

### 4.4 Search Result Ranking

Within any discovery view, results are ranked by:

1. **SUMMIT members** (when visible): Priority boosted, gold badge displayed
2. **SELECT members**: Standard ranking by compatibility score
3. **Connections**: Boosted to top regardless of tier
4. **Compatibility score**: Descending order
5. **Reputation score**: Descending order as tiebreaker
6. **Profile completeness**: Descending order as secondary tiebreaker

### 4.5 Backend Changes — Discovery Search

**`discover_golfers` PostgreSQL function** must be updated to accept:

```sql
-- New parameters for EPIC 7
p_hunt_mode BOOLEAN DEFAULT false,   -- SELECT member with Hunt Mode enabled
p_visible_tiers TEXT[] DEFAULT NULL, -- Array of tier slugs to include
p_include_connections BOOLEAN DEFAULT true, -- Always include viewer's connections
p_summit_privacy_check BOOLEAN DEFAULT true -- Filter out SUMMIT members who hid from lower tiers
```

**Visibility logic in SQL:**

```sql
-- Pseudocode for discover_golfers visibility rules
WHERE
  -- Always exclude self
  target_user_id != p_viewer_id
  
  -- Always include direct connections (regardless of tier)
  OR target_user_id IN (SELECT connected_user_id FROM connections WHERE user_id = p_viewer_id)
  
  -- Tier-based filtering
  AND (
    -- FREE: see FREE only (connections exempt)
    (p_viewer_tier = 'free' AND target_tier = 'free')
    
    -- SELECT: see SELECT + SUMMIT + FREE (if hunt mode)
    OR (p_viewer_tier = 'select' AND target_tier IN ('select', 'summit'))
    OR (p_viewer_tier = 'select' AND p_hunt_mode = true AND target_tier = 'free')
    
    -- SUMMIT: see SUMMIT only (connections exempt)
    OR (p_viewer_tier = 'summit' AND target_tier = 'summit')
  )
  
  -- SUMMIT privacy: exclude SUMMIT members who hid from lower tiers
  AND NOT (
    target_tier = 'summit' 
    AND target.hide_from_lower_tiers = true 
    AND p_viewer_tier IN ('free', 'select')
  )
```

---

## 5. Visibility Controls

### 5.1 Profile Visibility Settings

Each tier has different visibility controls available:

| Setting | FREE | SELECT | SUMMIT |
|---|---|---|---|
| Appear in discovery | Always on | Can toggle off | Can toggle off |
| Hide from FREE members | — | — | ✅ |
| Hide from SELECT members | — | — | ✅ |
| Hide from all lower tiers | — | — | ✅ |
| Show "Available for intros" badge | ✅ | ✅ | ✅ |
| Show verified badge | — | ✅ | ✅ |
| Show summit badge | — | — | ✅ |

### 5.2 SUMMIT Privacy Mode

SUMMIT members have granular privacy controls:

- **Full privacy**: Hidden from FREE and SELECT discovery. Only SUMMIT members and connections can see them.
- **Selective privacy**: Can choose to appear to SELECT but hide from FREE.
- **Visible**: Opt-in to appear in SELECT/FREE discovery (for networking purposes).

**Default:** Full privacy (hidden from lower tiers).  
**Implementation:** `appearInLowerTierSearch: false` by default for SUMMIT. Controlled via `profile.visibility_mode` column.

### 5.3 Priority Profile Placement

SUMMIT members receive **priority placement** in search results:

- SUMMIT members appear in the **top 3 positions** of any discovery result set (regardless of compatibility score)
- If multiple SUMMIT members are present, they are sorted by reputation score among themselves
- SUMMIT members who are also connected appear **above** non-connected SUMMIT members

This is implemented as a SQL `ORDER BY` boost:

```sql
ORDER BY
  -- SUMMIT members get priority boost (value = 3)
  CASE target_tier 
    WHEN 'summit' THEN 3 
    WHEN 'select' THEN 2 
    WHEN 'free' THEN 1 
  END DESC,
  -- Then by compatibility score
  compatibility_score DESC,
  -- Then by reputation
  reputation_score DESC
```

### 5.4 Profile Badge System

| Badge | Tier | Display Criteria | Visual |
|---|---|---|---|
| None | FREE | Default | No badge |
| Verified (⛳) | SELECT | Active SELECT subscription | Blue checkmark + golf club icon |
| Gold (🏆) | SUMMIT | Active SUMMIT lifetime membership | Gold badge |
| Summit Elite (💎) | SUMMIT (high rep) | SUMMIT + reputation score > 90 | Diamond + gold badge |

---

## 6. Elite Exclusive Features

### 6.1 SELECT Exclusive Features

| Feature | Description | Access Criteria |
|---|---|---|
| **Unlimited Search Results** | No 20-result cap on discovery | All SELECT members |
| **Verified Badge** | ⛳ badge on profile and in search results | All SELECT members |
| **Priority Matching** | Higher weight in compatibility algorithm | All SELECT members |
| **4 Rounds/Month** | Can create and join rounds | All SELECT members |
| **3 Intro Credits** | Send intros to break the ice | All SELECT members |
| **Hunt Mode** | See FREE-tier members for coaching | All SELECT members |
| **Verified Instructor Directory** | Listed in verified coaches list | SELECT members who are instructors |
| **SELECT Events** | Access to SELECT-tier member events | All SELECT members |
| **Basic Analytics** | See profile view counts, connection stats | All SELECT members |
| **500 Connections** | Expanded network cap | All SELECT members |

### 6.2 SUMMIT Exclusive Features

All SELECT features, plus:

| Feature | Description | Access Criteria |
|---|---|---|
| **Unlimited Connections** | No cap on connections | All SUMMIT members |
| **Unlimited Rounds** | No cap on rounds created/joined | All SUMMIT members |
| **Unlimited Intros** | No cap on intro credits | All SUMMIT members |
| **Search Boost** | Priority placement in discovery | All SUMMIT members |
| **SUMMIT Privacy Mode** | Hide from lower tiers | All SUMMIT members |
| **Summit Badge** | 💎 badge on profile and search | All SUMMIT members |
| **Advanced Analytics** | Profile viewers, trend analysis, heatmaps | All SUMMIT members |
| **All Events** | Access to all events including exclusive SUMMIT events | All SUMMIT members |
| **Exclusive Events** | Create events visible only to other SUMMIT members | SUMMIT event organizers |
| **Custom Profile URL** | `spotter.golf/{username}` | All SUMMIT members |
| **Early Access** | Access to beta features before release | All SUMMIT members |
| **Exclusive Network View** | See all SUMMIT members regardless of location | All SUMMIT members |

### 6.3 Feature Gating in UI

When a FREE or SELECT user encounters a SUMMIT-only feature:

```
┌─────────────────────────────────────────────┐
│  💎 SUMMIT Exclusive                        │
│                                             │
│  Advanced Profile Analytics                 │
│  See exactly who viewed your profile,       │
│  track trending interest, and analyze       │
│  your network growth over time.            │
│                                             │
│  [ 🔒 Locked — SUMMIT Only ]               │
│  [    Upgrade to Summit    ]                │
└─────────────────────────────────────────────┘
```

When a feature is gated:

1. **Blur the preview** (if applicable) — e.g., analytics dashboard shows blurred charts
2. **Show a lock badge** — 🔒 icon in corner of the feature card
3. **Show upgrade CTA** — "Upgrade to [TIER]" button
4. **Do NOT hide the feature** — Users should know what they're missing

---

## 7. Feature Gating System

### 7.1 Gating Architecture

```
┌──────────────────────────────────────────────┐
│           Feature Access Check               │
│                                              │
│  1. getUserTier(userId) → TierSlug           │
│  2. hasAccess(tier, feature) → boolean       │
│  3. If false → render GatedFeatureCard        │
│  4. If true  → render feature normally        │
└──────────────────────────────────────────────┘
```

### 7.2 GatedFeatureCard Component

**Props:**

```typescript
interface GatedFeatureCardProps {
  feature: FeatureKey;
  requiredTier: TierSlug;
  title: string;
  description: string;
  preview?: React.ReactNode;     // Blurred preview of the feature
  icon?: string;                 // Emoji or icon
  upgradeCta?: string;           // Custom CTA text
  currentTier: TierSlug;        // Passed from user's session
}
```

**Behavior:**

- If `hasAccess(currentTier, feature) === true`: render `children` (the actual feature)
- If `false`:
  - If `preview` provided: render blurred preview + lock overlay
  - Always render: feature title, description, tier requirement badge, upgrade CTA

### 7.3 Migration Strategy

**For existing users:**

1. **No automatic tier changes** — existing FREE/SELECT/SUMMIT members keep their current tier and limits
2. **SELECT members inherit Hunt Mode flag** — automatically set to `false` (opt-in)
3. **SUMMIT members inherit privacy** — `appearInLowerTierSearch = false` by default
4. **Existing users with unlimited search (SELECT/SUMMIT)** — confirm via `maxSearchResults === null`
5. **New features (analytics, badges)** — immediately available based on tier

**Database migration:**

```sql
-- Add new columns for EPIC 7
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS visibility_mode TEXT DEFAULT 'public';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS hunt_mode_enabled BOOLEAN DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS appear_in_lower_tier_search BOOLEAN DEFAULT true;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS search_boosted BOOLEAN DEFAULT false;

-- Migration: Set SUMMIT defaults
UPDATE profiles 
SET appear_in_lower_tier_search = false, 
    search_boosted = true
WHERE tier_slug = 'summit';

-- Migration: Set SELECT Hunt Mode defaults  
UPDATE profiles
SET hunt_mode_enabled = false
WHERE tier_slug = 'select';
```

### 7.4 Edge Function Updates

**`discovery-search/index.ts`** — Add `p_hunt_mode` and `p_visible_tiers` parameters to the RPC call. Apply `getVisibleTiers()` to filter before calling `discover_golfers()`.

**`profile-get/index.ts`** — Filter response based on viewer's tier and target's privacy settings. Use `canSeeTier()` to determine visibility.

**`user-with-tier/index.ts`** — Return `visibility_mode`, `hunt_mode_enabled`, `search_boosted` in the user response so the frontend can render the correct UI.

---

## 8. Backend Work

### 8.1 Database Changes

**`profiles` table additions:**

| Column | Type | Default | Description |
|---|---|---|---|
| `visibility_mode` | `TEXT` | `'public'` | `'public'`, `'select_only'`, `'summit_only'` |
| `hunt_mode_enabled` | `BOOLEAN` | `false` | SELECT members can enable to see FREE |
| `appear_in_lower_tier_search` | `BOOLEAN` | `true` | Whether to appear in lower-tier discovery |
| `search_boosted` | `BOOLEAN` | `false` | SUMMIT priority boost in search |

**`membership_tiers` table — add feature flags:**

| Column | Type | Description |
|---|---|---|
| `discovery_visible_tiers` | `TEXT[]` | Array of tier slugs this tier can see |
| `hunt_mode_available` | `BOOLEAN` | Whether this tier can use Hunt Mode |
| `privacy_control_available` | `BOOLEAN` | Whether this tier can hide from lower tiers |
| `analytics_level` | `TEXT` | `'none'`, `'basic'`, `'advanced'` |
| `event_access_level` | `TEXT` | `'none'`, `'select'`, `'all'` |
| `badge_type` | `TEXT` | `'none'`, `'verified'`, `'gold'`, `'summit'` |

### 8.2 RLS Policy Updates

**Update `discover_golfers()` function** to enforce tier visibility and privacy:

```sql
-- Within the discover_golfers function:
-- Filter out SUMMIT members who hid from lower tiers
AND NOT (
  target.tier_slug = 'summit' 
  AND target.appear_in_lower_tier_search = false
  AND viewer.tier_slug IN ('free', 'select')
)

-- Apply hunt mode filter
AND (
  p_hunt_mode = true 
  OR target.tier_slug != 'free'  -- Without hunt mode, SELECT can't see FREE
)
```

### 8.3 New Edge Functions

| Function | Purpose |
|---|---|
| `profile-visibility-update` | Update visibility_mode, hunt_mode, appear_in_lower_tier_search |
| `profile-analytics` | Return analytics data (views, trends) for SELECT/SUMMIT |
| `verified-directory` | Return list of verified instructors (SELECT+) |
| `exclusive-events-list` | Return SUMMIT-exclusive events (SUMMIT only) |

### 8.4 Discovery Search Modifications

The `discover_golfers` RPC must be extended:

```typescript
// Updated RPC call signature
const { data } = await supabase.rpc('discover_golfers', {
  p_user_id: user.id,
  p_handicap_band: filters.handicap_band ?? null,
  p_location: filters.location ?? null,
  p_intent: filters.intent ?? null,
  p_limit: limit,
  p_offset: offset,
  p_hunt_mode: huntModeEnabled,         // NEW
  p_visible_tiers: visibleTiers,        // NEW
  p_summit_privacy_check: true,         // NEW
});
```

---

## 9. Frontend Work

### 9.1 Discovery Screen Filter UI

**FREE users** see:

- Basic filters: handicap band, location, intent
- No tier filter (always sees FREE)
- "Upgrade to see SELECT & SUMMIT members" banner at top of results

**SELECT users** see:

- All FREE filters + tier filter dropdown:
  - "All (SELECT + SUMMIT)"
  - "SELECT members only"
  - "SUMMIT members only"
- Hunt Mode toggle (if enabled): "Include FREE members"
- "Verified" filter checkbox

**SUMMIT users** see:

- All SELECT filters
- Priority placement badge on own profile card
- Privacy mode toggle in settings

### 9.2 Profile Visibility Settings Screen

New dedicated screen at `/settings/visibility` (or modal):

```
┌─────────────────────────────────────────────────┐
│  Profile Visibility Settings                    │
├─────────────────────────────────────────────────┤
│                                                 │
│  Who can see your profile?                      │
│                                                 │
│  ○ Everyone (public)                            │
│    Your profile appears in all discovery       │
│    searches and can be viewed by any member.   │
│                                                 │
│  ● SELECT and above                             │
│    Your profile is hidden from FREE members.  │
│    Visible to SELECT and SUMMIT members only.  │
│    [ SELECT+ members see you ]                  │
│                                                 │
│  ○ SUMMIT only                                  │
│    Your profile is hidden from FREE and        │
│    SELECT members. Only SUMMIT members and     │
│    your connections can see you.               │
│    [ Currently: Hidden from 47 members ]       │
│                                                 │
│  ─────────────────────────────────────────────  │
│                                                 │
│  Hunt Mode (SELECT only)                       │
│  ┌───────────────────────────────────────────┐  │
│  │ Enable Hunt Mode                          │  │
│  │                                           │  │
│  │ See FREE-tier members in your discovery   │  │
│  │ to connect with beginner golfers for      │  │
│  │ coaching or lessons.                      │  │
│  │                                           │  │
│  │ [ Toggle: OFF ]                           │  │
│  └───────────────────────────────────────────┘  │
│                                                 │
│  ─────────────────────────────────────────────  │
│                                                 │
│  [ Save Settings ]                             │
└─────────────────────────────────────────────────┘
```

### 9.3 Exclusive Feature Unlock Cards

When a FREE or SELECT user navigates to a SUMMIT-only feature:

```
┌─────────────────────────────────────────────────────────┐
│  💎 Summit Exclusive                                   │
│                                                         │
│  Advanced Analytics                                    │
│                                                         │
│  See exactly who viewed your profile, track            │
│  trending interest, and analyze your network           │
│  growth with detailed charts and weekly reports.       │
│                                                         │
│  ┌─────────────────────────────────────────────────┐    │
│  │ [Blurred chart preview]                        │    │
│  └─────────────────────────────────────────────────┘    │
│                                                         │
│  🔒 Available with Summit ($10,000 lifetime)          │
│                                                         │
│  [     Upgrade to Summit — $10,000     ]               │
│                                                         │
│  Or learn more about Summit benefits →                 │
└─────────────────────────────────────────────────────────┘
```

### 9.4 Tier Badge Components

```typescript
// components/TierBadge.tsx
type BadgeType = 'none' | 'verified' | 'gold' | 'summit';

const TierBadge: React.FC<{ tier: TierSlug; size?: 'sm' | 'md' | 'lg' }> = ({ tier, size = 'md' }) => {
  switch (tier) {
    case 'summit':
      return <Badge icon="💎" label="Summit" color="gold" size={size} />;
    case 'select':
      return <Badge icon="⛳" label="Verified" color="blue" size={size} />;
    default:
      return null;
  }
};
```

### 9.5 Upgrade CTA Components

```typescript
// components/UpgradeCTA.tsx
// Used in GatedFeatureCard and tier banners

const UpgradeCTA: React.FC<{
  targetTier: 'select' | 'summit';
  featureContext?: string; // e.g., "to enable Hunt Mode"
  variant?: 'banner' | 'button' | 'card';
}> = ({ targetTier, featureContext, variant = 'banner' }) => {
  const tierInfo = {
    select: { price: '$49/mo', label: 'Select', color: '#2563eb' },
    summit: { price: '$10,000', label: 'Summit', color: '#fbbf24' },
  };

  // Render appropriate variant...
};
```

---

## 10. Acceptance Criteria

### Discovery & Filters

- [ ] FREE users can search and see FREE members only, limited to 20 results
- [ ] FREE users can see a banner indicating SELECT/SUMMIT members exist but are not visible
- [ ] SELECT users can search without result limit
- [ ] SELECT users see both SELECT and SUMMIT members in discovery by default
- [ ] SELECT users can enable Hunt Mode to see FREE members
- [ ] SUMMIT users see SUMMIT members only in discovery
- [ ] SUMMIT users' connections (any tier) appear in their discovery
- [ ] Hunt Mode is only accessible to SELECT members (`hasAccess(tier, 'huntMode') === true`)
- [ ] Tier filter dropdown works for SELECT and SUMMIT users
- [ ] Verified badge filter is available to SELECT and SUMMIT

### Visibility Controls

- [ ] SUMMIT users can hide from FREE members
- [ ] SUMMIT users can hide from both FREE and SELECT members  
- [ ] Privacy mode settings persist and are honored in discovery queries
- [ ] `appear_in_lower_tier_search` column is respected by `discover_golfers()` function
- [ ] Priority placement for SUMMIT members appears in top 3 of all discovery results
- [ ] Profile badges display correctly: ⛳ for SELECT, 💎 for SUMMIT

### Exclusive Features

- [ ] SELECT members have unlimited search results (`maxSearchResults === null`)
- [ ] SELECT members have 500 connection cap
- [ ] SELECT members have 4 rounds/month cap
- [ ] SUMMIT members have unlimited connections
- [ ] SUMMIT members have unlimited rounds
- [ ] SUMMIT members have search boost (priority placement)
- [ ] Advanced analytics are accessible to SUMMIT only
- [ ] Custom profile URL is available to SUMMIT only
- [ ] Verified instructor directory is accessible to SELECT+

### Feature Gating

- [ ] `hasAccess()` returns correct values for all tier/feature combinations
- [ ] GatedFeatureCard renders blurred preview for locked features
- [ ] GatedFeatureCard shows correct upgrade CTA for each tier
- [ ] hunt_mode_enabled is opt-in for SELECT members
- [ ] All existing user tiers are preserved during migration (no forced tier changes)

### Backend

- [ ] New columns (`visibility_mode`, `hunt_mode_enabled`, `appear_in_lower_tier_search`, `search_boosted`) added to `profiles` table
- [ ] RLS policies updated to enforce visibility rules
- [ ] `discover_golfers()` RPC accepts and respects new parameters
- [ ] `profile-visibility-update` edge function created and tested
- [ ] `profile-analytics` edge function returns correct data per tier

### Frontend

- [ ] Discovery screen shows tier-appropriate filters per user tier
- [ ] Profile visibility settings screen is accessible and functional
- [ ] Tier badges render on profile cards and search results
- [ ] Upgrade CTA components render with correct pricing per tier
- [ ] GatedFeatureCard blurs and locks SUMMIT-only features from FREE/SELECT users

### Integration

- [ ] SELECT → SUMMIT upgrade flow preserves all settings
- [ ] FREE → SELECT upgrade enables Hunt Mode availability
- [ ] All tier changes are logged for analytics
- [ ] Privacy settings survive tier changes (reapplied on upgrade)

---

## 11. Dependencies

| Epic | Status | Relationship |
|---|---|---|
| **EPIC 4** (Network Graph) | ✅ Complete | Network graph displays tier badges; SUMMIT connections highlighted differently |
| **EPIC 3** (Premium Matching) | ✅ Complete | Priority matching algorithm should respect `searchBoost` flag from EPIC 7 |
| **EPIC 11** (Organizer Portal) | 🔄 In Progress | Exclusive event access in EPIC 7 must coordinate with EPIC 11 event creation. SUMMIT members need ability to create exclusive events that EPIC 11 organizer portal surfaces. |

### EPIC 11 Coordination

EPIC 7's `eventAccess` levels and EPIC 11's organizer portal intersect here:

- SUMMIT members should be able to create **exclusive events** visible only to other SUMMIT members
- EPIC 11 organizer portal must support a `visibility` filter on event creation: `'all'` | `'select_and_above'` | `'summit_only'`
- SELECT members can create events visible to SELECT and above
- EPIC 7's `hasAccess(userTier, 'createExclusiveEvents')` gates this feature in EPIC 11

---

## 12. Out of Scope for EPIC 7

- Payment/revenue integration (Stripe billing changes are EPIC 10)
- Multi-sport expansion
- Referral program
- Messaging/chat system (not tier-gated)
- Round recaps and score tracking
- Mobile push notification preferences
- White-label/custom domains for SUMMIT members

---

## 13. Appendix: Interface Diff — Old vs. New

### Old: Two Conflicting TierFeatures

```
packages/types/src/tier.ts          →  Boolean capability flags (matchmaking, videoAnalysis, etc.)
apps/functions/.../_shared/tier-gate.ts →  Quantitative limits (maxSearchResults, maxConnections, etc.)
```

### New: Unified Model

```
apps/functions/.../_shared/tier-gate.ts  ← SOLE SOURCE OF TRUTH
  ├── TIER_LIMITS (quantitative limits)
  ├── DiscoveryFilters (visibility + tiers)
  └── TierLimits.flags (capability booleans)

packages/types/src/tier.ts          ← IMPORTS from tier-gate.ts
  └── TierCapabilities (boolean features, re-exported for public API)
```

The `packages/types` version becomes a **public API wrapper** around the `_shared` implementation, not an independent definition.

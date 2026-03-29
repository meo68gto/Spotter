// ============================================================================
// Tier Gate - Spotter Golf Networking
// SOLE SOURCE OF TRUTH for tier definitions, limits, and access checks.
// ============================================================================
// Re-exports for convenience
export { SupabaseClient } from '@supabase/supabase-js';

// Tier slugs
export const TIER_SLUGS = {
  FREE: 'free',
  SELECT: 'select',
  SUMMIT: 'summit'
} as const;

export type TierSlug = typeof TIER_SLUGS[keyof typeof TIER_SLUGS];

// Feature names
export const FEATURE_NAMES = {
  MAX_SEARCH_RESULTS: 'maxSearchResults',
  MAX_CONNECTIONS: 'maxConnections',
  MAX_ROUNDS_PER_MONTH: 'maxRoundsPerMonth',
  INTRO_CREDITS_MONTHLY: 'introCreditsMonthly',
  CAN_CREATE_ROUNDS: 'canCreateRounds',
  CAN_SEND_INTROS: 'canSendIntros',
  CAN_RECEIVE_INTROS: 'canReceiveIntros',
  PROFILE_VISIBILITY: 'profileVisibility',
  PRIORITY_BOOSTS: 'priorityBoosts',
  EXCLUSIVE_ACCESS: 'exclusiveAccess'
} as const;

// ============================================================================
// Discovery Visibility Types (EPIC 7)
// ============================================================================

/**
 * Profile visibility level — controls who can see a member in discovery.
 */
export type VisibilityLevel = 
  | 'public'           // Visible to all tiers
  | 'select_only'      // Visible to SELECT and SUMMIT only
  | 'summit_only';     // Visible to SUMMIT only

/**
 * Hunt Mode — allows SELECT members (coaches/instructors) to discover FREE members.
 */
export type HuntMode = 'off' | 'view_free';

/**
 * EPIC 7: Discovery filters for a given tier.
 */
export interface DiscoveryFilters {
  visibleTiers: TierSlug[];
  huntMode: HuntMode;
  searchBoost: boolean;
  appearInLowerTierSearch: boolean;
}

// ============================================================================
// TierLimits Interface (EPIC 7 Unified)
// ============================================================================

/**
 * Canonical tier features interface — quantitative limits + capability flags.
 * This is the SOLE SOURCE OF TRUTH for all tier definitions.
 */
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

  // Discovery & visibility (EPIC 7)
  discoveryFilters: DiscoveryFilters;
  visibilityLevel: VisibilityLevel;
  searchBoost: boolean;

  // Exclusive features (SELECT+)
  exclusiveAccess: boolean;             // true for SUMMIT only
  profileBadge: 'none' | 'verified' | 'gold' | 'summit';
  analyticsAccess: 'none' | 'basic' | 'advanced';
  eventAccess: 'none' | 'select_events' | 'all_events';
  customProfileUrl: boolean;

  // Feature flags (EPIC 7)
  flags: {
    canUseHuntMode: boolean;            // SELECT only
    canHideFromLowerTiers: boolean;     // SUMMIT only
    canSeeAllSummits: boolean;          // SELECT+ (can always see SUMMIT)
    canSeeAllSelects: boolean;          // SELECT+ and FREE
    canCreateExclusiveEvents: boolean;  // SUMMIT only
    canAccessVerifiedDirectory: boolean; // SELECT+
  };
}

// ============================================================================
// Tier Features (Legacy interface, preserved for API compatibility)
// ============================================================================

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

// ============================================================================
// Canonical Tier Limits (EPIC 7 SOLE SOURCE OF TRUTH)
// ============================================================================

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
    visibilityLevel: 'public',
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
    profileBadge: 'summit',          // Summit badge
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

// ============================================================================
// Legacy Tier Features (preserved for API compat)
// ============================================================================

export const TIER_FEATURES: Record<TierSlug, TierFeatures> = {
  [TIER_SLUGS.FREE]: {
    maxSearchResults: 20,
    maxConnections: 50,
    maxRoundsPerMonth: 0,
    introCreditsMonthly: 0,
    canCreateRounds: false,
    canSendIntros: false,
    canReceiveIntros: true,
    profileVisibility: 'public'
  },
  [TIER_SLUGS.SELECT]: {
    maxSearchResults: null,
    maxConnections: 500,
    maxRoundsPerMonth: 4,
    introCreditsMonthly: 3,
    canCreateRounds: true,
    canSendIntros: true,
    canReceiveIntros: true,
    profileVisibility: 'public'
  },
  [TIER_SLUGS.SUMMIT]: {
    maxSearchResults: null,
    maxConnections: null,
    maxRoundsPerMonth: null,
    introCreditsMonthly: null,
    canCreateRounds: true,
    canSendIntros: true,
    canReceiveIntros: true,
    profileVisibility: 'priority',
    priorityBoosts: true,
    exclusiveAccess: true
  }
};

// Tier priority (for comparison)
export const TIER_PRIORITY: Record<TierSlug, number> = {
  [TIER_SLUGS.FREE]: 1,
  [TIER_SLUGS.SELECT]: 2,
  [TIER_SLUGS.SUMMIT]: 3
};

// ============================================================================
// Tier Limit Access Functions (EPIC 7 Unified)
// ============================================================================

/**
 * Feature keys for hasAccess() checks.
 */
export type FeatureKey = 
  | keyof TierLimits['flags']
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

// ============================================================================
// Discovery Visibility Functions (EPIC 7)
// ============================================================================

/**
 * EPIC 7: Check if a viewer can see members of a target tier.
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
    return true;
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
 * EPIC 7: Get the discovery-visible tiers for a given viewer tier.
 *
 * @param viewerTier - The viewer's tier
 * @param huntModeEnabled - Whether Hunt Mode is enabled (for SELECT members)
 * @returns Array of tier slugs the viewer can see in discovery
 */
export function getVisibleTiers(viewerTier: TierSlug, huntModeEnabled: boolean = false): TierSlug[] {
  switch (viewerTier) {
    case TIER_SLUGS.FREE:
      return [TIER_SLUGS.FREE];
    case TIER_SLUGS.SELECT:
      const selectTiers: TierSlug[] = [TIER_SLUGS.SELECT, TIER_SLUGS.SUMMIT];
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

// ============================================================================
// Legacy Utility Functions (preserved for compat)
// ============================================================================

/**
 * Check if a tier slug is valid
 */
export function isValidTier(slug: string): slug is TierSlug {
  return Object.values(TIER_SLUGS).includes(slug as TierSlug);
}

/**
 * Get the default tier (FREE)
 */
export function getDefaultTier(): TierSlug {
  return TIER_SLUGS.FREE;
}

/**
 * Get tier priority for comparison
 */
export function getTierPriority(tier: TierSlug): number {
  return TIER_PRIORITY[tier];
}

/**
 * Check if user has access to a required tier level.
 * User must be at or above the required tier.
 */
export function hasAccessLegacy(userTier: TierSlug, requiredTier: TierSlug): boolean {
  return getTierPriority(userTier) >= getTierPriority(requiredTier);
}

/**
 * Check if user can upgrade from one tier to another.
 * Can only upgrade to higher tiers.
 */
export function canUpgrade(fromTier: TierSlug, toTier: TierSlug): boolean {
  return getTierPriority(toTier) > getTierPriority(fromTier);
}

/**
 * Get features for a specific tier (legacy compat).
 */
export function getTierFeatures(tier: TierSlug): TierFeatures {
  return TIER_FEATURES[tier];
}

/**
 * Check if a feature value is unlimited (null)
 */
export function isUnlimited(value: number | null): boolean {
  return value === null;
}

/**
 * Format tier name for display
 */
export function formatTierName(slug: TierSlug): string {
  const names: Record<TierSlug, string> = {
    [TIER_SLUGS.FREE]: 'Free',
    [TIER_SLUGS.SELECT]: 'Select',
    [TIER_SLUGS.SUMMIT]: 'Summit'
  };
  return names[slug];
}

/**
 * Get tier price in dollars
 */
export function getTierPrice(tier: TierSlug): number {
  const prices: Record<TierSlug, number> = {
    [TIER_SLUGS.FREE]: 0,
    [TIER_SLUGS.SELECT]: 1000,
    [TIER_SLUGS.SUMMIT]: 10000
  };
  return prices[tier];
}

/**
 * Get tier billing interval
 */
export function getTierBillingInterval(tier: TierSlug): 'monthly' | 'annual' | 'lifetime' {
  const intervals: Record<TierSlug, 'monthly' | 'annual' | 'lifetime'> = {
    [TIER_SLUGS.FREE]: 'annual',
    [TIER_SLUGS.SELECT]: 'annual',
    [TIER_SLUGS.SUMMIT]: 'lifetime'
  };
  return intervals[tier];
}

/**
 * Enforce same-tier visibility (legacy compat)
 */
export function canSeeSameTier(viewerTier: TierSlug, targetTier: TierSlug): boolean {
  if (viewerTier === targetTier) return true;
  if (viewerTier === TIER_SLUGS.FREE) return true;
  return false;
}

/**
 * Get next tier for upgrade path
 */
export function getNextTier(currentTier: TierSlug): TierSlug | null {
  const path: Record<TierSlug, TierSlug | null> = {
    [TIER_SLUGS.FREE]: TIER_SLUGS.SELECT,
    [TIER_SLUGS.SELECT]: TIER_SLUGS.SUMMIT,
    [TIER_SLUGS.SUMMIT]: null
  };
  return path[currentTier];
}

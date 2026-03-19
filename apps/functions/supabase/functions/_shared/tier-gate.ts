// Tier Gate Utilities - Spotter Golf Networking
// Reusable tier checking and feature access utilities

import { SupabaseClient } from '@supabase/supabase-js';

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

// Tier features interface
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

// Default features for each tier
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
    maxSearchResults: null, // unlimited
    maxConnections: 500,
    maxRoundsPerMonth: 4,
    introCreditsMonthly: 3,
    canCreateRounds: true,
    canSendIntros: true,
    canReceiveIntros: true,
    profileVisibility: 'public'
  },
  [TIER_SLUGS.SUMMIT]: {
    maxSearchResults: null, // unlimited
    maxConnections: null, // unlimited
    maxRoundsPerMonth: null, // unlimited
    introCreditsMonthly: null, // unlimited
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
 * Check if user has access to a required tier level
 * User must be at or above the required tier
 */
export function hasAccess(userTier: TierSlug, requiredTier: TierSlug): boolean {
  return getTierPriority(userTier) >= getTierPriority(requiredTier);
}

/**
 * Check if user can upgrade from one tier to another
 * Can only upgrade to higher tiers
 */
export function canUpgrade(fromTier: TierSlug, toTier: TierSlug): boolean {
  return getTierPriority(toTier) > getTierPriority(fromTier);
}

/**
 * Get features for a specific tier
 */
export function getTierFeatures(tier: TierSlug): TierFeatures {
  return TIER_FEATURES[tier];
}

/**
 * Check if a user has access to a specific feature
 * Uses database lookup for dynamic tier data
 */
export async function checkFeatureAccess(
  userId: string,
  feature: keyof TierFeatures,
  supabaseClient: SupabaseClient
): Promise<boolean> {
  const { data: user, error } = await supabaseClient
    .from('users')
    .select('tier_id, tier_status')
    .eq('id', userId)
    .single();

  if (error || !user || !user.tier_id) {
    return false;
  }

  // Check if tier is active
  if (user.tier_status !== 'active') {
    return false;
  }

  // Get tier features from database
  const { data: tier, error: tierError } = await supabaseClient
    .from('membership_tiers')
    .select('slug, features')
    .eq('id', user.tier_id)
    .single();

  if (tierError || !tier) {
    return false;
  }

  // Check feature in tier features
  const features = tier.features as TierFeatures;
  const featureValue = features[feature];

  // For boolean features, return the value
  if (typeof featureValue === 'boolean') {
    return featureValue;
  }

  // For numeric features, return true if value > 0 or null (unlimited)
  if (typeof featureValue === 'number') {
    return featureValue > 0;
  }

  // For null (unlimited), return true
  return featureValue !== undefined;
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
 * Enforce same-tier visibility
 * Returns true if viewer can see target based on tier rules
 */
export function canSeeSameTier(viewerTier: TierSlug, targetTier: TierSlug): boolean {
  // Same tier - always visible
  if (viewerTier === targetTier) {
    return true;
  }

  // Free tier can see all tiers (but higher tiers can't see Free)
  // This allows Free users to see Select/Summit profiles that might invite them
  if (viewerTier === TIER_SLUGS.FREE) {
    return true;
  }

  // Higher tiers cannot see lower tiers
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

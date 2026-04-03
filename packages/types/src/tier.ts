// ============================================================================
// Tier System Type Definitions - Public API
// ============================================================================
// This file re-exports tier definitions from the canonical source in
// _shared/tier-gate.ts for use by public API consumers.
//
// Canonical source: apps/functions/supabase/functions/_shared/tier-gate.ts
// ============================================================================

import type { UUID } from "./index.js";

// ----------------------------------------------------------------------------
// Tier Slugs & Basic Types
// ----------------------------------------------------------------------------

export const TIER_SLUGS = {
  FREE: 'free',
  SELECT: 'select',
  SUMMIT: 'summit'
} as const;

export type TierSlug = typeof TIER_SLUGS[keyof typeof TIER_SLUGS];

export type TierVisibility = 'same_tier_only';

export type TierStatus = 'active' | 'suspended' | 'expired' | 'pending_upgrade';

// ----------------------------------------------------------------------------
// Discovery Visibility Types (EPIC 7)
// ----------------------------------------------------------------------------

export type VisibilityLevel = 
  | 'public'           // Visible to all tiers
  | 'select_only'      // Visible to SELECT and SUMMIT only
  | 'summit_only';     // Visible to SUMMIT only

export type HuntMode = 'off' | 'view_free';

export interface DiscoveryFilters {
  visibleTiers: TierSlug[];
  huntMode: HuntMode;
  searchBoost: boolean;
  appearInLowerTierSearch: boolean;
}

// ----------------------------------------------------------------------------
// TierLimits Interface (EPIC 7 Unified — mirrors _shared/tier-gate.ts)
// Mirrors: apps/functions/supabase/functions/_shared/tier-gate.ts::TierLimits
// ----------------------------------------------------------------------------

export interface TierLimits {
  maxSearchResults: number | null;
  maxConnections: number | null;
  maxRoundsPerMonth: number | null;
  introCreditsMonthly: number | null;
  canCreateRounds: boolean;
  canSendIntros: boolean;
  canReceiveIntros: boolean;
  discoveryFilters: DiscoveryFilters;
  visibilityLevel: VisibilityLevel;
  searchBoost: boolean;
  exclusiveAccess: boolean;
  profileBadge: 'none' | 'verified' | 'gold' | 'summit';
  analyticsAccess: 'none' | 'basic' | 'advanced';
  eventAccess: 'none' | 'select_events' | 'all_events';
  customProfileUrl: boolean;
  flags: {
    canUseHuntMode: boolean;
    canHideFromLowerTiers: boolean;
    canSeeAllSummits: boolean;
    canSeeAllSelects: boolean;
    canCreateExclusiveEvents: boolean;
    canAccessVerifiedDirectory: boolean;
  };
}

// ----------------------------------------------------------------------------
// TierLimits Definitions (EPIC 7 — mirrors _shared/tier-gate.ts::TIER_LIMITS)
// ----------------------------------------------------------------------------

export const TIER_LIMITS: Record<TierSlug, TierLimits> = {
  free: {
    maxSearchResults: 20,
    maxConnections: 50,
    maxRoundsPerMonth: 0,
    introCreditsMonthly: 0,
    canCreateRounds: false,
    canSendIntros: false,
    canReceiveIntros: true,
    discoveryFilters: {
      visibleTiers: ['free'],
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
  select: {
    maxSearchResults: null,
    maxConnections: 500,
    maxRoundsPerMonth: 4,
    introCreditsMonthly: 3,
    canCreateRounds: true,
    canSendIntros: true,
    canReceiveIntros: true,
    discoveryFilters: {
      visibleTiers: ['select', 'summit'],
      huntMode: 'off',
      searchBoost: false,
      appearInLowerTierSearch: true,
    },
    visibilityLevel: 'public',
    searchBoost: false,
    exclusiveAccess: false,
    profileBadge: 'verified',
    analyticsAccess: 'basic',
    eventAccess: 'select_events',
    customProfileUrl: false,
    flags: {
      canUseHuntMode: true,
      canHideFromLowerTiers: false,
      canSeeAllSummits: true,
      canSeeAllSelects: true,
      canCreateExclusiveEvents: false,
      canAccessVerifiedDirectory: true,
    },
  },
  summit: {
    maxSearchResults: null,
    maxConnections: null,
    maxRoundsPerMonth: null,
    introCreditsMonthly: null,
    canCreateRounds: true,
    canSendIntros: true,
    canReceiveIntros: true,
    discoveryFilters: {
      visibleTiers: ['summit'],
      huntMode: 'off',
      searchBoost: true,
      appearInLowerTierSearch: false,
    },
    visibilityLevel: 'summit_only',
    searchBoost: true,
    exclusiveAccess: true,
    profileBadge: 'summit',
    analyticsAccess: 'advanced',
    eventAccess: 'all_events',
    customProfileUrl: true,
    flags: {
      canUseHuntMode: true,
      canHideFromLowerTiers: true,
      canSeeAllSummits: true,
      canSeeAllSelects: true,
      canCreateExclusiveEvents: true,
      canAccessVerifiedDirectory: true,
    },
  },
};

// ----------------------------------------------------------------------------
// Feature Keys (EPIC 7)
// ----------------------------------------------------------------------------

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

// ----------------------------------------------------------------------------
// hasAccess() — mirrors _shared/tier-gate.ts::hasAccess()
// Use this for ALL feature gating in the public API.
// ----------------------------------------------------------------------------

export function hasAccess(userTier: TierSlug, feature: FeatureKey): boolean {
  const limits = TIER_LIMITS[userTier];
  
  switch (feature) {
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
    case 'searchBoost':
      return limits.searchBoost;
    case 'advancedAnalytics':
      return limits.analyticsAccess === 'advanced';
    case 'eventAccess':
      return limits.eventAccess !== 'none';
    case 'customProfileUrl':
      return limits.customProfileUrl;
    default:
      return false;
  }
}

// ----------------------------------------------------------------------------
// Discovery visibility functions (EPIC 7)
// Mirrors: apps/functions/supabase/functions/_shared/tier-gate.ts
// ----------------------------------------------------------------------------

/**
 * Check if a viewer can see members of a target tier.
 */
export function canSeeTier(
  viewerTier: TierSlug,
  targetTier: TierSlug,
  viewerIsConnected: boolean = false
): boolean {
  if (viewerIsConnected) return true;
  if (viewerTier === 'summit') return targetTier === 'summit';
  if (viewerTier === 'select') return targetTier !== 'free';
  if (viewerTier === 'free') return targetTier === 'free';
  return false;
}

/**
 * Get the discovery-visible tiers for a given viewer tier.
 */
export function getVisibleTiers(viewerTier: TierSlug, huntModeEnabled: boolean = false): TierSlug[] {
  switch (viewerTier) {
    case 'free':
      return ['free'];
    case 'select':
      const tiers: TierSlug[] = ['select', 'summit'];
      if (huntModeEnabled) tiers.push('free');
      return tiers;
    case 'summit':
      return ['summit'];
    default:
      return ['free'];
  }
}

// ----------------------------------------------------------------------------
// Legacy TierFeatures (boolean capability flags)
// Preserved for existing API consumers — prefer TierLimits for new code.
// ----------------------------------------------------------------------------

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

// ----------------------------------------------------------------------------
// Membership Tier Interface
// ----------------------------------------------------------------------------

export interface MembershipTier {
  id: UUID;
  name: string;
  slug: TierSlug;
  description: string;
  features: TierFeatures;
  priceCentsMonthly: number;
  priceCentsYearly: number;
  currency: string;
  matchLimitMonthly: number | null;
  sessionLimitMonthly: number | null;
  videoSubmissionLimitMonthly: number | null;
  active: boolean;
  displayOrder: number;
  stripePriceIdMonthly?: string;
  stripePriceIdYearly?: string;
  createdAt: string;
  updatedAt: string;
}

// ----------------------------------------------------------------------------
// User Tier State Interface
// ----------------------------------------------------------------------------

export interface UserTierState {
  id: UUID;
  userId: UUID;
  tierId: UUID;
  status: TierStatus;
  currentPeriodStart: string;
  currentPeriodEnd: string | null;
  autoRenew: boolean;
  stripeSubscriptionId?: string;
  paymentMethodId?: string;
  createdAt: string;
  updatedAt: string;
  cancelledAt?: string;
  cancellationReason?: string;
}

// ----------------------------------------------------------------------------
// User With Tier Interface
// ----------------------------------------------------------------------------

export interface UserWithTier {
  id: UUID;
  email: string;
  displayName: string;
  avatarUrl?: string;
  tier: {
    slug: TierSlug;
    name: string;
    status: TierStatus;
    features: TierFeatures;
    isPaid: boolean;
    expiresAt: string | null;
    autoRenew: boolean;
  };
}

// ----------------------------------------------------------------------------
// Tier Change/Upgrade Types
// ----------------------------------------------------------------------------

export interface TierChangeRequest {
  id: UUID;
  userId: UUID;
  targetTier: TierSlug;
  changeType: 'upgrade' | 'downgrade' | 'cancel';
  status: 'pending' | 'processing' | 'completed' | 'failed';
  effectiveDate: string;
  stripePaymentIntentId?: string;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
}

// ----------------------------------------------------------------------------
// Constants
// ----------------------------------------------------------------------------

export const TIER_DEFINITIONS: Record<TierSlug, Omit<MembershipTier, 'id' | 'createdAt' | 'updatedAt'>> = {
  free: {
    name: 'Free',
    slug: 'free',
    description: 'Basic access to connect with other golfers. Limited to same-tier connections.',
    features: {
      matchmaking: true,
      unlimitedSessions: false,
      videoAnalysis: false,
      priorityMatching: false,
      advancedAnalytics: false,
      coachMessaging: false,
      eventAccess: false,
      profileBadges: false,
      earlyAccess: false,
      adFree: false,
      boostedVisibility: false,
      groupSessions: false,
    },
    priceCentsMonthly: 0,
    priceCentsYearly: 0,
    currency: 'usd',
    matchLimitMonthly: 3,
    sessionLimitMonthly: 5,
    videoSubmissionLimitMonthly: 0,
    active: true,
    displayOrder: 1,
  },
  select: {
    name: 'Select',
    slug: 'select',
    description: 'Full access to unlimited connections within your tier. $1,000/year membership.',
    features: {
      matchmaking: true,
      unlimitedSessions: true,
      videoAnalysis: true,
      priorityMatching: true,
      advancedAnalytics: true,
      coachMessaging: true,
      eventAccess: true,
      profileBadges: true,
      earlyAccess: false,
      adFree: true,
      boostedVisibility: false,
      groupSessions: false,
    },
    priceCentsMonthly: 0,
    priceCentsYearly: 100000,
    currency: 'usd',
    matchLimitMonthly: null,
    sessionLimitMonthly: null,
    videoSubmissionLimitMonthly: 10,
    active: true,
    displayOrder: 2,
  },
  summit: {
    name: 'Summit',
    slug: 'summit',
    description: 'Lifetime unlimited access with priority boosts and exclusive features. $10,000 one-time.',
    features: {
      matchmaking: true,
      unlimitedSessions: true,
      videoAnalysis: true,
      priorityMatching: true,
      advancedAnalytics: true,
      coachMessaging: true,
      eventAccess: true,
      profileBadges: true,
      earlyAccess: true,
      adFree: true,
      boostedVisibility: true,
      groupSessions: true,
    },
    priceCentsMonthly: 0,
    priceCentsYearly: 1000000,
    currency: 'usd',
    matchLimitMonthly: null,
    sessionLimitMonthly: null,
    videoSubmissionLimitMonthly: null,
    active: true,
    displayOrder: 3,
  },
};

export const FEATURE_NAMES: Array<keyof TierFeatures> = [
  'matchmaking',
  'unlimitedSessions',
  'videoAnalysis',
  'priorityMatching',
  'advancedAnalytics',
  'coachMessaging',
  'eventAccess',
  'profileBadges',
  'earlyAccess',
  'adFree',
  'boostedVisibility',
  'groupSessions',
];

export const TIER_PRICES: Record<TierSlug, { monthly: number | null; yearly: number; currency: string; billingInterval: 'monthly' | 'annual' | 'lifetime' }> = {
  free: { monthly: 0, yearly: 0, currency: 'usd', billingInterval: 'annual' },
  select: { monthly: null, yearly: 100000, currency: 'usd', billingInterval: 'annual' },
  summit: { monthly: null, yearly: 1000000, currency: 'usd', billingInterval: 'lifetime' },
};

// ----------------------------------------------------------------------------
// Type Guards
// ----------------------------------------------------------------------------

export function isValidTier(slug: string): slug is TierSlug {
  return ['free', 'select', 'summit'].includes(slug);
}

export function hasFeatureAccess(
  user: UserWithTier,
  feature: keyof TierFeatures
): boolean {
  if (user.tier.status !== 'active' && user.tier.status !== 'pending_upgrade') {
    return false;
  }
  return user.tier.features[feature] === true;
}

export function isPaidTier(slug: TierSlug): boolean {
  return slug !== 'free';
}

export function isTierUpgrade(fromTier: TierSlug, toTier: TierSlug): boolean {
  const tierOrder: Record<TierSlug, number> = { free: 1, select: 2, summit: 3 };
  return tierOrder[toTier] > tierOrder[fromTier];
}

export function isTierDowngrade(fromTier: TierSlug, toTier: TierSlug): boolean {
  const tierOrder: Record<TierSlug, number> = { free: 1, select: 2, summit: 3 };
  return tierOrder[toTier] < tierOrder[fromTier];
}

export function getTierChangeEffectiveDate(
  changeType: 'upgrade' | 'downgrade' | 'cancel',
  currentPeriodEnd: string | null
): string {
  const now = new Date().toISOString();
  if (changeType === 'upgrade') return now;
  if (currentPeriodEnd) return currentPeriodEnd;
  return now;
}

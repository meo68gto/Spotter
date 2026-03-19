// ============================================================================
// Tier System Type Definitions
// ============================================================================

import type { UUID } from "./index.js";

// ----------------------------------------------------------------------------
// Tier Enums and String Literals
// ----------------------------------------------------------------------------

/**
 * Valid tier slugs for membership levels
 */
export type TierSlug = 'free' | 'select' | 'summit';

/**
 * Tier visibility settings for content/feature access
 */
export type TierVisibility = 'same_tier_only';

/**
 * Possible states for a user's membership tier
 */
export type TierStatus = 'active' | 'suspended' | 'expired' | 'pending_upgrade';

// ----------------------------------------------------------------------------
// Tier Features Interface
// ----------------------------------------------------------------------------

/**
 * Feature gates available in the tier system.
 * Each feature is a boolean indicating access.
 */
export interface TierFeatures {
  /** Access to AI-powered matchmaking */
  matchmaking: boolean;
  /** Unlimited session scheduling */
  unlimitedSessions: boolean;
  /** Video analysis and coaching feedback */
  videoAnalysis: boolean;
  /** Priority matching with premium users */
  priorityMatching: boolean;
  /** Advanced skill analytics and progress tracking */
  advancedAnalytics: boolean;
  /** Direct messaging with coaches */
  coachMessaging: boolean;
  /** Access to sponsor events and tournaments */
  eventAccess: boolean;
  /** Custom profile badges and flair */
  profileBadges: boolean;
  /** Early access to new features */
  earlyAccess: boolean;
  /** Ad-free experience */
  adFree: boolean;
  /** Higher visibility in match results */
  boostedVisibility: boolean;
  /** Group session hosting capabilities */
  groupSessions: boolean;
}

// ----------------------------------------------------------------------------
// Membership Tier Interface
// ----------------------------------------------------------------------------

/**
 * Complete membership tier definition.
 * Represents a tier level in the system with its configuration.
 */
export interface MembershipTier {
  /** Unique identifier for the tier */
  id: UUID;
  /** Human-readable name of the tier */
  name: string;
  /** URL-friendly slug identifier */
  slug: TierSlug;
  /** Detailed description of tier benefits */
  description: string;
  /** Feature flags enabled for this tier */
  features: TierFeatures;
  /** Monthly price in cents (0 for free tier) */
  priceCentsMonthly: number;
  /** Annual price in cents (discounted) */
  priceCentsYearly: number;
  /** Currency code (ISO 4217) */
  currency: string;
  /** Maximum number of matches per month (null for unlimited) */
  matchLimitMonthly: number | null;
  /** Maximum number of sessions per month (null for unlimited) */
  sessionLimitMonthly: number | null;
  /** Maximum number of video submissions per month (null for unlimited) */
  videoSubmissionLimitMonthly: number | null;
  /** Whether this tier is active and available for purchase */
  active: boolean;
  /** Display order (lower numbers shown first) */
  displayOrder: number;
  /** Stripe product/price IDs for subscription management */
  stripePriceIdMonthly?: string;
  stripePriceIdYearly?: string;
  /** When this tier configuration was created */
  createdAt: string;
  /** When this tier configuration was last updated */
  updatedAt: string;
}

// ----------------------------------------------------------------------------
// User Tier State Interface
// ----------------------------------------------------------------------------

/**
 * Represents a user's current tier membership state.
 * Links a user to their active tier and subscription details.
 */
export interface UserTierState {
  /** Unique identifier for this membership record */
  id: UUID;
  /** Reference to the user */
  userId: UUID;
  /** Reference to the tier definition */
  tierId: UUID;
  /** Current status of the membership */
  status: TierStatus;
  /** When the current tier period started */
  currentPeriodStart: string;
  /** When the current tier period ends (null for free tier) */
  currentPeriodEnd: string | null;
  /** Whether the subscription auto-renews */
  autoRenew: boolean;
  /** Stripe subscription ID (if applicable) */
  stripeSubscriptionId?: string;
  /** Payment method on file */
  paymentMethodId?: string;
  /** When the membership was created */
  createdAt: string;
  /** When the membership was last updated */
  updatedAt: string;
  /** When the membership was cancelled (if applicable) */
  cancelledAt?: string;
  /** Reason for cancellation (if applicable) */
  cancellationReason?: string;
}

// ----------------------------------------------------------------------------
// User With Tier Interface
// ----------------------------------------------------------------------------

/**
 * Combined user and tier information.
 * Used when fetching user data with tier context.
 */
export interface UserWithTier {
  /** User ID */
  id: UUID;
  /** User email */
  email: string;
  /** User display name */
  displayName: string;
  /** User avatar URL */
  avatarUrl?: string;
  /** Current tier information */
  tier: {
    /** Tier slug identifier */
    slug: TierSlug;
    /** Tier name for display */
    name: string;
    /** Current tier status */
    status: TierStatus;
    /** Features available to this user */
    features: TierFeatures;
    /** Whether the user has an active paid subscription */
    isPaid: boolean;
    /** When the current period ends (null for free/indefinite) */
    expiresAt: string | null;
    /** Whether auto-renew is enabled */
    autoRenew: boolean;
  };
}

// ----------------------------------------------------------------------------
// Tier Change/Upgrade Types
// ----------------------------------------------------------------------------

/**
 * Represents a tier change request
 */
export interface TierChangeRequest {
  id: UUID;
  userId: UUID;
  /** Target tier slug */
  targetTier: TierSlug;
  /** Change type */
  changeType: 'upgrade' | 'downgrade' | 'cancel';
  /** Current status of the request */
  status: 'pending' | 'processing' | 'completed' | 'failed';
  /** When the change should take effect */
  effectiveDate: string;
  /** Stripe payment intent ID for proration (if applicable) */
  stripePaymentIntentId?: string;
  /** Error message if the change failed */
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
}

// ----------------------------------------------------------------------------
// Constants
// ----------------------------------------------------------------------------

/**
 * Complete tier definitions with all configuration.
 * This is the source of truth for tier capabilities.
 * 
 * PHASE 1 BUSINESS REQUIREMENTS:
 * - Free: $0
 * - Select: $1,000/year
 * - Summit: $10,000 lifetime
 */
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
    priceCentsMonthly: 0, // Annual only
    priceCentsYearly: 100000, // $1,000/year
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
    priceCentsYearly: 1000000, // $10,000 lifetime (stored as yearly for schema compatibility)
    currency: 'usd',
    matchLimitMonthly: null,
    sessionLimitMonthly: null,
    videoSubmissionLimitMonthly: null,
    active: true,
    displayOrder: 3,
  },
};

/**
 * All feature keys available in the tier system.
 * Use this for type-safe feature checking.
 */
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

/**
 * Price mapping by tier and billing interval.
 * Prices are in cents.
 * 
 * PHASE 1: Updated for premium tier pricing
 * - Free: $0
 * - Select: $1,000/year (no monthly option)
 * - Summit: $10,000 lifetime
 */
export const TIER_PRICES: Record<TierSlug, { monthly: number | null; yearly: number; currency: string; billingInterval: 'monthly' | 'annual' | 'lifetime' }> = {
  free: { monthly: 0, yearly: 0, currency: 'usd', billingInterval: 'annual' },
  select: { monthly: null, yearly: 100000, currency: 'usd', billingInterval: 'annual' },
  summit: { monthly: null, yearly: 1000000, currency: 'usd', billingInterval: 'lifetime' },
};

// ----------------------------------------------------------------------------
// Type Guards
// ----------------------------------------------------------------------------

/**
 * Check if a string is a valid TierSlug.
 * @param slug - The string to check
 * @returns Type predicate indicating if the string is a valid TierSlug
 */
export function isValidTier(slug: string): slug is TierSlug {
  return ['free', 'select', 'summit'].includes(slug);
}

/**
 * Check if a user has access to a specific feature.
 * @param user - The user with tier information
 * @param feature - The feature key to check
 * @returns Boolean indicating if the user has access to the feature
 */
export function hasFeatureAccess(
  user: UserWithTier,
  feature: keyof TierFeatures
): boolean {
  // Check if user has an active tier status
  if (user.tier.status !== 'active' && user.tier.status !== 'pending_upgrade') {
    return false;
  }
  
  // Return the feature flag from the user's tier features
  return user.tier.features[feature] === true;
}

/**
 * Check if a tier is paid (not free).
 * @param slug - The tier slug to check
 * @returns Boolean indicating if the tier requires payment
 */
export function isPaidTier(slug: TierSlug): boolean {
  return slug !== 'free';
}

/**
 * Check if a tier change is an upgrade.
 * @param fromTier - The current tier
 * @param toTier - The target tier
 * @returns Boolean indicating if this is an upgrade
 */
export function isTierUpgrade(fromTier: TierSlug, toTier: TierSlug): boolean {
  const tierOrder: Record<TierSlug, number> = {
    free: 1,
    select: 2,
    summit: 3,
  };
  return tierOrder[toTier] > tierOrder[fromTier];
}

/**
 * Check if a tier change is a downgrade.
 * @param fromTier - The current tier
 * @param toTier - The target tier
 * @returns Boolean indicating if this is a downgrade
 */
export function isTierDowngrade(fromTier: TierSlug, toTier: TierSlug): boolean {
  const tierOrder: Record<TierSlug, number> = {
    free: 1,
    select: 2,
    summit: 3,
  };
  return tierOrder[toTier] < tierOrder[fromTier];
}

/**
 * Get the effective date for a tier change.
 * Upgrades take effect immediately, downgrades at period end.
 * @param changeType - The type of tier change
 * @param currentPeriodEnd - When the current period ends
 * @returns ISO date string for when the change takes effect
 */
export function getTierChangeEffectiveDate(
  changeType: 'upgrade' | 'downgrade' | 'cancel',
  currentPeriodEnd: string | null
): string {
  const now = new Date().toISOString();
  
  // Upgrades are immediate
  if (changeType === 'upgrade') {
    return now;
  }
  
  // Downgrades and cancels take effect at period end (or immediately if no period)
  if (currentPeriodEnd) {
    return currentPeriodEnd;
  }
  
  return now;
}

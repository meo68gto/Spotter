// ============================================================================
// Trust & Reliability Types - Epic 6
// Types for reliability scoring, vouching, incidents, and trust badges
// ============================================================================

import type { UUID } from "./index.js";

// ============================================================================
// Reliability Types
// ============================================================================

/**
 * Reliability label based on score
 */
export type ReliabilityLabel = 'Building' | 'Reliable' | 'Trusted' | 'Exceptional';

/**
 * Complete reliability breakdown for a user
 */
export interface ReliabilityBreakdown {
  /** Overall reliability score (0-100) */
  reliabilityScore: number;
  /** Human-readable label */
  reliabilityLabel: ReliabilityLabel;
  /** Show rate - percentage of rounds attended vs scheduled (0-100) */
  showRate: number;
  /** Punctuality rate - on-time percentage (0-100) */
  punctualityRate: number;
  /** Rounds completed (checked in) */
  roundsCompleted: number;
  /** Total rounds scheduled */
  roundsScheduled: number;
  /** Average minutes early (negative = late) */
  minutesEarlyAvg: number;
  /** Last calculation timestamp */
  lastCalculatedAt: string;
  /** Show rate bucket (for UI display) */
  showRateBucket: 'excellent' | 'good' | 'fair' | 'building';
  /** Punctuality bucket (for UI display) */
  punctualityBucket: 'excellent' | 'good' | 'fair' | 'building';
}

/**
 * Reliability component weights for calculation
 */
export interface ReliabilityWeights {
  showRate: number;
  punctuality: number;
  incidentPenalty: number;
}

/**
 * Default reliability weights
 */
export const DEFAULT_RELIABILITY_WEIGHTS: ReliabilityWeights = {
  showRate: 0.50,        // 50% - most important
  punctuality: 0.30,     // 30% - being on time
  incidentPenalty: 0.20  // 20% - negative incidents
};

// ============================================================================
// Vouch Types
// ============================================================================

/**
 * Vouch status
 */
export type VouchStatus = 'active' | 'expired' | 'revoked';

/**
 * A vouch from one user to another
 * Created after playing 3+ rounds together
 */
export interface Vouch {
  /** Unique identifier */
  id: UUID;
  /** User giving the vouch */
  voucherId: UUID;
  /** User receiving the vouch */
  vouchedId: UUID;
  /** Minimum rounds required (always 3) */
  roundCountAtVouch: number;
  /** Actual shared rounds when vouched */
  sharedRoundsCount: number;
  /** Current status */
  status: VouchStatus;
  /** When vouch was created */
  createdAt: string;
  /** When vouch expires (1 year from creation) */
  expiresAt: string;
  /** When vouch was revoked (if applicable) */
  revokedAt?: string;
  /** Reason for revocation */
  revokedReason?: string;
  /** Optional private notes from voucher */
  notes?: string;
}

/**
 * Simplified vouch for display
 */
export interface VouchSummary {
  id: UUID;
  voucherName: string;
  voucherAvatarUrl?: string;
  status: VouchStatus;
  createdAt: string;
  expiresAt: string;
}

// ============================================================================
// Incident Types
// ============================================================================

/**
 * Incident severity levels
 */
export type IncidentSeverity = 'minor' | 'moderate' | 'serious';

/**
 * Incident status
 */
export type IncidentStatus = 'reported' | 'under_review' | 'resolved' | 'dismissed';

/**
 * Incident category
 */
export type IncidentCategory = 'no_show' | 'late' | 'behavior' | 'safety' | 'other';

/**
 * An incident report (private)
 */
export interface Incident {
  /** Unique identifier */
  id: UUID;
  /** User who reported */
  reporterId: UUID;
  /** User being reported */
  reportedId: UUID;
  /** Associated round (optional) */
  roundId?: UUID;
  /** Severity level */
  severity: IncidentSeverity;
  /** Category of incident */
  category: IncidentCategory;
  /** Detailed description */
  description: string;
  /** Current status */
  status: IncidentStatus;
  /** Resolution notes (admin only) */
  resolutionNotes?: string;
  /** When resolved */
  resolvedAt?: string;
  /** Admin who resolved */
  resolvedBy?: UUID;
  /** Impact on reliability (negative) */
  reliabilityImpact: number;
  /** When reported */
  createdAt: string;
  /** Last updated */
  updatedAt: string;
}

/**
 * Input for creating an incident report
 */
export interface CreateIncidentInput {
  reportedId: UUID;
  roundId?: UUID;
  severity: IncidentSeverity;
  category: IncidentCategory;
  description: string;
}

// ============================================================================
// Trust Badge Types
// ============================================================================

/**
 * Trust badge types
 */
export type TrustBadgeType =
  | 'first_round'
  | 'reliable_player'
  | 'punctual'
  | 'social_connector'
  | 'community_vouched'
  | 'regular'
  | 'veteran'
  | 'exceptional'
  | 'vouch_giver';

/**
 * A trust badge awarded to a user
 */
export interface TrustBadge {
  /** Unique identifier */
  id: UUID;
  /** Badge owner */
  userId: UUID;
  /** Badge type */
  badgeType: TrustBadgeType;
  /** Display name */
  displayName: string;
  /** Description of the achievement */
  description?: string;
  /** Icon URL */
  iconUrl?: string;
  /** Whether visible on profile */
  isVisible: boolean;
  /** When awarded */
  awardedAt: string;
  /** When revoked (if applicable) */
  revokedAt?: string;
  /** Reason for revocation */
  revokedReason?: string;
  /** Why it was awarded */
  awardedReason?: string;
}

/**
 * Trust badge metadata for UI
 */
export interface TrustBadgeMeta {
  type: TrustBadgeType;
  displayName: string;
  description: string;
  icon: string;
  color: string;
}

/**
 * Badge metadata for all types
 */
export const TRUST_BADGE_META: Record<TrustBadgeType, TrustBadgeMeta> = {
  first_round: {
    type: 'first_round',
    displayName: 'First Round',
    description: 'Completed your first round',
    icon: '⛳',
    color: '#22c55e'
  },
  reliable_player: {
    type: 'reliable_player',
    displayName: 'Reliable Player',
    description: 'Maintained 95%+ reliability score',
    icon: '✓',
    color: '#3b82f6'
  },
  punctual: {
    type: 'punctual',
    displayName: 'Always On Time',
    description: 'Average arrival 5+ minutes early',
    icon: '🕐',
    color: '#8b5cf6'
  },
  social_connector: {
    type: 'social_connector',
    displayName: 'Social Connector',
    description: 'Made 10+ connections',
    icon: '🤝',
    color: '#f59e0b'
  },
  community_vouched: {
    type: 'community_vouched',
    displayName: 'Community Vouched',
    description: 'Received 3+ vouches from fellow golfers',
    icon: '★',
    color: '#ec4899'
  },
  regular: {
    type: 'regular',
    displayName: 'Regular',
    description: 'Completed 10+ rounds',
    icon: '🔄',
    color: '#14b8a6'
  },
  veteran: {
    type: 'veteran',
    displayName: 'Veteran',
    description: 'Completed 50+ rounds',
    icon: '🏆',
    color: '#6366f1'
  },
  exceptional: {
    type: 'exceptional',
    displayName: 'Exceptional',
    description: '98%+ reliability with 20+ rounds',
    icon: '👑',
    color: '#eab308'
  },
  vouch_giver: {
    type: 'vouch_giver',
    displayName: 'Vouch Giver',
    description: 'Given 5+ vouches to other golfers',
    icon: '🎁',
    color: '#06b6d4'
  }
};

// ============================================================================
// Discovery Boost Types
// ============================================================================

/**
 * Discovery boost breakdown
 */
export interface DiscoveryBoost {
  userId: UUID;
  baseVisibility: number;
  reliabilityBoost: number;
  badgeBoost: number;
  totalBoost: number;
  breakdown: {
    reliabilityScore: number;
    reliabilityTier: 'none' | 'low' | 'medium' | 'high' | 'max';
    badgeCount: number;
    badgeTier: 'none' | 'bronze' | 'silver' | 'gold';
  };
}

// ============================================================================
// Reputation Extension Types
// ============================================================================

/**
 * Extended user reputation with trust/reliability fields
 * This extends the existing ReputationScore interface
 */
export interface ExtendedReputationScore {
  id: UUID;
  userId: UUID;
  overallScore: number;
  // Existing fields
  completionRate: number;
  ratingsAverage: number;
  networkSize: number;
  referralsCount: number;
  profileCompleteness: number;
  attendanceRate: number;
  // Trust & Reliability fields
  showRate: number;
  punctualityRate: number;
  reliabilityScore: number;
  reliabilityLabel: ReliabilityLabel;
  roundsCompleted: number;
  roundsScheduled: number;
  minutesEarlyAvg: number;
  // Timestamps
  calculatedAt: string;
  lastReliabilityCalcAt: string;
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// Input Types
// ============================================================================

/**
 * Input for creating a vouch
 */
export interface CreateVouchInput {
  vouchedId: UUID;
  notes?: string;
}

/**
 * Input for revoking a vouch
 */
export interface RevokeVouchInput {
  vouchId: UUID;
  reason?: string;
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Check if a string is a valid VouchStatus
 */
export function isValidVouchStatus(status: string): status is VouchStatus {
  return ['active', 'expired', 'revoked'].includes(status);
}

/**
 * Check if a string is a valid IncidentSeverity
 */
export function isValidIncidentSeverity(severity: string): severity is IncidentSeverity {
  return ['minor', 'moderate', 'serious'].includes(severity);
}

/**
 * Check if a string is a valid IncidentStatus
 */
export function isValidIncidentStatus(status: string): status is IncidentStatus {
  return ['reported', 'under_review', 'resolved', 'dismissed'].includes(status);
}

/**
 * Check if a string is a valid IncidentCategory
 */
export function isValidIncidentCategory(category: string): category is IncidentCategory {
  return ['no_show', 'late', 'behavior', 'safety', 'other'].includes(category);
}

/**
 * Check if a string is a valid TrustBadgeType
 */
export function isValidTrustBadgeType(type: string): type is TrustBadgeType {
  return [
    'first_round',
    'reliable_player',
    'punctual',
    'social_connector',
    'community_vouched',
    'regular',
    'veteran',
    'exceptional',
    'vouch_giver'
  ].includes(type);
}

/**
 * Check if a string is a valid ReliabilityLabel
 */
export function isValidReliabilityLabel(label: string): label is ReliabilityLabel {
  return ['Building', 'Reliable', 'Trusted', 'Exceptional'].includes(label);
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Minimum rounds required to give/receive vouches
 */
export const VOUCH_MIN_ROUNDS = 3;

/**
 * Maximum vouches a user can give
 */
export const VOUCH_MAX_GIVEN = 5;

/**
 * Vouch expiration period in days
 */
export const VOUCH_EXPIRATION_DAYS = 365;

/**
 * Discovery boost thresholds
 */
export const DISCOVERY_BOOST_THRESHOLDS = {
  reliability: {
    max: 95,    // +30%
    high: 85,   // +15%
    medium: 75  // +5%
  },
  badges: {
    gold: 3,    // +20%
    bronze: 1   // +10%
  }
};

/**
 * Incident severity penalties (reliability points)
 */
export const INCIDENT_PENALTIES = {
  minor: 2,
  moderate: 5,
  serious: 15
};

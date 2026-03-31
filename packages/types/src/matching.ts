// ============================================================================
// Golf Matching Engine Types - Phase 2
// ============================================================================

import type { UUID } from "./index.js";
import type { NetworkingIntent, PreferredGroupSize } from "./profile.js";
export type { NetworkingIntent, PreferredGroupSize };

// ============================================================================
// Match Score Types
// ============================================================================

/**
 * Individual compatibility factor score with weight and breakdown
 */
export interface CompatibilityFactor {
  /** Factor identifier */
  factor: 'handicap' | 'networking_intent' | 'location' | 'availability' | 'group_size';
  /** Human-readable label for this factor */
  label: string;
  /** Raw score (0-100) before weighting */
  rawScore: number;
  /** Weight applied to this factor (0-1, sums to 1.0 across all factors) */
  weight: number;
  /** Weighted contribution to final score (rawScore * weight) */
  weightedScore: number;
  /** Detailed explanation of the score */
  description: string;
}

/**
 * Complete match score calculation result
 */
export interface MatchScore {
  /** The user being matched against */
  targetUserId: UUID;
  /** Target user's display name */
  targetDisplayName: string;
  /** Target user's avatar URL */
  targetAvatarUrl?: string;
  /** Overall compatibility score (0-100) */
  overallScore: number;
  /** Score classification */
  tier: 'excellent' | 'good' | 'fair' | 'poor';
  /** Individual factor breakdowns */
  factors: CompatibilityFactor[];
  /** Summary of why this is a good/bad match */
  reasoning: string;
  /** When the score was calculated */
  calculatedAt: string;
}

/**
 * Match suggestion with target user details for display
 */
export interface MatchSuggestion {
  /** Match score result */
  matchScore: MatchScore;
  /** Target user profile summary */
  user: {
    id: UUID;
    displayName: string;
    avatarUrl?: string;
    city?: string;
    /** User's membership tier (free, select, summit) */
    tier?: 'free' | 'select' | 'summit';
  };
  /** Golf identity summary */
  golf?: {
    handicap?: number;
    homeCourseName?: string;
    yearsPlaying?: number;
  };
  /** Professional identity summary */
  professional?: {
    company?: string;
    title?: string;
    industry?: string;
  };
  /** Networking preferences summary */
  networking?: {
    intent: NetworkingIntent;
    preferredGroupSize: PreferredGroupSize;
    openToIntros: boolean;
    preferredGolfArea?: string;
  };
  /** Common connections (mutual connections) */
  mutualConnections: number;
  /** Shared golf courses (both played at) */
  sharedCourses: number;
  /** Distance from current user in km (if location available) */
  distanceKm?: number;
  /** User's reputation score (0-100) */
  reputationScore?: number;
}

/**
 * Top matches response for API
 */
export interface TopMatchesResponse {
  /** Current user's ID */
  userId: UUID;
  /** Total matches found (before limit) */
  totalMatches: number;
  /** Return limit applied */
  limit: number;
  /** List of ranked match suggestions */
  matches: MatchSuggestion[];
  /** Metadata about the calculation */
  metadata: {
    /** Time taken to calculate in ms */
    calculationTimeMs: number;
    /** Filters applied (same tier, etc.) */
    filtersApplied: string[];
    /** Pool size before ranking */
    candidatePoolSize: number;
  };
}

/**
 * Calculate match request for specific user comparison
 */
export interface CalculateMatchRequest {
  /** User ID to calculate match against */
  targetUserId: UUID;
}

/**
 * Calculate match response for specific user comparison
 */
export interface CalculateMatchResponse {
  /** Current user's ID */
  userId: UUID;
  /** Target user's ID */
  targetUserId: UUID;
  /** Complete match score with breakdown */
  matchScore: MatchScore;
}

// ============================================================================
// Matching Algorithm Configuration
// ============================================================================

/**
 * Weights for match score calculation
 * Total should equal 1.0
 */
export interface MatchWeights {
  /** Handicap similarity (default: 0.30) */
  handicap: number;
  /** Networking intent alignment (default: 0.25) */
  networkingIntent: number;
  /** Location proximity (default: 0.20) */
  location: number;
  /** Availability overlap (default: 0.15) */
  availability: number;
  /** Group size preference (default: 0.10) */
  groupSize: number;
}

/**
 * Default match weights configuration
 */
export const DEFAULT_MATCH_WEIGHTS: MatchWeights = {
  handicap: 0.30,
  networkingIntent: 0.25,
  location: 0.20,
  availability: 0.15,
  groupSize: 0.10,
};

/**
 * Handicap similarity scoring thresholds
 */
export const HANDICAP_THRESHOLDS = {
  /** Within 5 strokes = 100% compatibility */
  excellent: 5,
  /** Within 10 strokes = 75% compatibility */
  good: 10,
  /** Within 15 strokes = 50% compatibility */
  fair: 15,
  /** Beyond 15 strokes = 25% compatibility */
  poor: Infinity,
};

/**
 * Handicap similarity scores by threshold
 */
export const HANDICAP_SCORES: Record<string, number> = {
  excellent: 100,
  good: 75,
  fair: 50,
  poor: 25,
};

/**
 * Networking intent compatibility matrix
 * Rows = user intent, Columns = target intent
 * Score represents compatibility (0-100)
 */
export const NETWORKING_INTENT_COMPATIBILITY: Record<NetworkingIntent, Record<NetworkingIntent, number>> = {
  business: {
    business: 100,
    business_social: 75,
    social: 25,
    competitive: 50,
  },
  social: {
    social: 100,
    business_social: 75,
    business: 25,
    competitive: 50,
  },
  competitive: {
    competitive: 100,
    business_social: 50,
    business: 50,
    social: 50,
  },
  business_social: {
    business_social: 100,
    business: 75,
    social: 75,
    competitive: 50,
  },
};

/**
 * Location proximity scoring (in kilometers)
 */
export const LOCATION_THRESHOLDS = {
  /** Same area (< 10km) = 100% */
  same: 10,
  /** Nearby (10-50km) = 75% */
  nearby: 50,
  /** Different area (> 50km) = 25% */
  distant: Infinity,
};

/**
 * Location proximity scores
 */
export const LOCATION_SCORES: Record<string, number> = {
  same: 100,
  nearby: 75,
  distant: 25,
};

/**
 * Group size compatibility matrix
 */
export const GROUP_SIZE_COMPATIBILITY: Record<PreferredGroupSize, Record<PreferredGroupSize, number>> = {
  '2': { '2': 100, '3': 50, '4': 25, 'any': 100 },
  '3': { '2': 50, '3': 100, '4': 50, 'any': 100 },
  '4': { '2': 25, '3': 50, '4': 100, 'any': 100 },
  'any': { '2': 100, '3': 100, '4': 100, 'any': 100 },
};

// ============================================================================
// Input Types (DTOs)
// ============================================================================

/**
 * Request top matches for the authenticated user
 */
export interface GetTopMatchesInput {
  /** Maximum number of matches to return (default: 10) */
  limit?: number;
  /** Minimum match score threshold (0-100, default: 0) */
  minScore?: number;
  /** Filter by specific networking intent */
  filterIntent?: NetworkingIntent;
  /** Filter by maximum distance in km */
  maxDistanceKm?: number;
  /** Filter by handicap range +/- from user's handicap */
  handicapRange?: number;
}

/**
 * Request match calculation with specific user
 */
export interface GetMatchWithUserInput {
  /** User ID to calculate match against */
  targetUserId: UUID;
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Score tier thresholds
 */
export const MATCH_TIERS = {
  excellent: { min: 80, max: 100, label: 'Excellent Match' },
  good: { min: 60, max: 79, label: 'Good Match' },
  fair: { min: 40, max: 59, label: 'Fair Match' },
  poor: { min: 0, max: 39, label: 'Poor Match' },
} as const;

/**
 * Default limit for top matches
 */
export const DEFAULT_MATCH_LIMIT = 10;

/**
 * Minimum match score to include in results
 */
export const MIN_MATCH_SCORE = 0;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Calculate handicap similarity score (0-100)
 */
export function calculateHandicapScore(h1: number | null | undefined, h2: number | null | undefined): number {
  // If either handicap is null, return neutral score
  if (h1 == null || h2 == null) {
    return 50;
  }

  const diff = Math.abs(h1 - h2);

  if (diff <= HANDICAP_THRESHOLDS.excellent) return HANDICAP_SCORES.excellent;
  if (diff <= HANDICAP_THRESHOLDS.good) return HANDICAP_SCORES.good;
  if (diff <= HANDICAP_THRESHOLDS.fair) return HANDICAP_SCORES.fair;
  return HANDICAP_SCORES.poor;
}

/**
 * Calculate networking intent compatibility score (0-100)
 */
export function calculateNetworkingIntentScore(
  intent1: NetworkingIntent,
  intent2: NetworkingIntent
): number {
  return NETWORKING_INTENT_COMPATIBILITY[intent1]?.[intent2] ?? 25;
}

/**
 * Calculate location proximity score (0-100)
 */
export function calculateLocationScore(distanceKm: number | null | undefined): number {
  if (distanceKm == null) return 50; // Neutral if unknown
  if (distanceKm <= LOCATION_THRESHOLDS.same) return LOCATION_SCORES.same;
  if (distanceKm <= LOCATION_THRESHOLDS.nearby) return LOCATION_SCORES.nearby;
  return LOCATION_SCORES.distant;
}

/**
 * Calculate group size compatibility score (0-100)
 */
export function calculateGroupSizeScore(
  size1: PreferredGroupSize,
  size2: PreferredGroupSize
): number {
  return GROUP_SIZE_COMPATIBILITY[size1]?.[size2] ?? 50;
}

/**
 * Get match tier from overall score
 */
export function getMatchTier(score: number): 'excellent' | 'good' | 'fair' | 'poor' {
  if (score >= MATCH_TIERS.excellent.min) return 'excellent';
  if (score >= MATCH_TIERS.good.min) return 'good';
  if (score >= MATCH_TIERS.fair.min) return 'fair';
  return 'poor';
}

/**
 * Format match score for display
 */
export function formatMatchScore(score: number): string {
  const tier = getMatchTier(score);
  const percentage = Math.round(score);
  return `${percentage}% - ${MATCH_TIERS[tier].label}`;
}

/**
 * Generate match reasoning text
 */
export function generateMatchReasoning(factors: CompatibilityFactor[]): string {
  const strongFactors = factors.filter(f => f.rawScore >= 75);
  const weakFactors = factors.filter(f => f.rawScore <= 40);

  if (strongFactors.length >= 3) {
    const topFactor = strongFactors[0];
    return `Strong compatibility in ${topFactor.label.toLowerCase()} and ${strongFactors.length - 1} other areas.`;
  }

  if (weakFactors.length >= 2) {
    return `Limited compatibility. Consider connecting if you value ${weakFactors[0].label.toLowerCase()} diversity.`;
  }

  const bestFactor = factors.sort((a, b) => b.rawScore - a.rawScore)[0];
  return `Best compatibility in ${bestFactor.label.toLowerCase()}.`;
}

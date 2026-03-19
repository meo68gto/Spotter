// ============================================================================
// Discovery API Types - Same-Tier Golfer Discovery
// ============================================================================

import type { UUID } from "./index.js";

// ----------------------------------------------------------------------------
// Search Filter Types
// ----------------------------------------------------------------------------

/**
 * Handicap band filter for discovering golfers by skill level
 */
export type HandicapBand = 'low' | 'mid' | 'high';

/**
 * Networking intent filter for discovering golfers by their goals
 */
export type NetworkingIntentFilter = 'business' | 'social' | 'competitive' | 'business_social';

/**
 * Filters for the discovery search endpoint
 */
export interface SearchFilters {
  /** Filter by handicap band (low: <10, mid: 10-20, high: >20) */
  handicap_band?: HandicapBand;
  /** Filter by city/location (partial match) */
  location?: string;
  /** Filter by networking intent */
  intent?: NetworkingIntentFilter;
  /** Maximum results to return (default: 20, max: 100) */
  limit?: number;
  /** Offset for pagination (default: 0) */
  offset?: number;
}

// ----------------------------------------------------------------------------
// Discoverable Golfer Types
// ----------------------------------------------------------------------------

/**
 * Professional identity information exposed in discovery
 */
export interface DiscoverableProfessionalIdentity {
  /** Company or employer name */
  company?: string;
  /** Professional title/role */
  title?: string;
  /** Industry sector */
  industry?: string;
  /** Years of professional experience */
  years_experience?: number;
}

/**
 * Golf identity information exposed in discovery
 */
export interface DiscoverableGolfIdentity {
  /** Golf handicap index */
  handicap?: number;
  /** Home course ID */
  home_course_id?: UUID;
  /** Home course name */
  home_course_name?: string;
  /** Playing frequency (e.g., 'weekly', 'monthly') */
  playing_frequency?: string;
  /** Years playing golf */
  years_playing?: number;
}

/**
 * Networking preferences exposed in discovery
 */
export interface DiscoverableNetworkingPreferences {
  /** Primary networking intent */
  networking_intent?: NetworkingIntentFilter;
  /** Open to receiving introductions */
  open_to_intros?: boolean;
  /** Open to recurring rounds with the same group */
  open_to_recurring_rounds?: boolean;
  /** Preferred group size for rounds */
  preferred_group_size?: string;
  /** Cart preference (walking, cart, either) */
  cart_preference?: string;
  /** Preferred geographic area for golf */
  preferred_golf_area?: string;
}

/**
 * A discoverable golfer - returned by the discovery API
 * Same-tier visibility enforced at database level
 */
export interface DiscoverableGolfer {
  /** User ID */
  user_id: UUID;
  /** Display name */
  display_name: string;
  /** Avatar URL */
  avatar_url?: string;
  /** City/location */
  city?: string;
  /** Tier ID */
  tier_id: UUID;
  /** Tier slug (free, select, summit) */
  tier_slug: string;
  
  // Identities
  /** Professional identity (if available) */
  professional?: DiscoverableProfessionalIdentity;
  /** Golf identity (if available) */
  golf?: DiscoverableGolfIdentity;
  /** Networking preferences (if available) */
  networking_preferences?: DiscoverableNetworkingPreferences;
  
  // Reputation & Compatibility
  /** Reputation score (0-100) */
  reputation_score: number;
  /** Compatibility score with caller (0-100) */
  compatibility_score: number;
  
  // Metadata
  /** Profile completeness percentage (0-100) */
  profile_completeness: number;
  /** When the user joined */
  created_at: string;
}

// ----------------------------------------------------------------------------
// Discovery Result Types
// ----------------------------------------------------------------------------

/**
 * Pagination metadata for discovery results
 */
export interface DiscoveryPagination {
  /** Number of results returned */
  limit: number;
  /** Offset used for this query */
  offset: number;
  /** Estimated total matching results */
  total: number;
  /** Whether more results are available */
  has_more: boolean;
}

/**
 * Caller tier information in discovery response
 */
export interface CallerTierInfo {
  /** Tier ID */
  tier_id: UUID;
  /** Tier slug */
  slug: string;
}

/**
 * Response from the discovery search endpoint
 */
export interface DiscoveryResult {
  /** Array of discoverable golfers */
  golfers: DiscoverableGolfer[];
  /** Pagination metadata */
  pagination: DiscoveryPagination;
  /** Applied filters (normalized) */
  filters: {
    handicap_band?: HandicapBand;
    location?: string;
    intent?: NetworkingIntentFilter;
  };
  /** Caller's tier information */
  caller_tier: CallerTierInfo;
}

// ----------------------------------------------------------------------------
// Input/Request Types
// ----------------------------------------------------------------------------

/**
 * Request body for discovery search
 */
export interface DiscoverySearchInput {
  /** Filter by handicap band */
  handicap_band?: HandicapBand;
  /** Filter by location */
  location?: string;
  /** Filter by networking intent */
  intent?: NetworkingIntentFilter;
  /** Maximum results (default: 20, max: 100) */
  limit?: number;
  /** Offset for pagination (default: 0) */
  offset?: number;
}

// ----------------------------------------------------------------------------
// Error Types
// ----------------------------------------------------------------------------

/**
 * Error codes for discovery API
 */
export type DiscoveryErrorCode = 
  | 'missing_auth_header'
  | 'invalid_token'
  | 'inactive_tier'
  | 'invalid_filter'
  | 'invalid_json'
  | 'discovery_failed'
  | 'tier_lookup_failed'
  | 'method_not_allowed'
  | 'internal_error';

/**
 * Error response from discovery API
 */
export interface DiscoveryError {
  /** Error message */
  error: string;
  /** Error code for programmatic handling */
  code: DiscoveryErrorCode;
  /** Additional error details (optional) */
  details?: string;
}

// ----------------------------------------------------------------------------
// Constants
// ----------------------------------------------------------------------------

/**
 * Valid handicap band options with display labels
 */
export const HANDICAP_BANDS: { value: HandicapBand; label: string; range: string }[] = [
  { value: 'low', label: 'Low Handicap', range: '< 10' },
  { value: 'mid', label: 'Mid Handicap', range: '10 - 20' },
  { value: 'high', label: 'High Handicap', range: '> 20' },
];

/**
 * Valid networking intent options with display labels
 */
export const NETWORKING_INTENT_FILTERS: { value: NetworkingIntentFilter; label: string; description: string }[] = [
  { value: 'business', label: 'Business', description: 'Build professional relationships through golf' },
  { value: 'social', label: 'Social', description: 'Meet new people and expand your social circle' },
  { value: 'competitive', label: 'Competitive', description: 'Find serious golfers to compete with' },
  { value: 'business_social', label: 'Business + Social', description: 'Both professional and social connections' },
];

/**
 * Default pagination values
 */
export const DISCOVERY_DEFAULTS = {
  LIMIT: 20,
  MAX_LIMIT: 100,
  OFFSET: 0,
} as const;

// ----------------------------------------------------------------------------
// Type Guards
// ----------------------------------------------------------------------------

/**
 * Check if a string is a valid HandicapBand
 */
export function isValidHandicapBand(band: string): band is HandicapBand {
  return ['low', 'mid', 'high'].includes(band);
}

/**
 * Check if a string is a valid NetworkingIntentFilter
 */
export function isValidNetworkingIntentFilter(intent: string): intent is NetworkingIntentFilter {
  return ['business', 'social', 'competitive', 'business_social'].includes(intent);
}

/**
 * Validate and sanitize discovery search input
 * Returns { valid: true, input: sanitized } or { valid: false, error: string }
 */
export function validateDiscoveryInput(input: unknown): 
  | { valid: true; input: DiscoverySearchInput }
  | { valid: false; error: string } {
  
  if (typeof input !== 'object' || input === null) {
    return { valid: false, error: 'Input must be an object' };
  }

  const raw = input as Record<string, unknown>;
  const sanitized: DiscoverySearchInput = {};

  // Validate handicap_band
  if (raw.handicap_band !== undefined) {
    if (typeof raw.handicap_band !== 'string' || !isValidHandicapBand(raw.handicap_band)) {
      return { valid: false, error: `Invalid handicap_band. Must be one of: low, mid, high` };
    }
    sanitized.handicap_band = raw.handicap_band;
  }

  // Validate location
  if (raw.location !== undefined && raw.location !== null) {
    if (typeof raw.location !== 'string') {
      return { valid: false, error: 'Location must be a string' };
    }
    const trimmed = raw.location.trim();
    if (trimmed.length > 100) {
      return { valid: false, error: 'Location too long (max 100 characters)' };
    }
    if (trimmed) {
      sanitized.location = trimmed;
    }
  }

  // Validate intent
  if (raw.intent !== undefined) {
    if (typeof raw.intent !== 'string' || !isValidNetworkingIntentFilter(raw.intent)) {
      return { valid: false, error: `Invalid intent. Must be one of: business, social, competitive, business_social` };
    }
    sanitized.intent = raw.intent;
  }

  // Validate limit
  if (raw.limit !== undefined) {
    const limit = typeof raw.limit === 'string' ? parseInt(raw.limit, 10) : raw.limit;
    if (typeof limit !== 'number' || isNaN(limit) || limit < 1 || limit > DISCOVERY_DEFAULTS.MAX_LIMIT) {
      return { valid: false, error: `Limit must be between 1 and ${DISCOVERY_DEFAULTS.MAX_LIMIT}` };
    }
    sanitized.limit = limit;
  }

  // Validate offset
  if (raw.offset !== undefined) {
    const offset = typeof raw.offset === 'string' ? parseInt(raw.offset, 10) : raw.offset;
    if (typeof offset !== 'number' || isNaN(offset) || offset < 0) {
      return { valid: false, error: 'Offset must be a non-negative number' };
    }
    sanitized.offset = offset;
  }

  return { valid: true, input: sanitized };
}

// ----------------------------------------------------------------------------
// Helper Types for Edge Function
// ----------------------------------------------------------------------------

/**
 * Raw database response from discover_golfers function
 * Maps to the PostgreSQL function return type
 */
export interface DiscoverGolfersRow {
  user_id: UUID;
  display_name: string;
  avatar_url: string | null;
  city: string | null;
  tier_id: UUID;
  tier_slug: string;
  company: string | null;
  title: string | null;
  industry: string | null;
  years_experience: number | null;
  handicap: number | null;
  home_course_id: UUID | null;
  home_course_name: string | null;
  playing_frequency: string | null;
  years_playing: number | null;
  networking_intent: string | null;
  open_to_intros: boolean | null;
  open_to_recurring_rounds: boolean | null;
  preferred_group_size: string | null;
  cart_preference: string | null;
  preferred_golf_area: string | null;
  reputation_score: number;
  compatibility_score: number;
  profile_completeness: number;
  created_at: string;
}

/**
 * Transform database row to DiscoverableGolfer
 */
export function transformDiscoverableGolfer(row: DiscoverGolfersRow): DiscoverableGolfer {
  return {
    user_id: row.user_id,
    display_name: row.display_name,
    avatar_url: row.avatar_url ?? undefined,
    city: row.city ?? undefined,
    tier_id: row.tier_id,
    tier_slug: row.tier_slug,
    professional: row.company || row.title || row.industry || row.years_experience ? {
      company: row.company ?? undefined,
      title: row.title ?? undefined,
      industry: row.industry ?? undefined,
      years_experience: row.years_experience ?? undefined,
    } : undefined,
    golf: row.handicap || row.home_course_id || row.playing_frequency || row.years_playing ? {
      handicap: row.handicap ?? undefined,
      home_course_id: row.home_course_id ?? undefined,
      home_course_name: row.home_course_name ?? undefined,
      playing_frequency: row.playing_frequency ?? undefined,
      years_playing: row.years_playing ?? undefined,
    } : undefined,
    networking_preferences: row.networking_intent ? {
      networking_intent: row.networking_intent as NetworkingIntentFilter,
      open_to_intros: row.open_to_intros ?? undefined,
      open_to_recurring_rounds: row.open_to_recurring_rounds ?? undefined,
      preferred_group_size: row.preferred_group_size ?? undefined,
      cart_preference: row.cart_preference ?? undefined,
      preferred_golf_area: row.preferred_golf_area ?? undefined,
    } : undefined,
    reputation_score: row.reputation_score,
    compatibility_score: row.compatibility_score,
    profile_completeness: row.profile_completeness,
    created_at: row.created_at,
  };
}

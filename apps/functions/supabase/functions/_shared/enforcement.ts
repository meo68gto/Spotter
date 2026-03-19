// Same-Tier Enforcement Utilities - Spotter
// Centralized helper functions for enforcing same-tier visibility

import { SupabaseClient } from 'npm:@supabase/supabase-js@2';

/**
 * Check if two users are in the same tier
 * Uses database function for authoritative check
 * 
 * @param supabase - Supabase client
 * @param userA - First user ID
 * @param userB - Second user ID
 * @returns boolean indicating if users are in the same tier
 */
export async function checkSameTier(
  supabase: SupabaseClient,
  userA: string,
  userB: string
): Promise<boolean> {
  const { data, error } = await supabase.rpc('check_same_tier', {
    user_a_id: userA,
    user_b_id: userB
  });

  if (error) {
    console.error('checkSameTier RPC error:', error);
    // Fail closed - if we can't verify, assume not same tier
    return false;
  }

  return data === true;
}

/**
 * Check if a user can see a target user (same-tier visibility)
 * 
 * @param supabase - Supabase client
 * @param viewerId - User who is viewing
 * @param targetId - User being viewed
 * @returns boolean indicating if visibility is allowed
 */
export async function canViewUser(
  supabase: SupabaseClient,
  viewerId: string,
  targetId: string
): Promise<boolean> {
  // User can always see themselves
  if (viewerId === targetId) {
    return true;
  }

  return await checkSameTier(supabase, viewerId, targetId);
}

/**
 * Verify that two users can interact (for connections, intros, etc.)
 * 
 * @param supabase - Supabase client
 * @param userA - First user ID
 * @param userB - Second user ID
 * @returns Object with allowed status and error message if not allowed
 */
export async function verifyInteractionAllowed(
  supabase: SupabaseClient,
  userA: string,
  userB: string
): Promise<{ allowed: boolean; error?: string; code?: string }> {
  const sameTier = await checkSameTier(supabase, userA, userB);

  if (!sameTier) {
    return {
      allowed: false,
      error: 'You can only interact with users in the same tier',
      code: 'tier_mismatch'
    };
  }

  return { allowed: true };
}

/**
 * Get user's tier ID for filtering
 * 
 * @param supabase - Supabase client
 * @param userId - User ID
 * @returns tier_id or null if not found
 */
export async function getUserTierId(
  supabase: SupabaseClient,
  userId: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from('users')
    .select('tier_id')
    .eq('id', userId)
    .single();

  if (error || !data) {
    console.error('getUserTierId error:', error);
    return null;
  }

  return data.tier_id;
}

/**
 * Enforce same-tier filter on a Supabase query builder
 * Call this before executing the query
 * 
 * Example:
 *   const query = supabase.from('users').select('*');
 *   const filteredQuery = await applySameTierFilter(supabase, query, currentUserId);
 *   const { data } = await filteredQuery;
 */
export function applySameTierFilter(
  query: any,
  userTierId: string | null
): any {
  if (!userTierId) {
    // If user has no tier, return no results
    return query.eq('id', '00000000-0000-0000-0000-000000000000'); // Impossible condition
  }

  return query.eq('tier_id', userTierId);
}

/**
 * Error response for tier violations
 * Returns a standardized error response for cross-tier access attempts
 */
export function createTierViolationResponse(
  viewerTier?: string,
  targetTier?: string
): { error: string; code: string; viewerTier?: string; targetTier?: string } {
  return {
    error: 'You can only view and interact with users in the same tier',
    code: 'tier_visibility_restricted',
    ...(viewerTier && { viewerTier }),
    ...(targetTier && { targetTier })
  };
}

/**
 * Log enforcement action for audit purposes
 * 
 * @param supabase - Supabase client (service role)
 * @param action - Action attempted
 * @param userId - User who attempted the action
 * @param targetId - Target user
 * @param allowed - Whether the action was allowed
 * @param reason - Reason for denial (if not allowed)
 */
export async function logEnforcementAction(
  supabase: SupabaseClient,
  action: string,
  userId: string,
  targetId: string,
  allowed: boolean,
  reason?: string
): Promise<void> {
  try {
    await supabase.from('enforcement_logs').insert({
      action,
      user_id: userId,
      target_id: targetId,
      allowed,
      reason: reason || null,
      created_at: new Date().toISOString()
    });
  } catch (error) {
    // Log to console but don't fail the operation
    console.error('Failed to log enforcement action:', error);
  }
}

/**
 * Tier violation error codes for standardized handling
 */
export const TIER_ERROR_CODES = {
  TIER_MISMATCH: 'tier_mismatch',
  TIER_VISIBILITY_RESTRICTED: 'tier_visibility_restricted',
  TIER_NOT_ACTIVE: 'tier_not_active',
  TIER_INSUFFICIENT: 'tier_insufficient'
} as const;

export type TierErrorCode = typeof TIER_ERROR_CODES[keyof typeof TIER_ERROR_CODES];

/**
 * HTTP status codes for tier violations
 */
export const TIER_VIOLATION_STATUS = 403;

/**
 * Check if an error is a tier-related error
 */
export function isTierError(error: any): boolean {
  if (!error) return false;
  const code = error.code || error.message;
  return Object.values(TIER_ERROR_CODES).some(tierCode => 
    code?.includes(tierCode)
  );
}
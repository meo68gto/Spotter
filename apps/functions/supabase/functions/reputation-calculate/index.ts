// Reputation Calculate Edge Function
// Calculate and retrieve user reputation scores
// Routes: POST /reputation/calculate, GET /reputation/get/:id

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import { corsHeaders } from '../_shared/cors.ts';
import { TIER_SLUGS, canSeeSameTier, TierSlug } from '../_shared/tier-gate.ts';

// Initialize Supabase client
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface ReputationWeights {
  completionRate: number;
  ratingsAverage: number;
  networkSize: number;
  referralsCount: number;
  profileCompleteness: number;
  attendanceRate: number;
}

// Default reputation weights
const DEFAULT_WEIGHTS: ReputationWeights = {
  completionRate: 0.25,    // 25% - rounds completed vs scheduled
  ratingsAverage: 0.20,      // 20% - average ratings from other players
  networkSize: 0.15,       // 15% - number of connections
  referralsCount: 0.15,    // 15% - introductions made
  profileCompleteness: 0.15, // 15% - % of profile filled
  attendanceRate: 0.10      // 10% - showed up vs registered
};

interface ReputationData {
  userId: string;
  overallScore: number;
  completionRate: number;
  ratingsAverage: number;
  networkSize: number;
  referralsCount: number;
  profileCompleteness: number;
  attendanceRate: number;
  calculatedAt: string;
}

serve(async (req) => {
  // CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Get auth header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized', code: 'missing_auth_header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create client with user's JWT for auth check
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      global: { headers: { Authorization: authHeader } }
    });

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized', code: 'invalid_token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Route based on method
    if (req.method === 'POST') {
      // POST /reputation/calculate - Calculate reputation for a user
      return await calculateReputation(supabase, user.id, req);
    } else if (req.method === 'GET') {
      // GET /reputation/get/:id - Get user's reputation
      return await getReputation(supabase, user.id, req);
    } else {
      return new Response(
        JSON.stringify({ error: 'Method not allowed', code: 'method_not_allowed' }),
        { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Internal server error', code: 'internal_error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

/**
 * Calculate reputation for a user
 */
async function calculateReputation(supabase: any, userId: string, req: Request) {
  // Parse request body
  let weights = DEFAULT_WEIGHTS;
  let targetUserId = userId;
  
  try {
    const body = await req.json();
    if (body.weights) {
      weights = { ...DEFAULT_WEIGHTS, ...body.weights };
    }
    if (body.userId) {
      targetUserId = body.userId;
    }
  } catch {
    // Use defaults
  }

  // Only allow calculating own reputation or admin (simplified check)
  if (targetUserId !== userId) {
    // Check if current user is same tier
    const { data: currentUser } = await supabase
      .from('users')
      .select('tier_id, membership_tiers(slug)')
      .eq('id', userId)
      .single();

    const { data: targetUser } = await supabase
      .from('users')
      .select('tier_id, membership_tiers(slug)')
      .eq('id', targetUserId)
      .single();

    const currentTier = currentUser?.membership_tiers?.slug as TierSlug || TIER_SLUGS.FREE;
    const targetTier = targetUser?.membership_tiers?.slug as TierSlug || TIER_SLUGS.FREE;

    if (!canSeeSameTier(currentTier, targetTier)) {
      return new Response(
        JSON.stringify({ 
          error: 'Cannot calculate reputation for users outside your tier', 
          code: 'tier_visibility_restricted' 
        }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  }

  // Calculate each component
  const completionRate = await calculateCompletionRate(supabase, targetUserId);
  const ratingsAverage = await calculateRatingsAverage(supabase, targetUserId);
  const networkSize = await calculateNetworkSize(supabase, targetUserId);
  const referralsCount = await calculateReferralsCount(supabase, targetUserId);
  const profileCompleteness = await calculateProfileCompleteness(supabase, targetUserId);
  const attendanceRate = await calculateAttendanceRate(supabase, targetUserId);

  // Calculate weighted overall score (0-100)
  const overallScore = Math.round(
    (completionRate * weights.completionRate +
     ratingsAverage * weights.ratingsAverage +
     Math.min(networkSize / 100, 1) * 100 * weights.networkSize +
     Math.min(referralsCount / 20, 1) * 100 * weights.referralsCount +
     profileCompleteness * weights.profileCompleteness +
     attendanceRate * weights.attendanceRate)
  );

  // Store reputation in database
  const { data: reputation, error: reputationError } = await supabase
    .from('user_reputation')
    .upsert({
      user_id: targetUserId,
      overall_score: overallScore,
      completion_rate: completionRate,
      ratings_average: ratingsAverage,
      network_size: networkSize,
      referrals_count: referralsCount,
      profile_completeness: profileCompleteness,
      attendance_rate: attendanceRate,
      calculated_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }, { onConflict: 'user_id' })
    .select()
    .single();

  if (reputationError) {
    return new Response(
      JSON.stringify({ error: 'Failed to store reputation', code: 'store_failed', details: reputationError.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const response: ReputationData = {
    userId: targetUserId,
    overallScore,
    completionRate,
    ratingsAverage,
    networkSize,
    referralsCount,
    profileCompleteness,
    attendanceRate,
    calculatedAt: reputation.calculated_at
  };

  return new Response(
    JSON.stringify({ data: response }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

/**
 * Get reputation for a user
 */
async function getReputation(supabase: any, userId: string, req: Request) {
  // Parse URL to get target user ID
  const url = new URL(req.url);
  const pathParts = url.pathname.split('/');
  const targetUserId = pathParts[pathParts.length - 1] === 'get' 
    ? userId 
    : pathParts[pathParts.length - 1];

  // Check visibility permissions
  if (targetUserId !== userId) {
    const { data: currentUser } = await supabase
      .from('users')
      .select('tier_id, membership_tiers(slug)')
      .eq('id', userId)
      .single();

    const { data: targetUser } = await supabase
      .from('users')
      .select('tier_id, membership_tiers(slug)')
      .eq('id', targetUserId)
      .single();

    const currentTier = currentUser?.membership_tiers?.slug as TierSlug || TIER_SLUGS.FREE;
    const targetTier = targetUser?.membership_tiers?.slug as TierSlug || TIER_SLUGS.FREE;

    if (!canSeeSameTier(currentTier, targetTier)) {
      return new Response(
        JSON.stringify({ 
          error: 'Cannot view reputation for users outside your tier', 
          code: 'tier_visibility_restricted' 
        }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  }

  // Get reputation from database
  const { data: reputation, error } = await supabase
    .from('user_reputation')
    .select('*')
    .eq('user_id', targetUserId)
    .maybeSingle();

  if (error) {
    return new Response(
      JSON.stringify({ error: 'Failed to fetch reputation', code: 'fetch_failed', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  if (!reputation) {
    // No reputation record yet - return default values
    const response: ReputationData = {
      userId: targetUserId,
      overallScore: 0,
      completionRate: 0,
      ratingsAverage: 0,
      networkSize: 0,
      referralsCount: 0,
      profileCompleteness: 0,
      attendanceRate: 0,
      calculatedAt: new Date().toISOString()
    };

    return new Response(
      JSON.stringify({ data: response }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const response: ReputationData = {
    userId: targetUserId,
    overallScore: reputation.overall_score || 0,
    completionRate: reputation.completion_rate || 0,
    ratingsAverage: reputation.ratings_average || 0,
    networkSize: reputation.network_size || 0,
    referralsCount: reputation.referrals_count || 0,
    profileCompleteness: reputation.profile_completeness || 0,
    attendanceRate: reputation.attendance_rate || 0,
    calculatedAt: reputation.calculated_at
  };

  return new Response(
    JSON.stringify({ data: response }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

/**
 * Calculate completion rate: rounds completed vs scheduled
 */
async function calculateCompletionRate(supabase: any, userId: string): Promise<number> {
  // Get total rounds participated in
  const { count: totalRounds } = await supabase
    .from('round_participants')
    .select('*', { count: 'exact', head: true })
    .eq('member_id', userId)
    .neq('status', 'declined');

  if (!totalRounds || totalRounds === 0) {
    return 100; // No rounds = perfect completion
  }

  // Get completed rounds (participated and round is completed)
  const { count: completedRounds } = await supabase
    .from('round_participants')
    .select('*', { count: 'exact', head: true })
    .eq('member_id', userId)
    .eq('status', 'checked_in');

  return Math.round(((completedRounds || 0) / totalRounds) * 100);
}

/**
 * Calculate average ratings from other players
 */
async function calculateRatingsAverage(supabase: any, userId: string): Promise<number> {
  // Get ratings from round ratings/reviews
  const { data: ratings } = await supabase
    .from('round_ratings')
    .select('rating')
    .eq('rated_user_id', userId);

  if (!ratings || ratings.length === 0) {
    // No ratings yet - return neutral score
    return 50;
  }

  const avg = ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length;
  // Convert to 0-100 scale (assuming rating is 1-5)
  return Math.round((avg / 5) * 100);
}

/**
 * Calculate network size
 */
async function calculateNetworkSize(supabase: any, userId: string): Promise<number> {
  const { count } = await supabase
    .from('user_connections')
    .select('*', { count: 'exact', head: true })
    .or(`and(user_id.eq.${userId},status.eq.accepted),and(connected_user_id.eq.${userId},status.eq.accepted)`);

  return count || 0;
}

/**
 * Calculate referrals count (introductions made)
 */
async function calculateReferralsCount(supabase: any, userId: string): Promise<number> {
  const { count } = await supabase
    .from('introduction_requests')
    .select('*', { count: 'exact', head: true })
    .eq('introducer_id', userId)
    .eq('status', 'accepted');

  return count || 0;
}

/**
 * Calculate profile completeness from user record
 */
async function calculateProfileCompleteness(supabase: any, userId: string): Promise<number> {
  const { data: user } = await supabase
    .from('users')
    .select('profile_completeness')
    .eq('id', userId)
    .single();

  return user?.profile_completeness || 0;
}

/**
 * Calculate attendance rate: showed up vs registered
 */
async function calculateAttendanceRate(supabase: any, userId: string): Promise<number> {
  // Get rounds where user was confirmed (should have attended)
  const { count: confirmedRounds } = await supabase
    .from('round_participants')
    .select('*', { count: 'exact', head: true })
    .eq('member_id', userId)
    .eq('status', 'confirmed');

  if (!confirmedRounds || confirmedRounds === 0) {
    return 100; // No confirmed rounds = perfect attendance
  }

  // Get rounds where user checked in (attended)
  const { count: attendedRounds } = await supabase
    .from('round_participants')
    .select('*', { count: 'exact', head: true })
    .eq('member_id', userId)
    .eq('status', 'checked_in');

  // Also count no-shows
  const { count: noShowRounds } = await supabase
    .from('round_participants')
    .select('*', { count: 'exact', head: true })
    .eq('member_id', userId)
    .eq('status', 'no_show');

  const total = confirmedRounds + (noShowRounds || 0);
  if (total === 0) return 100;

  return Math.round(((attendedRounds || 0) / total) * 100);
}

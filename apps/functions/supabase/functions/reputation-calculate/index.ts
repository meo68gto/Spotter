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
  showRate: number;
  ratingsAverage: number;
  networkSize: number;
  vouchCount: number;
}

// Default reputation weights — EPIC-6 spec
const DEFAULT_WEIGHTS: ReputationWeights = {
  showRate: 0.40,         // 40% — punctuality-based show rate
  ratingsAverage: 0.30,   // 30% — round ratings (punctuality, etiquette, enjoyment)
  networkSize: 0.20,       // 20% — connections count
  vouchCount: 0.10         // 10% — active vouches
};

interface ReputationData {
  userId: string;
  overallScore: number;
  showRate: number;
  ratingsAverage: number;
  networkSize: number;
  vouchCount: number;
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

  // Calculate each component — EPIC-6 reliability score weights
  const showRate = await calculateShowRate(supabase, targetUserId);
  const ratingsAverage = await calculateRatingsAverage(supabase, targetUserId);
  const networkSize = await calculateNetworkSize(supabase, targetUserId);
  const vouchCount = await calculateVouchCount(supabase, targetUserId);

  // Calculate weighted overall score (0-100)
  // showRate and ratingsAverage are already 0-100; networkSize and vouchCount are raw counts
  const overallScore = Math.round(
    (showRate * weights.showRate) +
    (ratingsAverage * weights.ratingsAverage) +
    (Math.min(networkSize / 50, 1) * 100 * weights.networkSize) +
    (Math.min(vouchCount / 5, 1) * 100 * weights.vouchCount)
  );

  // Store reputation in database
  const { data: reputation, error: reputationError } = await supabase
    .from('user_reputation')
    .upsert({
      user_id: targetUserId,
      overall_score: overallScore,
      show_rate: showRate,
      ratings_average: ratingsAverage,
      network_size: networkSize,
      vouch_count: vouchCount,
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
    showRate,
    ratingsAverage,
    networkSize,
    vouchCount,
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
      showRate: 0,
      ratingsAverage: 0,
      networkSize: 0,
      vouchCount: 0,
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
    showRate: reputation.show_rate || 0,
    ratingsAverage: reputation.ratings_average || 0,
    networkSize: reputation.network_size || 0,
    vouchCount: reputation.vouch_count || 0,
    calculatedAt: reputation.calculated_at
  };

  return new Response(
    JSON.stringify({ data: response }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

/**
 * Calculate show rate: rounds attended vs rounds registered
 */
async function calculateShowRate(supabase: any, userId: string): Promise<number> {
  // Get all rounds where user had a committed status
  const { count: totalRounds } = await supabase
    .from('round_participants_v2')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .in('status', ['confirmed', 'checked_in', 'no_show']);

  if (!totalRounds || totalRounds === 0) {
    return 100; // No rounds = perfect show rate
  }

  // Get rounds where user actually showed up
  const { count: attendedRounds } = await supabase
    .from('round_participants_v2')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('status', 'checked_in');

  return Math.round(((attendedRounds || 0) / totalRounds) * 100);
}

/**
 * Calculate average ratings from other players
 * FIX: uses correct columns punctuality, golf_etiquette, enjoyment (not non-existent 'rating')
 */
async function calculateRatingsAverage(supabase: any, userId: string): Promise<number> {
  const { data, error } = await supabase
    .from('round_ratings')
    .select('punctuality, golf_etiquette, enjoyment')
    .eq('rated_user_id', userId);

  if (error || !data || data.length === 0) {
    return 50; // No ratings yet - neutral score
  }

  const avg = data.reduce((sum: number, r: any) => {
    return sum + ((r.punctuality + r.golf_etiquette + r.enjoyment) / 3);
  }, 0) / data.length;

  // Convert 1-5 scale to 0-100
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
 * Calculate vouch count (active vouches received)
 */
async function calculateVouchCount(supabase: any, userId: string): Promise<number> {
  const { count } = await supabase
    .from('vouches')
    .select('*', { count: 'exact', head: true })
    .eq('vouched_id', userId)
    .eq('status', 'active');

  return count || 0;
}

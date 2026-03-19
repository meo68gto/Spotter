// Matching Suggestions Edge Function
// Provides golf partner matching based on compatibility algorithm
// Routes: GET /matching/suggestions, POST /matching/calculate

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import { corsHeaders } from '../_shared/cors.ts';

// Initialize Supabase client
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

// Match score weights (must sum to 1.0)
const MATCH_WEIGHTS = {
  handicap: 0.30,
  networkingIntent: 0.25,
  location: 0.20,
  availability: 0.15,
  groupSize: 0.10,
};

// Score thresholds
const SCORE_TIERS = {
  excellent: { min: 80, max: 100, label: 'Excellent Match' },
  good: { min: 60, max: 79, label: 'Good Match' },
  fair: { min: 40, max: 59, label: 'Fair Match' },
  poor: { min: 0, max: 39, label: 'Poor Match' },
};

interface CompatibilityFactor {
  factor: string;
  label: string;
  rawScore: number;
  weight: number;
  weightedScore: number;
  description: string;
}

interface MatchScore {
  targetUserId: string;
  targetDisplayName: string;
  targetAvatarUrl: string | null;
  overallScore: number;
  tier: 'excellent' | 'good' | 'fair' | 'poor';
  factors: CompatibilityFactor[];
  reasoning: string;
  calculatedAt: string;
}

interface MatchSuggestion {
  matchScore: MatchScore;
  user: {
    id: string;
    displayName: string;
    avatarUrl: string | null;
    city: string | null;
  };
  golf: {
    handicap: number | null;
    homeCourseName: string | null;
    yearsPlaying: number | null;
  } | null;
  professional: {
    company: string | null;
    title: string | null;
    industry: string | null;
  } | null;
  networking: {
    intent: string;
    preferredGroupSize: string;
    openToIntros: boolean;
    preferredGolfArea: string | null;
  } | null;
  mutualConnections: number;
  sharedCourses: number;
  distanceKm: number | null;
}

serve(async (req) => {
  // CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // Get auth header
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response(
      JSON.stringify({ error: 'Unauthorized', code: 'missing_auth_header' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    // Create client with user's JWT
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
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

    // Parse URL to determine endpoint
    const url = new URL(req.url);
    const path = url.pathname;

    if (req.method === 'GET' && path.includes('/suggestions')) {
      // GET /matching/suggestions - Get top matches
      const limit = Math.min(parseInt(url.searchParams.get('limit') || '10'), 50);
      const minScore = parseInt(url.searchParams.get('minScore') || '0');
      return await getTopMatches(supabase, user.id, limit, minScore);
    } else if (req.method === 'POST' && path.includes('/calculate')) {
      // POST /matching/calculate - Calculate match with specific user
      const body = await req.json().catch(() => ({}));
      const { targetUserId } = body;
      
      if (!targetUserId) {
        return new Response(
          JSON.stringify({ error: 'targetUserId is required in request body', code: 'missing_target_user' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      return await calculateMatchWithUser(supabase, user.id, targetUserId);
    } else {
      return new Response(
        JSON.stringify({ error: 'Not found', code: 'not_found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

  } catch (error) {
    console.error('Matching error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Internal server error', code: 'internal_error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

/**
 * Get top matches for the authenticated user
 */
async function getTopMatches(
  supabase: any,
  userId: string,
  limit: number,
  minScore: number
) {
  const startTime = Date.now();

  // Call the PostgreSQL function to get top matches
  const { data: matches, error } = await supabase.rpc('get_top_matches', {
    p_user_id: userId,
    p_limit: limit,
    p_min_score: minScore,
  });

  if (error) {
    console.error('Error fetching top matches:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to fetch matches', code: 'fetch_failed', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Get mutual connections count for each match
  const targetUserIds = matches?.map((m: any) => m.target_user_id) || [];
  const mutualConnectionsMap = await getMutualConnectionsCount(supabase, userId, targetUserIds);

  // Transform matches into response format
  const transformedMatches: MatchSuggestion[] = (matches || []).map((match: any) => {
    const factors: CompatibilityFactor[] = [
      {
        factor: 'handicap',
        label: 'Handicap Similarity',
        rawScore: match.handicap_score,
        weight: MATCH_WEIGHTS.handicap,
        weightedScore: match.handicap_score * MATCH_WEIGHTS.handicap,
        description: getHandicapDescription(match.user1_handicap, match.user2_handicap),
      },
      {
        factor: 'networking_intent',
        label: 'Networking Intent',
        rawScore: match.networking_intent_score,
        weight: MATCH_WEIGHTS.networkingIntent,
        weightedScore: match.networking_intent_score * MATCH_WEIGHTS.networkingIntent,
        description: getIntentDescription(match.user1_intent, match.user2_intent),
      },
      {
        factor: 'location',
        label: 'Location Proximity',
        rawScore: match.location_score,
        weight: MATCH_WEIGHTS.location,
        weightedScore: match.location_score * MATCH_WEIGHTS.location,
        description: getLocationDescription(match.distance_km),
      },
      {
        factor: 'group_size',
        label: 'Group Size Preference',
        rawScore: match.group_size_score,
        weight: MATCH_WEIGHTS.groupSize,
        weightedScore: match.group_size_score * MATCH_WEIGHTS.groupSize,
        description: getGroupSizeDescription(match.user1_group_size, match.user2_group_size),
      },
    ];

    const matchScore: MatchScore = {
      targetUserId: match.target_user_id,
      targetDisplayName: match.target_display_name,
      targetAvatarUrl: match.target_avatar_url,
      overallScore: Math.round(match.match_score),
      tier: getMatchTier(match.match_score),
      factors,
      reasoning: generateReasoning(factors),
      calculatedAt: new Date().toISOString(),
    };

    return {
      matchScore,
      user: {
        id: match.target_user_id,
        displayName: match.target_display_name,
        avatarUrl: match.target_avatar_url,
        city: match.target_city,
      },
      golf: match.target_handicap !== null ? {
        handicap: match.target_handicap,
        homeCourseName: null, // Would need additional query
        yearsPlaying: null,
      } : null,
      professional: match.target_professional_company ? {
        company: match.target_professional_company,
        title: match.target_professional_title,
        industry: match.target_professional_industry,
      } : null,
      networking: match.target_intent ? {
        intent: match.target_intent,
        preferredGroupSize: match.target_group_size || 'any',
        openToIntros: true,
        preferredGolfArea: null,
      } : null,
      mutualConnections: mutualConnectionsMap.get(match.target_user_id) || 0,
      sharedCourses: 0, // Would need additional query
      distanceKm: match.distance_km,
    };
  });

  const calculationTimeMs = Date.now() - startTime;

  return new Response(
    JSON.stringify({
      userId,
      totalMatches: transformedMatches.length,
      limit,
      matches: transformedMatches,
      metadata: {
        calculationTimeMs,
        filtersApplied: ['same_tier', 'open_to_intros'],
        candidatePoolSize: matches?.length || 0,
      },
    }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

/**
 * Calculate match score with a specific user
 */
async function calculateMatchWithUser(
  supabase: any,
  userId: string,
  targetUserId: string
) {
  // Validate target user exists and is in same tier
  const { data: targetUser, error: targetError } = await supabase
    .from('users')
    .select('id, display_name, tier_id')
    .eq('id', targetUserId)
    .single();

  if (targetError || !targetUser) {
    return new Response(
      JSON.stringify({ error: 'Target user not found', code: 'user_not_found' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Check same tier
  const { data: currentUser } = await supabase
    .from('users')
    .select('tier_id')
    .eq('id', userId)
    .single();

  if (currentUser?.tier_id !== targetUser.tier_id) {
    return new Response(
      JSON.stringify({ error: 'Can only calculate matches with users in the same tier', code: 'different_tier' }),
      { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Call the PostgreSQL function to calculate match score
  const { data: matchData, error } = await supabase.rpc('calculate_match_score', {
    user_id_1: userId,
    user_id_2: targetUserId,
  });

  if (error) {
    console.error('Error calculating match:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to calculate match', code: 'calculation_failed', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  if (!matchData || matchData.length === 0) {
    return new Response(
      JSON.stringify({ error: 'Could not calculate match score', code: 'calculation_failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const result = matchData[0];

  const factors: CompatibilityFactor[] = [
    {
      factor: 'handicap',
      label: 'Handicap Similarity',
      rawScore: result.handicap_score,
      weight: MATCH_WEIGHTS.handicap,
      weightedScore: result.handicap_score * MATCH_WEIGHTS.handicap,
      description: getHandicapDescription(result.user1_handicap, result.user2_handicap),
    },
    {
      factor: 'networking_intent',
      label: 'Networking Intent',
      rawScore: result.networking_intent_score,
      weight: MATCH_WEIGHTS.networkingIntent,
      weightedScore: result.networking_intent_score * MATCH_WEIGHTS.networkingIntent,
      description: getIntentDescription(result.user1_intent, result.user2_intent),
    },
    {
      factor: 'location',
      label: 'Location Proximity',
      rawScore: result.location_score,
      weight: MATCH_WEIGHTS.location,
      weightedScore: result.location_score * MATCH_WEIGHTS.location,
      description: getLocationDescription(result.distance_km),
    },
    {
      factor: 'group_size',
      label: 'Group Size Preference',
      rawScore: result.group_size_score,
      weight: MATCH_WEIGHTS.groupSize,
      weightedScore: result.group_size_score * MATCH_WEIGHTS.groupSize,
      description: getGroupSizeDescription(result.user1_group_size, result.user2_group_size),
    },
  ];

  const matchScore: MatchScore = {
    targetUserId,
    targetDisplayName: targetUser.display_name,
    targetAvatarUrl: null,
    overallScore: Math.round(result.match_score),
    tier: getMatchTier(result.match_score),
    factors,
    reasoning: generateReasoning(factors),
    calculatedAt: new Date().toISOString(),
  };

  return new Response(
    JSON.stringify({
      userId,
      targetUserId,
      matchScore,
    }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

/**
 * Get mutual connections count for multiple users
 */
async function getMutualConnectionsCount(
  supabase: any,
  userId: string,
  targetUserIds: string[]
): Promise<Map<string, number>> {
  if (targetUserIds.length === 0) {
    return new Map();
  }

  const mutualMap = new Map<string, number>();

  // Get current user's connections
  const { data: userConnections } = await supabase
    .from('user_connections')
    .select('user_id, connected_user_id')
    .or(`and(user_id.eq.${userId},status.eq.accepted),and(connected_user_id.eq.${userId},status.eq.accepted)`);

  const userConnectionIds = new Set<string>();
  for (const conn of userConnections || []) {
    if (conn.user_id === userId) {
      userConnectionIds.add(conn.connected_user_id);
    } else {
      userConnectionIds.add(conn.user_id);
    }
  }

  // For each target user, find mutual connections
  for (const targetId of targetUserIds) {
    const { data: targetConnections } = await supabase
      .from('user_connections')
      .select('user_id, connected_user_id')
      .or(`and(user_id.eq.${targetId},status.eq.accepted),and(connected_user_id.eq.${targetId},status.eq.accepted)`);

    const targetConnectionIds = new Set<string>();
    for (const conn of targetConnections || []) {
      if (conn.user_id === targetId) {
        targetConnectionIds.add(conn.connected_user_id);
      } else {
        targetConnectionIds.add(conn.user_id);
      }
    }

    const mutualCount = [...userConnectionIds].filter(id => 
      targetConnectionIds.has(id) && id !== userId && id !== targetId
    ).length;

    mutualMap.set(targetId, mutualCount);
  }

  return mutualMap;
}

// Helper functions

function getMatchTier(score: number): 'excellent' | 'good' | 'fair' | 'poor' {
  if (score >= SCORE_TIERS.excellent.min) return 'excellent';
  if (score >= SCORE_TIERS.good.min) return 'good';
  if (score >= SCORE_TIERS.fair.min) return 'fair';
  return 'poor';
}

function getHandicapDescription(h1: number | null, h2: number | null): string {
  if (h1 == null || h2 == null) {
    return 'One or both handicaps not provided';
  }
  const diff = Math.abs(h1 - h2);
  if (diff <= 5) return `Very similar skill level (${diff.toFixed(1)} strokes apart)`;
  if (diff <= 10) return `Compatible skill levels (${diff.toFixed(1)} strokes apart)`;
  if (diff <= 15) return `Moderate skill difference (${diff.toFixed(1)} strokes apart)`;
  return `Significant skill difference (${diff.toFixed(1)} strokes apart)`;
}

function getIntentDescription(i1: string | null, i2: string | null): string {
  if (!i1 || !i2) return 'Networking intent not specified';
  if (i1 === i2) return `Both seeking ${i1.replace('_', ' ')} connections`;
  return `${i1.replace('_', ' ')} + ${i2.replace('_', ' ')} intent alignment`;
}

function getLocationDescription(distance: number | null): string {
  if (distance == null) return 'Location not available';
  if (distance <= 10) return `Same area (${distance.toFixed(1)} km away)`;
  if (distance <= 50) return `Nearby (${distance.toFixed(1)} km away)`;
  return `Different area (${distance.toFixed(1)} km away)`;
}

function getGroupSizeDescription(s1: string | null, s2: string | null): string {
  if (!s1 || !s2) return 'Group size preference not specified';
  if (s1 === 'any' || s2 === 'any') return 'Flexible group size preferences';
  if (s1 === s2) return `Both prefer ${s1 === '4' ? 'foursomes' : s1 === '3' ? 'threesomes' : 'twosomes'}`;
  return `Different group size preferences (${s1} vs ${s2})`;
}

function generateReasoning(factors: CompatibilityFactor[]): string {
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

// Phase 2: Golf Rounds Create Edge Function
// Handles creating new golf rounds with same-tier enforcement and tier limits

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import { corsHeaders } from '../_shared/cors.ts';
import { TIER_SLUGS, getTierFeatures, TierSlug } from '../_shared/tier-gate.ts';

// Initialize Supabase client
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// Valid max players options
const VALID_MAX_PLAYERS = [2, 3, 4] as const;
type MaxPlayers = typeof VALID_MAX_PLAYERS[number];

// Valid cart preferences
const VALID_CART_PREFERENCES = ['walking', 'cart', 'either'] as const;
type CartPreference = typeof VALID_CART_PREFERENCES[number];

interface CreateRoundRequest {
  courseId: string;
  scheduledAt: string; // ISO 8601 datetime
  maxPlayers?: MaxPlayers;
  cartPreference?: CartPreference;
  notes?: string;
}

interface RoundResponse {
  id: string;
  creatorId: string;
  courseId: string;
  courseName: string;
  courseCity: string;
  courseState: string;
  scheduledAt: string;
  maxPlayers: number;
  cartPreference: CartPreference;
  tierId: string;
  tierSlug: string;
  status: string;
  confirmedParticipants: number;
  notes: string | null;
  createdAt: string;
}

serve(async (req) => {
  // CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // Only allow POST
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed', code: 'method_not_allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
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

    // Parse request body
    let body: CreateRoundRequest;
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: 'Invalid JSON body', code: 'invalid_json' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate required fields
    if (!body.courseId) {
      return new Response(
        JSON.stringify({ error: 'course_id is required', code: 'missing_course_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!body.scheduledAt) {
      return new Response(
        JSON.stringify({ error: 'scheduled_at is required', code: 'missing_scheduled_at' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate scheduled_at is a valid future date
    const scheduledAt = new Date(body.scheduledAt);
    const now = new Date();
    if (isNaN(scheduledAt.getTime())) {
      return new Response(
        JSON.stringify({ error: 'scheduled_at must be a valid ISO 8601 datetime', code: 'invalid_scheduled_at' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    if (scheduledAt <= now) {
      return new Response(
        JSON.stringify({ error: 'scheduled_at must be in the future', code: 'past_scheduled_at' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate max_players if provided
    const maxPlayers = body.maxPlayers || 4;
    if (!VALID_MAX_PLAYERS.includes(maxPlayers as MaxPlayers)) {
      return new Response(
        JSON.stringify({ 
          error: `Invalid max_players. Must be one of: ${VALID_MAX_PLAYERS.join(', ')}`, 
          code: 'invalid_max_players' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate cart_preference if provided
    const cartPreference = body.cartPreference || 'either';
    if (!VALID_CART_PREFERENCES.includes(cartPreference as CartPreference)) {
      return new Response(
        JSON.stringify({ 
          error: `Invalid cart_preference. Must be one of: ${VALID_CART_PREFERENCES.join(', ')}`, 
          code: 'invalid_cart_preference' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get user with tier info
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select(`
        id,
        tier_id,
        tier_status,
        membership_tiers (
          id,
          slug
        )
      `)
      .eq('id', user.id)
      .single();

    if (userError || !userData) {
      return new Response(
        JSON.stringify({ error: 'User not found', code: 'user_not_found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const tier = userData.membership_tiers as { id: string; slug: TierSlug } | null;
    const tierSlug = tier?.slug || TIER_SLUGS.FREE;
    const tierFeatures = getTierFeatures(tierSlug);
    const tierId = tier?.id || '';

    // Check if user can create rounds (tier check)
    if (!tierFeatures.canCreateRounds) {
      return new Response(
        JSON.stringify({ 
          error: 'Your tier does not allow creating rounds. Upgrade to Select or Summit.', 
          code: 'tier_insufficient',
          currentTier: tierSlug,
          requiredTier: TIER_SLUGS.SELECT
        }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check tier status is active
    if (userData.tier_status !== 'active') {
      return new Response(
        JSON.stringify({ 
          error: 'Your membership is not active', 
          code: 'tier_not_active',
          tierStatus: userData.tier_status
        }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check max rounds per month limit
    if (tierFeatures.maxRoundsPerMonth !== null) {
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const { count: roundsThisMonth, error: countError } = await supabase
        .from('rounds')
        .select('*', { count: 'exact', head: true })
        .eq('creator_id', user.id)
        .gte('created_at', startOfMonth.toISOString());

      if (countError) {
        console.error('Error counting rounds:', countError);
      } else if ((roundsThisMonth || 0) >= tierFeatures.maxRoundsPerMonth) {
        return new Response(
          JSON.stringify({ 
            error: `You have reached your monthly limit of ${tierFeatures.maxRoundsPerMonth} rounds`, 
            code: 'round_limit_reached',
            limit: tierFeatures.maxRoundsPerMonth,
            used: roundsThisMonth
          }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Validate course exists
    const { data: course, error: courseError } = await supabase
      .from('golf_courses')
      .select('id, name, city, state, is_active')
      .eq('id', body.courseId)
      .single();

    if (courseError || !course) {
      return new Response(
        JSON.stringify({ error: 'Course not found', code: 'course_not_found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!course.is_active) {
      return new Response(
        JSON.stringify({ error: 'Course is not active', code: 'course_inactive' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create the round (creator is auto-added as participant via trigger)
    const { data: round, error: roundError } = await supabase
      .from('rounds')
      .insert({
        creator_id: user.id,
        course_id: body.courseId,
        scheduled_at: body.scheduledAt,
        max_players: maxPlayers,
        cart_preference: cartPreference,
        tier_id: tierId,
        notes: body.notes?.substring(0, 500) ?? null,
        status: 'open'
      })
      .select('id, creator_id, course_id, scheduled_at, max_players, cart_preference, tier_id, status, notes, created_at')
      .single();

    if (roundError || !round) {
      console.error('Error creating round:', roundError);
      return new Response(
        JSON.stringify({ error: 'Failed to create round', code: 'create_failed', details: roundError?.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get participant count
    const { count: participantCount } = await supabase
      .from('round_participants_v2')
      .select('*', { count: 'exact', head: true })
      .eq('round_id', round.id);

    // Build response
    const response: RoundResponse = {
      id: round.id,
      creatorId: round.creator_id,
      courseId: round.course_id,
      courseName: course.name,
      courseCity: course.city,
      courseState: course.state,
      scheduledAt: round.scheduled_at,
      maxPlayers: round.max_players,
      cartPreference: round.cart_preference as CartPreference,
      tierId: round.tier_id,
      tierSlug: tierSlug,
      status: round.status,
      confirmedParticipants: participantCount || 1,
      notes: round.notes,
      createdAt: round.created_at
    };

    return new Response(
      JSON.stringify({ data: response }),
      { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Rounds create error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Internal server error', code: 'internal_error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

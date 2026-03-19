// Golf Rounds Create Edge Function
// Handles creating new golf rounds with tier validation

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import { corsHeaders } from '../_shared/cors.ts';
import { TIER_SLUGS, getTierFeatures, TierSlug, TIER_PRIORITY } from '../_shared/tier-gate.ts';

// Initialize Supabase client
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// Valid round formats
const VALID_FORMATS = ['casual', 'competitive', 'scramble', 'best_ball', 'match_play'] as const;
type RoundFormat = typeof VALID_FORMATS[number];

// Valid visibility levels
const VALID_VISIBILITY = ['public', 'tier_only', 'invite_only'] as const;
type RoundVisibility = typeof VALID_VISIBILITY[number];

interface CreateRoundRequest {
  courseId: string;
  roundDate: string;
  teeTime: string;
  format: RoundFormat;
  totalSpots?: number;
  visibility?: RoundVisibility;
  handicapMin?: number;
  handicapMax?: number;
  notes?: string;
}

interface RoundResponse {
  id: string;
  courseId: string;
  courseName: string;
  courseCity: string;
  courseState: string;
  organizerId: string;
  roundDate: string;
  teeTime: string;
  format: RoundFormat;
  totalSpots: number;
  spotsAvailable: number;
  visibility: RoundVisibility;
  handicapMin: number | null;
  handicapMax: number | null;
  notes: string | null;
  status: string;
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

    if (!body.roundDate) {
      return new Response(
        JSON.stringify({ error: 'round_date is required', code: 'missing_round_date' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!body.teeTime) {
      return new Response(
        JSON.stringify({ error: 'tee_time is required', code: 'missing_tee_time' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!body.format) {
      return new Response(
        JSON.stringify({ error: 'format is required', code: 'missing_format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate format
    if (!VALID_FORMATS.includes(body.format as RoundFormat)) {
      return new Response(
        JSON.stringify({ 
          error: `Invalid format. Must be one of: ${VALID_FORMATS.join(', ')}`, 
          code: 'invalid_format' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate round_date is in the future
    const roundDate = new Date(body.roundDate);
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    if (roundDate < now) {
      return new Response(
        JSON.stringify({ error: 'round_date must be in the future', code: 'invalid_round_date' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate tee_time format (HH:MM)
    const teeTimeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (!teeTimeRegex.test(body.teeTime)) {
      return new Response(
        JSON.stringify({ error: 'tee_time must be in HH:MM format', code: 'invalid_tee_time' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate visibility
    const visibility = body.visibility || 'public';
    if (!VALID_VISIBILITY.includes(visibility as RoundVisibility)) {
      return new Response(
        JSON.stringify({ 
          error: `Invalid visibility. Must be one of: ${VALID_VISIBILITY.join(', ')}`, 
          code: 'invalid_visibility' 
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

    const tier = userData.membership_tiers as { slug: TierSlug } | null;
    const tierSlug = tier?.slug || TIER_SLUGS.FREE;
    const tierFeatures = getTierFeatures(tierSlug);

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
        .from('golf_rounds')
        .select('*', { count: 'exact', head: true })
        .eq('organizer_id', user.id)
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
      .select('id, name, city, state, active')
      .eq('id', body.courseId)
      .single();

    if (courseError || !course) {
      return new Response(
        JSON.stringify({ error: 'Course not found', code: 'course_not_found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!course.active) {
      return new Response(
        JSON.stringify({ error: 'Course is not active', code: 'course_inactive' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create the round
    const totalSpots = body.totalSpots || 4;
    const { data: round, error: roundError } = await supabase
      .from('golf_rounds')
      .insert({
        course_id: body.courseId,
        organizer_id: user.id,
        round_date: body.roundDate,
        tee_time: body.teeTime,
        format: body.format,
        total_spots: totalSpots,
        spots_available: totalSpots - 1, // Organizer takes first spot
        visibility: visibility,
        handicap_min: body.handicapMin ?? null,
        handicap_max: body.handicapMax ?? null,
        notes: body.notes ?? null,
        status: 'open'
      })
      .select('id, course_id, round_date, tee_time, format, total_spots, spots_available, visibility, handicap_min, handicap_max, notes, status, created_at')
      .single();

    if (roundError || !round) {
      console.error('Error creating round:', roundError);
      return new Response(
        JSON.stringify({ error: 'Failed to create round', code: 'create_failed', details: roundError?.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Add organizer as first participant
    const { error: participantError } = await supabase
      .from('golf_round_participants')
      .insert({
        round_id: round.id,
        user_id: user.id,
        status: 'confirmed',
        joined_at: new Date().toISOString()
      });

    if (participantError) {
      console.error('Error adding organizer as participant:', participantError);
      // Don't fail the request, but log the error
    }

    // Build response
    const response: RoundResponse = {
      id: round.id,
      courseId: round.course_id,
      courseName: course.name,
      courseCity: course.city,
      courseState: course.state,
      organizerId: user.id,
      roundDate: round.round_date,
      teeTime: round.tee_time,
      format: round.format as RoundFormat,
      totalSpots: round.total_spots,
      spotsAvailable: round.spots_available,
      visibility: round.visibility as RoundVisibility,
      handicapMin: round.handicap_min,
      handicapMax: round.handicap_max,
      notes: round.notes,
      status: round.status,
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

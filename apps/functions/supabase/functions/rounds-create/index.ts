// Epic 5: Golf Rounds Create Edge Function (Updated)
// Handles creating new golf rounds with same-tier enforcement, free tier limits, and network context

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import { corsHeaders } from '../_shared/cors.ts';
import { TIER_SLUGS, getTierFeatures, TierSlug } from '../_shared/tier-gate.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const VALID_MAX_PLAYERS = [2, 3, 4] as const;
type MaxPlayers = typeof VALID_MAX_PLAYERS[number];

const VALID_CART_PREFERENCES = ['walking', 'cart', 'either'] as const;
type CartPreference = typeof VALID_CART_PREFERENCES[number];

interface CreateRoundRequest {
  courseId: string;
  scheduledAt: string;
  maxPlayers?: MaxPlayers;
  cartPreference?: CartPreference;
  notes?: string;
  sourceType?: 'standing_foursome' | 'network_invite' | 'discovery' | 'direct';
  standingFoursomeId?: string;
  networkContext?: {
    mutualConnections?: string[];
    sharedMemberships?: string[];
    referralSource?: string;
  };
  inviteeIds?: string[];
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
  lifecycleStatus: string;
  sourceType: string;
  confirmedParticipants: number;
  invitedCount: number;
  notes: string | null;
  createdAt: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed', code: 'method_not_allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response(
      JSON.stringify({ error: 'Unauthorized', code: 'missing_auth_header' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized', code: 'invalid_token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body: CreateRoundRequest = await req.json();

    // Validation
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
        monthly_rounds_count,
        rounds_count_reset_at,
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

    // GAP 3: FREE tier hard 3-round LIFETIME limit - flag for canCreateRounds bypass
    let freeTierLifetimeCheckPassed = false;

    // Check if user can create rounds (tier check)
    // Free tier CAN create rounds if under the 3-round lifetime limit (checked below)
    if (tierSlug === TIER_SLUGS.FREE) {
      // Free tier: check lifetime limit first, allow creation if under limit
      const { count: lifetimeRounds } = await supabase
        .from('round_participants_v2')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id);
      
      if ((lifetimeRounds || 0) >= 3) {
        return new Response(
          JSON.stringify({ 
            error: 'Free tier is limited to 3 rounds. Upgrade to create more.', 
            code: 'FREE_TIER_LIMIT_REACHED',
            used: lifetimeRounds,
            limit: 3
          }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      freeTierLifetimeCheckPassed = true;
    } else if (!tierFeatures.canCreateRounds) {
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

    // Epic 7: Check monthly round limits for tiers with limits (Select: 4/month)
    // Skip for free tier - they have lifetime limit instead
    if (tierSlug !== TIER_SLUGS.FREE && tierFeatures.maxRoundsPerMonth !== null) {
      const currentMonth = new Date().getMonth();
      const currentYear = new Date().getFullYear();
      const resetMonth = userData.rounds_count_reset_at 
        ? new Date(userData.rounds_count_reset_at).getMonth()
        : currentMonth;
      const resetYear = userData.rounds_count_reset_at 
        ? new Date(userData.rounds_count_reset_at).getFullYear()
        : currentYear;
      
      // Check if we need to reset (new month)
      if (currentMonth !== resetMonth || currentYear !== resetYear) {
        // Reset the counter
        await supabase
          .from('users')
          .update({ 
            monthly_rounds_count: 0,
            rounds_count_reset_at: new Date().toISOString()
          })
          .eq('id', user.id);
        userData.monthly_rounds_count = 0;
      }

      if ((userData.monthly_rounds_count || 0) >= tierFeatures.maxRoundsPerMonth) {
        return new Response(
          JSON.stringify({ 
            error: `You have reached your monthly limit of ${tierFeatures.maxRoundsPerMonth} rounds. Upgrade to create more rounds.`, 
            code: 'round_limit_reached',
            limit: tierFeatures.maxRoundsPerMonth,
            used: userData.monthly_rounds_count,
            upgradeUrl: '/upgrade'
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

    // Determine source type and lifecycle status
    const sourceType = body.sourceType || 'direct';
    const lifecycleStatus = sourceType === 'standing_foursome' ? 'invited' : 'planning';

    // Create the round
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
        status: 'open',
        lifecycle_status: lifecycleStatus,
        source_type: sourceType,
        standing_foursome_id: body.standingFoursomeId ?? null,
        network_context: body.networkContext ?? null
      })
      .select('id, creator_id, course_id, scheduled_at, max_players, cart_preference, tier_id, status, lifecycle_status, source_type, notes, created_at')
      .single();

    if (roundError || !round) {
      return new Response(
        JSON.stringify({ error: 'Failed to create round', code: 'create_failed', details: roundError?.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Send invitations if provided
    let invitedCount = 0;
    if (body.inviteeIds && body.inviteeIds.length > 0) {
      // Validate invitees are valid same-tier users
      const { data: inviteeUsers } = await supabase
        .from('users')
        .select('id, tier_id')
        .in('id', body.inviteeIds)
        .eq('tier_id', tierId);

      const validInviteeIds = new Set(inviteeUsers?.map(u => u.id) || []);

      const invitations = body.inviteeIds
        .filter(id => validInviteeIds.has(id))
        .map(userId => ({
          round_id: round.id,
          invitee_id: userId,
          status: 'pending',
          message: null
        }));

      if (invitations.length > 0) {
        const { error: inviteError } = await supabase
          .from('round_invitations')
          .insert(invitations);
        
        if (!inviteError) {
          invitedCount = invitations.length;
        }
      }
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
      lifecycleStatus: round.lifecycle_status,
      sourceType: round.source_type || 'direct',
      confirmedParticipants: participantCount || 1,
      invitedCount,
      notes: round.notes,
      createdAt: round.created_at
    };

    return new Response(
      JSON.stringify({ data: response }),
      { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Internal server error', code: 'internal_error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

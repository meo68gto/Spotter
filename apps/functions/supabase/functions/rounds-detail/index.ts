// Epic 5: Round Detail Edge Function
// Returns round details with full participant list

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import { corsHeaders } from '../_shared/cors.ts';

// Initialize Supabase client
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface RoundParticipantResponse {
  id: string;
  userId: string;
  displayName: string;
  avatarUrl?: string;
  currentHandicap?: number;
  isCreator: boolean;
  joinedAt: string;
}

interface RoundDetailResponse {
  id: string;
  creatorId: string;
  courseId: string;
  course: {
    id: string;
    name: string;
    city: string;
    state: string;
  };
  scheduledAt: string;
  maxPlayers: number;
  cartPreference: string;
  status: string;
  lifecycleStatus: string;
  reviewWindowClosesAt?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  participants: RoundParticipantResponse[];
  confirmedParticipants: number;
  isParticipant: boolean;
}

serve(async (req) => {
  // CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // Only allow GET
  if (req.method !== 'GET') {
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
    // Create client with user's JWT
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

    // Parse query parameters
    const url = new URL(req.url);
    const roundId = url.searchParams.get('roundId');

    if (!roundId) {
      return new Response(
        JSON.stringify({ error: 'roundId is required', code: 'missing_round_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get user's tier for authorization check
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id, tier_id, display_name')
      .eq('id', user.id)
      .single();

    if (userError || !userData) {
      return new Response(
        JSON.stringify({ error: 'User not found', code: 'user_not_found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userTierId = userData.tier_id;

    // Get round details
    const { data: round, error: roundError } = await supabase
      .from('rounds')
      .select(`
        id,
        creator_id,
        course_id,
        scheduled_at,
        max_players,
        cart_preference,
        status,
        lifecycle_status,
        review_window_closes_at,
        notes,
        tier_id,
        created_at,
        updated_at,
        course:course_id (id, name, city, state)
      `)
      .eq('id', roundId)
      .single();

    if (roundError || !round) {
      return new Response(
        JSON.stringify({ error: 'Round not found', code: 'round_not_found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Same-tier authorization check
    // User must be in the same tier as the round, OR be the creator, OR be a participant
    const isCreator = round.creator_id === user.id;

    // Check if user is a participant
    const { data: userParticipation, error: participationError } = await supabase
      .from('round_participants_v2')
      .select('id')
      .eq('round_id', roundId)
      .eq('user_id', user.id)
      .maybeSingle();

    const isParticipant = !!userParticipation;

    // If not creator and not participant, check tier match
    if (!isCreator && !isParticipant && round.tier_id !== userTierId) {
      return new Response(
        JSON.stringify({ error: 'Access denied: different tier', code: 'tier_mismatch' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get participants with user details
    const { data: participants, error: participantsError } = await supabase
      .from('round_participants_v2')
      .select(`
        id,
        user_id,
        joined_at,
        user:user_id (
          id,
          display_name,
          avatar_url,
          handicaps:user_handicaps (index)
        )
      `)
      .eq('round_id', roundId)
      .order('joined_at', { ascending: true });

    if (participantsError) {
      console.error('Error fetching participants:', participantsError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch participants', code: 'fetch_failed' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Transform participants
    const participantResponses: RoundParticipantResponse[] = (participants || []).map(p => {
      const userData = p.user as any;
      const handicap = userData?.handicaps?.[0]?.index ?? null;

      return {
        id: p.id,
        userId: p.user_id,
        displayName: userData?.display_name || 'Unknown',
        avatarUrl: userData?.avatar_url,
        currentHandicap: handicap,
        isCreator: p.user_id === round.creator_id,
        joinedAt: p.joined_at
      };
    });

    const courseData = round.course as any;

    const response: RoundDetailResponse = {
      id: round.id,
      creatorId: round.creator_id,
      courseId: round.course_id,
      course: {
        id: courseData?.id || round.course_id,
        name: courseData?.name || 'Unknown Course',
        city: courseData?.city || '',
        state: courseData?.state || ''
      },
      scheduledAt: round.scheduled_at,
      maxPlayers: round.max_players,
      cartPreference: round.cart_preference,
      status: round.status,
      lifecycleStatus: round.lifecycle_status || 'planning',
      reviewWindowClosesAt: round.review_window_closes_at || undefined,
      notes: round.notes,
      createdAt: round.created_at,
      updatedAt: round.updated_at,
      participants: participantResponses,
      confirmedParticipants: participantResponses.length,
      isParticipant
    };

    return new Response(
      JSON.stringify({ data: response }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Round detail error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Internal server error', code: 'internal_error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

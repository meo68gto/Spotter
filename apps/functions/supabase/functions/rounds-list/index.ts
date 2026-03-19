// Phase 2: Golf Rounds List Edge Function
// Handles listing rounds for users with same-tier visibility

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import { corsHeaders } from '../_shared/cors.ts';

// Initialize Supabase client
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface RoundResponse {
  id: string;
  creatorId: string;
  creatorName: string;
  creatorAvatarUrl?: string;
  courseId: string;
  courseName: string;
  courseCity: string;
  courseState: string;
  scheduledAt: string;
  maxPlayers: number;
  cartPreference: string;
  confirmedParticipants: number;
  status: string;
  notes?: string;
  myRole: 'creator' | 'participant' | 'invited' | null;
  myInvitationStatus?: string;
  createdAt: string;
}

interface RoundListResponse {
  data: RoundResponse[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
  };
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
    const myRounds = url.searchParams.get('my_rounds') === 'true';
    const statusFilter = url.searchParams.get('status');
    const dateFrom = url.searchParams.get('date_from');
    const dateTo = url.searchParams.get('date_to');
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '20', 10), 100);
    const offset = parseInt(url.searchParams.get('offset') || '0', 10);

    // Get user's tier
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select(`
        id,
        tier_id,
        display_name
      `)
      .eq('id', user.id)
      .single();

    if (userError || !userData) {
      return new Response(
        JSON.stringify({ error: 'User not found', code: 'user_not_found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userTierId = userData.tier_id;

    // Get rounds user participates in or created
    let query;
    
    if (myRounds) {
      // Get user's rounds (created or participating)
      query = supabase
        .from('rounds')
        .select(`
          id,
          creator_id,
          course_id,
          scheduled_at,
          max_players,
          cart_preference,
          status,
          notes,
          created_at,
          creator:creator_id (display_name, avatar_url),
          course:course_id (name, city, state)
        `, { count: 'exact' })
        .eq('creator_id', user.id);
    } else {
      // Get visible rounds (same tier, open/full)
      query = supabase
        .from('rounds')
        .select(`
          id,
          creator_id,
          course_id,
          scheduled_at,
          max_players,
          cart_preference,
          status,
          notes,
          created_at,
          creator:creator_id (display_name, avatar_url),
          course:course_id (name, city, state)
        `, { count: 'exact' })
        .eq('tier_id', userTierId)
        .in('status', ['open', 'full']);
      
      // Exclude user's own rounds
      query = query.neq('creator_id', user.id);
    }

    // Apply status filter
    if (statusFilter) {
      query = query.eq('status', statusFilter);
    }

    // Apply date filters
    if (dateFrom) {
      query = query.gte('scheduled_at', dateFrom);
    }
    if (dateTo) {
      query = query.lte('scheduled_at', dateTo);
    }

    // Order by scheduled_at ascending
    query = query.order('scheduled_at', { ascending: true });

    // Apply pagination
    query = query.range(offset, offset + limit - 1);

    const { data: rounds, error: roundsError, count } = await query;

    if (roundsError) {
      console.error('Error fetching rounds:', roundsError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch rounds', code: 'fetch_failed' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get participant counts for each round
    const roundIds = (rounds || []).map(r => r.id);
    
    let participantCounts: Record<string, number> = {};
    let userParticipation: Record<string, boolean> = {};
    let userInvitations: Record<string, { status: string }> = {};

    if (roundIds.length > 0) {
      // Get participant counts
      const { data: participants } = await supabase
        .from('round_participants_v2')
        .select('round_id, user_id')
        .in('round_id', roundIds);

      if (participants) {
        participantCounts = participants.reduce((acc, p) => {
          acc[p.round_id] = (acc[p.round_id] || 0) + 1;
          if (p.user_id === user.id) {
            userParticipation[p.round_id] = true;
          }
          return acc;
        }, {} as Record<string, number>);
      }

      // Get user's invitations for these rounds
      const { data: invitations } = await supabase
        .from('round_invitations')
        .select('round_id, status')
        .eq('invitee_id', user.id)
        .in('round_id', roundIds);

      if (invitations) {
        invitations.forEach(inv => {
          userInvitations[inv.round_id] = { status: inv.status };
        });
      }
    }

    // Transform response
    const roundResponses: RoundResponse[] = (rounds || []).map(round => {
      const creator = round.creator as any;
      const course = round.course as any;
      const isCreator = round.creator_id === user.id;
      const isParticipant = userParticipation[round.id] || false;
      const invitation = userInvitations[round.id];

      let myRole: RoundResponse['myRole'] = null;
      if (isCreator) {
        myRole = 'creator';
      } else if (isParticipant) {
        myRole = 'participant';
      } else if (invitation) {
        myRole = 'invited';
      }

      return {
        id: round.id,
        creatorId: round.creator_id,
        creatorName: creator?.display_name || 'Unknown',
        creatorAvatarUrl: creator?.avatar_url,
        courseId: round.course_id,
        courseName: course?.name || 'Unknown Course',
        courseCity: course?.city,
        courseState: course?.state,
        scheduledAt: round.scheduled_at,
        maxPlayers: round.max_players,
        cartPreference: round.cart_preference,
        confirmedParticipants: participantCounts[round.id] || 0,
        status: round.status,
        notes: round.notes,
        myRole,
        myInvitationStatus: invitation?.status,
        createdAt: round.created_at
      };
    });

    const response: RoundListResponse = {
      data: roundResponses,
      pagination: {
        total: count || 0,
        limit,
        offset
      }
    };

    return new Response(
      JSON.stringify(response),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Rounds list error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Internal server error', code: 'internal_error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

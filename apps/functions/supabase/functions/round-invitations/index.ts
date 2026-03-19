// Round Invitations Edge Function
// List incoming and sent round invitations
// Routes: GET /round-invitations

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import { corsHeaders } from '../_shared/cors.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface InvitationsResponse {
  incoming: RoundInvitationWithRound[];
  sent: RoundInvitationWithRound[];
}

interface RoundInvitationWithRound {
  id: string;
  roundId: string;
  status: string;
  invitedAt: string;
  respondedAt?: string;
  message?: string;
  round: RoundWithCourse;
  invitee?: MemberInfo;
}

interface RoundWithCourse {
  id: string;
  course: {
    name: string;
    city: string;
    state: string;
  };
  scheduledAt: string;
  maxPlayers: number;
  confirmedParticipants: number;
  status: string;
}

interface MemberInfo {
  id: string;
  displayName: string;
  avatarUrl?: string;
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

    // Get incoming invitations (where user is the invitee)
    const { data: incomingInvites, error: incomingError } = await supabase
      .from('round_invitations')
      .select(`
        id,
        round_id,
        status,
        invited_at,
        responded_at,
        message,
        round:round_id (
          id,
          scheduled_at,
          max_players,
          status,
          course:course_id (name, city, state)
        )
      `)
      .eq('invitee_id', user.id)
      .order('invited_at', { ascending: false });

    if (incomingError) {
      console.error('Error fetching incoming invites:', incomingError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch incoming invitations', code: 'fetch_failed' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get sent invitations (invitations for rounds created by user)
    const { data: rounds, error: roundsError } = await supabase
      .from('rounds')
      .select('id')
      .eq('creator_id', user.id);

    if (roundsError) {
      console.error('Error fetching user rounds:', roundsError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch sent invitations', code: 'fetch_failed' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const roundIds = rounds?.map(r => r.id) || [];
    let sentInvites: any[] = [];

    if (roundIds.length > 0) {
      const { data: sent, error: sentError } = await supabase
        .from('round_invitations')
        .select(`
          id,
          round_id,
          status,
          invited_at,
          responded_at,
          message,
          invitee:invitee_id (
            id,
            display_name,
            avatar_url
          ),
          round:round_id (
            id,
            scheduled_at,
            max_players,
            status,
            course:course_id (name, city, state)
          )
        `)
        .in('round_id', roundIds)
        .order('invited_at', { ascending: false });

      if (sentError) {
        console.error('Error fetching sent invites:', sentError);
      } else {
        sentInvites = sent || [];
      }
    }

    // Transform incoming invitations
    const transformedIncoming: RoundInvitationWithRound[] = (incomingInvites || [])
      .filter(invite => invite.round)
      .map(invite => {
        const roundData = invite.round as any;
        return {
          id: invite.id,
          roundId: invite.round_id,
          status: invite.status,
          invitedAt: invite.invited_at,
          respondedAt: invite.responded_at,
          message: invite.message,
          round: {
            id: roundData.id,
            course: {
              name: roundData.course?.name || 'Unknown Course',
              city: roundData.course?.city || '',
              state: roundData.course?.state || ''
            },
            scheduledAt: roundData.scheduled_at,
            maxPlayers: roundData.max_players,
            confirmedParticipants: 0, // Will be populated via RPC
            status: roundData.status
          }
        };
      });

    // Transform sent invitations
    const transformedSent: RoundInvitationWithRound[] = (sentInvites || [])
      .filter(invite => invite.round)
      .map(invite => {
        const roundData = invite.round as any;
        const inviteeData = invite.invitee as any;
        return {
          id: invite.id,
          roundId: invite.round_id,
          status: invite.status,
          invitedAt: invite.invited_at,
          respondedAt: invite.responded_at,
          message: invite.message,
          round: {
            id: roundData.id,
            course: {
              name: roundData.course?.name || 'Unknown Course',
              city: roundData.course?.city || '',
              state: roundData.course?.state || ''
            },
            scheduledAt: roundData.scheduled_at,
            maxPlayers: roundData.max_players,
            confirmedParticipants: 0,
            status: roundData.status
          },
          invitee: inviteeData ? {
            id: inviteeData.id,
            displayName: inviteeData.display_name,
            avatarUrl: inviteeData.avatar_url
          } : undefined
        };
      });

    // Get participant counts for each round
    const allRoundIds = new Set([
      ...transformedIncoming.map(i => i.roundId),
      ...transformedSent.map(i => i.roundId)
    ]);

    for (const roundId of allRoundIds) {
      const { count } = await supabase
        .from('round_participants_v2')
        .select('*', { count: 'exact', head: true })
        .eq('round_id', roundId);

      // Update participant counts
      transformedIncoming
        .filter(i => i.roundId === roundId)
        .forEach(i => i.round.confirmedParticipants = count || 0);
      transformedSent
        .filter(i => i.roundId === roundId)
        .forEach(i => i.round.confirmedParticipants = count || 0);
    }

    const response: InvitationsResponse = {
      incoming: transformedIncoming,
      sent: transformedSent
    };

    return new Response(
      JSON.stringify(response),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Round invitations error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Internal server error', code: 'internal_error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

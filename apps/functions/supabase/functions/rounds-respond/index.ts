// Phase 2: Golf Rounds Respond Edge Function
// Handles accepting or declining round invitations

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import { corsHeaders } from '../_shared/cors.ts';
import { sendTransactionalEmail } from '../_shared/notifications.ts';

// Initialize Supabase client
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface RespondRequest {
  invitationId: string;
  action: 'accept' | 'decline';
}

interface RespondResponse {
  invitation: {
    id: string;
    roundId: string;
    status: string;
    respondedAt: string;
  };
  round: {
    id: string;
    courseName: string;
    scheduledAt: string;
    confirmedParticipants: number;
    maxPlayers: number;
  };
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

    // Parse request body
    let body: RespondRequest;
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: 'Invalid JSON body', code: 'invalid_json' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate required fields
    if (!body.invitationId) {
      return new Response(
        JSON.stringify({ error: 'invitation_id is required', code: 'missing_invitation_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!body.action || !['accept', 'decline'].includes(body.action)) {
      return new Response(
        JSON.stringify({ error: 'action must be "accept" or "decline"', code: 'invalid_action' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get invitation details with round info
    const { data: invitation, error: inviteError } = await supabase
      .from('round_invitations')
      .select(`
        id,
        round_id,
        invitee_id,
        status,
        invited_at,
        round:round_id (
          id,
          creator_id,
          course_id,
          course:course_id (name),
          scheduled_at,
          max_players,
          status
        )
      `)
      .eq('id', body.invitationId)
      .single();

    if (inviteError || !invitation) {
      return new Response(
        JSON.stringify({ error: 'Invitation not found', code: 'invitation_not_found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check invitee is current user
    if (invitation.invitee_id !== user.id) {
      return new Response(
        JSON.stringify({ error: 'You can only respond to your own invitations', code: 'not_invitee' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check invitation is still pending
    if (invitation.status !== 'pending') {
      return new Response(
        JSON.stringify({ error: `Invitation is already ${invitation.status}`, code: 'invitation_not_pending' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const round = invitation.round as any;

    // Check round is still open
    if (!['open', 'full'].includes(round.status)) {
      return new Response(
        JSON.stringify({ error: `Round is ${round.status}`, code: 'round_not_open' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const respondedAt = new Date().toISOString();
    const newStatus = body.action === 'accept' ? 'accepted' : 'declined';

    // If accepting, check round isn't full
    if (body.action === 'accept') {
      const { count: participantCount } = await supabase
        .from('round_participants_v2')
        .select('*', { count: 'exact', head: true })
        .eq('round_id', round.id);

      if (participantCount !== null && participantCount >= round.max_players) {
        return new Response(
          JSON.stringify({ error: 'Round is now full', code: 'round_full' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Update invitation status
    const { data: updatedInvite, error: updateError } = await supabase
      .from('round_invitations')
      .update({
        status: newStatus,
        responded_at: respondedAt
      })
      .eq('id', body.invitationId)
      .select('id, round_id, status, responded_at')
      .single();

    if (updateError || !updatedInvite) {
      console.error('Error updating invitation:', updateError);
      return new Response(
        JSON.stringify({ error: 'Failed to update invitation', code: 'update_failed' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // If accepted, participant is added automatically via trigger
    // If declined, send notification to creator
    if (body.action === 'decline') {
      try {
        const { data: creator } = await supabase
          .from('users')
          .select('email, display_name')
          .eq('id', round.creator_id)
          .single();

        const { data: invitee } = await supabase
          .from('users')
          .select('display_name')
          .eq('id', user.id)
          .single();

        if (creator?.email) {
          await sendTransactionalEmail({
            userId: round.creator_id,
            to: creator.email,
            subject: 'Invitation declined',
            html: `<p>Hello ${creator.display_name || 'there'},</p>
                   <p><strong>${invitee?.display_name || 'Someone'}</strong> has declined your invitation to the round at <strong>${round.course?.name}</strong> on ${new Date(round.scheduled_at).toLocaleDateString()}.</p>`,
            eventType: 'round_invite_declined',
            payload: { invitationId: body.invitationId, roundId: round.id }
          });
        }
      } catch (notifyError) {
        console.error('Error sending notification:', notifyError);
      }
    } else {
      // Accepted - notify creator
      try {
        const { data: creator } = await supabase
          .from('users')
          .select('email, display_name')
          .eq('id', round.creator_id)
          .single();

        const { data: invitee } = await supabase
          .from('users')
          .select('display_name')
          .eq('id', user.id)
          .single();

        if (creator?.email) {
          await sendTransactionalEmail({
            userId: round.creator_id,
            to: creator.email,
            subject: 'Invitation accepted',
            html: `<p>Hello ${creator.display_name || 'there'},</p>
                   <p><strong>${invitee?.display_name || 'Someone'}</strong> has accepted your invitation to the round at <strong>${round.course?.name}</strong> on ${new Date(round.scheduled_at).toLocaleDateString()}.</p>`,
            eventType: 'round_invite_accepted',
            payload: { invitationId: body.invitationId, roundId: round.id }
          });
        }
      } catch (notifyError) {
        console.error('Error sending notification:', notifyError);
      }
    }

    // Get updated participant count
    const { count: confirmedParticipants } = await supabase
      .from('round_participants_v2')
      .select('*', { count: 'exact', head: true })
      .eq('round_id', round.id);

    const response: RespondResponse = {
      invitation: {
        id: updatedInvite.id,
        roundId: updatedInvite.round_id,
        status: updatedInvite.status,
        respondedAt: updatedInvite.responded_at
      },
      round: {
        id: round.id,
        courseName: round.course?.name || 'Unknown Course',
        scheduledAt: round.scheduled_at,
        confirmedParticipants: confirmedParticipants || 1,
        maxPlayers: round.max_players
      }
    };

    return new Response(
      JSON.stringify({ data: response }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Rounds respond error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Internal server error', code: 'internal_error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// Golf Rounds Invite Edge Function
// Handles inviting members to private rounds and responding to invites

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import { corsHeaders } from '../_shared/cors.ts';
import { TIER_SLUGS, getTierFeatures, TierSlug } from '../_shared/tier-gate.ts';
import { sendTransactionalEmail } from '../_shared/notifications.ts';

// Initialize Supabase client
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface InviteRequest {
  roundId: string;
  userId: string;
  message?: string;
}

interface RespondInviteRequest {
  inviteId: string;
  action: 'accept' | 'decline';
}

interface InviteResponse {
  id: string;
  roundId: string;
  inviterId: string;
  inviteeId: string;
  status: 'pending' | 'accepted' | 'declined';
  message: string | null;
  createdAt: string;
  respondedAt: string | null;
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
    let body: any;
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: 'Invalid JSON body', code: 'invalid_json' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Determine action from path
    const url = new URL(req.url);
    const path = url.pathname;
    const isRespond = path.includes('respond') || body.action === 'accept' || body.action === 'decline';

    if (isRespond) {
      return handleRespondInvite(supabase, user.id, body);
    } else {
      return handleSendInvite(supabase, user.id, body);
    }

  } catch (error) {
    console.error('Rounds invite error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Internal server error', code: 'internal_error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function handleSendInvite(supabase: any, currentUserId: string, body: InviteRequest) {
  const { roundId, userId, message } = body;

  // Validate required fields
  if (!roundId) {
    return new Response(
      JSON.stringify({ error: 'round_id is required', code: 'missing_round_id' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  if (!userId) {
    return new Response(
      JSON.stringify({ error: 'user_id is required', code: 'missing_user_id' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  if (userId === currentUserId) {
    return new Response(
      JSON.stringify({ error: 'Cannot invite yourself', code: 'cannot_invite_self' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Get round details
  const { data: round, error: roundError } = await supabase
    .from('golf_rounds')
    .select(`
      id,
      course_id,
      course:course_id (name),
      organizer_id,
      round_date,
      tee_time,
      total_spots,
      spots_available,
      visibility,
      status
    `)
    .eq('id', roundId)
    .single();

  if (roundError || !round) {
    return new Response(
      JSON.stringify({ error: 'Round not found', code: 'round_not_found' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Check if user is the organizer
  if (round.organizer_id !== currentUserId) {
    return new Response(
      JSON.stringify({ error: 'Only the organizer can invite members', code: 'not_organizer' }),
      { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Check round status
  if (round.status !== 'open') {
    return new Response(
      JSON.stringify({ error: `Round is ${round.status}`, code: 'round_not_open' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Check spots available
  if (round.spots_available <= 0) {
    return new Response(
      JSON.stringify({ error: 'No spots available', code: 'no_spots_available' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Check if invitee exists
  const { data: invitee, error: inviteeError } = await supabase
    .from('users')
    .select('id, email, display_name, tier_id, membership_tiers(slug)')
    .eq('id', userId)
    .single();

  if (inviteeError || !invitee) {
    return new Response(
      JSON.stringify({ error: 'Invitee not found', code: 'invitee_not_found' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Check if already invited
  const { data: existingInvite, error: existingError } = await supabase
    .from('golf_round_invites')
    .select('id, status')
    .eq('round_id', roundId)
    .eq('invitee_id', userId)
    .maybeSingle();

  if (existingInvite) {
    if (existingInvite.status === 'pending') {
      return new Response(
        JSON.stringify({ error: 'User already invited', code: 'already_invited' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else if (existingInvite.status === 'accepted') {
      return new Response(
        JSON.stringify({ error: 'User already a participant', code: 'already_participant' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  }

  // Check if already a participant
  const { data: existingParticipant } = await supabase
    .from('golf_round_participants')
    .select('id')
    .eq('round_id', roundId)
    .eq('user_id', userId)
    .maybeSingle();

  if (existingParticipant) {
    return new Response(
      JSON.stringify({ error: 'User already a participant', code: 'already_participant' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Create invite
  const { data: invite, error: inviteError } = await supabase
    .from('golf_round_invites')
    .insert({
      round_id: roundId,
      inviter_id: currentUserId,
      invitee_id: userId,
      status: 'pending',
      message: message || null,
      created_at: new Date().toISOString()
    })
    .select('id, round_id, inviter_id, invitee_id, status, message, created_at, responded_at')
    .single();

  if (inviteError || !invite) {
    console.error('Error creating invite:', inviteError);
    return new Response(
      JSON.stringify({ error: 'Failed to create invite', code: 'invite_failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Send notification to invitee
  try {
    const { data: inviter } = await supabase
      .from('users')
      .select('display_name')
      .eq('id', currentUserId)
      .single();

    if (invitee.email) {
      await sendTransactionalEmail({
        userId: invitee.id,
        to: invitee.email,
        subject: 'You have been invited to a round of golf',
        html: `<p>Hello ${invitee.display_name || 'there'},</p>
               <p><strong>${inviter?.display_name || 'Someone'}</strong> has invited you to a round at <strong>${(round.course as any)?.name}</strong> on ${round.round_date} at ${round.tee_time}.</p>
               ${message ? `<p>Message: "${message}"</p>` : ''}
               <p>Log in to accept or decline this invitation.</p>`,
        eventType: 'round_invite_received',
        payload: { inviteId: invite.id, roundId }
      });
    }
  } catch (notifyError) {
    console.error('Error sending notification:', notifyError);
  }

  const response: InviteResponse = {
    id: invite.id,
    roundId: invite.round_id,
    inviterId: invite.inviter_id,
    inviteeId: invite.invitee_id,
    status: invite.status,
    message: invite.message,
    createdAt: invite.created_at,
    respondedAt: invite.responded_at
  };

  return new Response(
    JSON.stringify({ data: response }),
    { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function handleRespondInvite(supabase: any, currentUserId: string, body: RespondInviteRequest) {
  const { inviteId, action } = body;

  // Validate required fields
  if (!inviteId) {
    return new Response(
      JSON.stringify({ error: 'invite_id is required', code: 'missing_invite_id' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  if (!action || !['accept', 'decline'].includes(action)) {
    return new Response(
      JSON.stringify({ error: 'action must be "accept" or "decline"', code: 'invalid_action' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Get invite details
  const { data: invite, error: inviteError } = await supabase
    .from('golf_round_invites')
    .select(`
      id,
      round_id,
      inviter_id,
      invitee_id,
      status,
      message,
      created_at,
      responded_at,
      round:round_id (
        id,
        course:course_id (name),
        organizer_id,
        round_date,
        tee_time,
        total_spots,
        spots_available,
        status
      )
    `)
    .eq('id', inviteId)
    .single();

  if (inviteError || !invite) {
    return new Response(
      JSON.stringify({ error: 'Invite not found', code: 'invite_not_found' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Check invitee is current user
  if (invite.invitee_id !== currentUserId) {
    return new Response(
      JSON.stringify({ error: 'You can only respond to your own invites', code: 'not_invitee' }),
      { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Check invite is still pending
  if (invite.status !== 'pending') {
    return new Response(
      JSON.stringify({ error: `Invite is already ${invite.status}`, code: 'invite_not_pending' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const round = invite.round as any;

  // Check round is still open
  if (round.status !== 'open') {
    return new Response(
      JSON.stringify({ error: `Round is ${round.status}`, code: 'round_not_open' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Update invite status
  const newStatus = action === 'accept' ? 'accepted' : 'declined';
  const { data: updatedInvite, error: updateError } = await supabase
    .from('golf_round_invites')
    .update({
      status: newStatus,
      responded_at: new Date().toISOString()
    })
    .eq('id', inviteId)
    .select('id, round_id, inviter_id, invitee_id, status, message, created_at, responded_at')
    .single();

  if (updateError || !updatedInvite) {
    console.error('Error updating invite:', updateError);
    return new Response(
      JSON.stringify({ error: 'Failed to update invite', code: 'update_failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // If accepted, add as participant
  if (action === 'accept') {
    // Check spots still available
    const { data: currentRound } = await supabase
      .from('golf_rounds')
      .select('spots_available')
      .eq('id', round.id)
      .single();

    if (!currentRound || currentRound.spots_available <= 0) {
      // Revert invite status
      await supabase
        .from('golf_round_invites')
        .update({ status: 'pending', responded_at: null })
        .eq('id', inviteId);

      return new Response(
        JSON.stringify({ error: 'No spots available', code: 'no_spots_available' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Add as participant
    const { error: participantError } = await supabase
      .from('golf_round_participants')
      .insert({
        round_id: round.id,
        user_id: currentUserId,
        status: 'confirmed',
        joined_at: new Date().toISOString()
      });

    if (participantError) {
      console.error('Error adding participant:', participantError);
      return new Response(
        JSON.stringify({ error: 'Failed to join round', code: 'join_failed' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update spots available
    await supabase
      .from('golf_rounds')
      .update({ spots_available: round.spots_available - 1 })
      .eq('id', round.id);

    // Notify organizer
    try {
      const { data: organizer } = await supabase
        .from('users')
        .select('email, display_name')
        .eq('id', round.organizer_id)
        .single();

      const { data: invitee } = await supabase
        .from('users')
        .select('display_name')
        .eq('id', currentUserId)
        .single();

      if (organizer?.email) {
        await sendTransactionalEmail({
          userId: round.organizer_id,
          to: organizer.email,
          subject: 'Invitation accepted',
          html: `<p>Hello ${organizer.display_name || 'there'},</p>
                 <p><strong>${invitee?.display_name || 'Someone'}</strong> has accepted your invitation to the round at <strong>${round.course?.name}</strong> on ${round.round_date}.</p>`,
          eventType: 'round_invite_accepted',
          payload: { inviteId, roundId: round.id }
        });
      }
    } catch (notifyError) {
      console.error('Error sending notification:', notifyError);
    }
  }

  const response: InviteResponse = {
    id: updatedInvite.id,
    roundId: updatedInvite.round_id,
    inviterId: updatedInvite.inviter_id,
    inviteeId: updatedInvite.invitee_id,
    status: updatedInvite.status,
    message: updatedInvite.message,
    createdAt: updatedInvite.created_at,
    respondedAt: updatedInvite.responded_at
  };

  return new Response(
    JSON.stringify({ data: response }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

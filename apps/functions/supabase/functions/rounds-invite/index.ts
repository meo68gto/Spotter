// Phase 2: Golf Rounds Invite Edge Function
// Handles inviting users to join rounds with same-tier enforcement

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import { corsHeaders } from '../_shared/cors.ts';
import { sendTransactionalEmail } from '../_shared/notifications.ts';

// Initialize Supabase client
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface InviteRequest {
  roundId: string;
  userId: string;
  message?: string;
}

interface InviteResponse {
  id: string;
  roundId: string;
  inviteeId: string;
  status: string;
  message: string | null;
  invitedAt: string;
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
    let body: InviteRequest;
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: 'Invalid JSON body', code: 'invalid_json' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate required fields
    if (!body.roundId) {
      return new Response(
        JSON.stringify({ error: 'round_id is required', code: 'missing_round_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!body.userId) {
      return new Response(
        JSON.stringify({ error: 'user_id is required', code: 'missing_user_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Prevent self-invite
    if (body.userId === user.id) {
      return new Response(
        JSON.stringify({ error: 'Cannot invite yourself', code: 'cannot_invite_self' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get round details with creator's tier
    const { data: round, error: roundError } = await supabase
      .from('rounds')
      .select(`
        id,
        creator_id,
        course_id,
        tier_id,
        max_players,
        status,
        scheduled_at,
        course:course_id (name)
      `)
      .eq('id', body.roundId)
      .single();

    if (roundError || !round) {
      return new Response(
        JSON.stringify({ error: 'Round not found', code: 'round_not_found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user is the creator
    if (round.creator_id !== user.id) {
      return new Response(
        JSON.stringify({ error: 'Only the creator can invite members', code: 'not_creator' }),
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

    // Get current participant count
    const { count: participantCount, error: countError } = await supabase
      .from('round_participants_v2')
      .select('*', { count: 'exact', head: true })
      .eq('round_id', body.roundId);

    if (participantCount !== null && participantCount >= round.max_players) {
      return new Response(
        JSON.stringify({ error: 'Round is full', code: 'round_full' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get invitee details with tier
    const { data: invitee, error: inviteeError } = await supabase
      .from('users')
      .select(`
        id,
        email,
        display_name,
        tier_id,
        membership_tiers (slug)
      `)
      .eq('id', body.userId)
      .single();

    if (inviteeError || !invitee) {
      return new Response(
        JSON.stringify({ error: 'Invitee not found', code: 'invitee_not_found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Same-tier enforcement: invitee must be in same tier as round
    if (invitee.tier_id !== round.tier_id) {
      return new Response(
        JSON.stringify({ 
          error: 'Can only invite users in the same tier', 
          code: 'tier_mismatch',
          roundTierId: round.tier_id,
          inviteeTierId: invitee.tier_id
        }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if already invited
    const { data: existingInvite, error: existingError } = await supabase
      .from('round_invitations')
      .select('id, status')
      .eq('round_id', body.roundId)
      .eq('invitee_id', body.userId)
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
      .from('round_participants_v2')
      .select('id')
      .eq('round_id', body.roundId)
      .eq('user_id', body.userId)
      .maybeSingle();

    if (existingParticipant) {
      return new Response(
        JSON.stringify({ error: 'User already a participant', code: 'already_participant' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create invitation
    const { data: invite, error: inviteError } = await supabase
      .from('round_invitations')
      .insert({
        round_id: body.roundId,
        invitee_id: body.userId,
        status: 'pending',
        message: body.message?.substring(0, 280) ?? null,
        invited_at: new Date().toISOString()
      })
      .select('id, round_id, invitee_id, status, message, invited_at')
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
      const { data: creator } = await supabase
        .from('users')
        .select('display_name')
        .eq('id', user.id)
        .single();

      if (invitee.email) {
        await sendTransactionalEmail({
          userId: invitee.id,
          to: invitee.email,
          subject: 'You have been invited to a round of golf',
          html: `<p>Hello ${invitee.display_name || 'there'},</p>
                 <p><strong>${creator?.display_name || 'Someone'}</strong> has invited you to a round at <strong>${(round.course as any)?.name}</strong> on ${new Date(round.scheduled_at).toLocaleDateString()}.</p>
                 ${body.message ? `<p>Message: "${body.message}"</p>` : ''}
                 <p>Log in to accept or decline this invitation.</p>`,
          eventType: 'round_invite_received',
          payload: { inviteId: invite.id, roundId: body.roundId }
        });
      }
    } catch (notifyError) {
      console.error('Error sending notification:', notifyError);
    }

    const response: InviteResponse = {
      id: invite.id,
      roundId: invite.round_id,
      inviteeId: invite.invitee_id,
      status: invite.status,
      message: invite.message,
      invitedAt: invite.invited_at
    };

    return new Response(
      JSON.stringify({ data: response }),
      { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Rounds invite error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Internal server error', code: 'internal_error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

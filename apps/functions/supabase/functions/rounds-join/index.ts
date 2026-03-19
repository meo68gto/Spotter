// Golf Rounds Join Edge Function
// Handles joining and leaving golf rounds

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import { corsHeaders } from '../_shared/cors.ts';
import { TIER_SLUGS, getTierFeatures, TierSlug } from '../_shared/tier-gate.ts';
import { sendTransactionalEmail } from '../_shared/notifications.ts';

// Initialize Supabase client
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface JoinRoundRequest {
  roundId: string;
}

interface LeaveRoundRequest {
  roundId: string;
}

interface RoundResponse {
  id: string;
  courseId: string;
  courseName: string;
  organizerId: string;
  roundDate: string;
  teeTime: string;
  format: string;
  totalSpots: number;
  spotsAvailable: number;
  status: string;
  participantStatus: string;
  joinedAt: string;
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

    // Get current user with full profile
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized', code: 'invalid_token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get user with tier and handicap info
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select(`
        id,
        email,
        display_name,
        tier_id,
        tier_status,
        membership_tiers (
          id,
          slug
        ),
        handicaps:user_handicaps (
          index,
          last_updated
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
    const userTier = tier?.slug || TIER_SLUGS.FREE;
    const tierFeatures = getTierFeatures(userTier);

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

    // Determine action from path or action field
    const url = new URL(req.url);
    const path = url.pathname;
    const action = path.includes('leave') ? 'leave' : body.action || 'join';

    const roundId = body.roundId;
    if (!roundId) {
      return new Response(
        JSON.stringify({ error: 'round_id is required', code: 'missing_round_id' }),
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
        organizer:organizer_id (email, display_name, tier_id),
        round_date,
        tee_time,
        format,
        total_spots,
        spots_available,
        visibility,
        handicap_min,
        handicap_max,
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

    // Handle leave action
    if (action === 'leave') {
      // Cannot leave if round is in progress
      if (round.status === 'in_progress') {
        return new Response(
          JSON.stringify({ error: 'Cannot leave a round that is in progress', code: 'round_in_progress' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Cannot leave if round is completed
      if (round.status === 'completed') {
        return new Response(
          JSON.stringify({ error: 'Cannot leave a round that is completed', code: 'round_completed' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Check if user is a participant
      const { data: participant, error: participantCheckError } = await supabase
        .from('golf_round_participants')
        .select('id, status')
        .eq('round_id', roundId)
        .eq('user_id', user.id)
        .single();

      if (!participant) {
        return new Response(
          JSON.stringify({ error: 'You are not a participant in this round', code: 'not_participant' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Organizer cannot leave (must cancel the round instead)
      if (round.organizer_id === user.id) {
        return new Response(
          JSON.stringify({ error: 'Organizer cannot leave. Cancel the round instead.', code: 'organizer_cannot_leave' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Remove participant
      const { error: deleteError } = await supabase
        .from('golf_round_participants')
        .delete()
        .eq('round_id', roundId)
        .eq('user_id', user.id);

      if (deleteError) {
        console.error('Error leaving round:', deleteError);
        return new Response(
          JSON.stringify({ error: 'Failed to leave round', code: 'leave_failed' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Update spots available
      const { error: updateError } = await supabase
        .from('golf_rounds')
        .update({ spots_available: round.spots_available + 1 })
        .eq('id', roundId);

      if (updateError) {
        console.error('Error updating spots:', updateError);
      }

      return new Response(
        JSON.stringify({ 
          data: { 
            success: true, 
            message: 'Successfully left the round',
            roundId 
          } 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Handle join action
    // Check tier compatibility - users can only join rounds within their tier visibility
    const organizerTier = (round.organizer as any)?.tier_id;
    if (userTier !== TIER_SLUGS.SUMMIT && organizerTier !== userData.tier_id) {
      // Check if same tier visibility applies
      if (round.visibility === 'tier_only') {
        return new Response(
          JSON.stringify({ error: 'This round is restricted to same-tier members', code: 'tier_restricted' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Check if spots available
    if (round.spots_available <= 0) {
      return new Response(
        JSON.stringify({ error: 'No spots available', code: 'no_spots_available' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check round status
    if (round.status !== 'open') {
      return new Response(
        JSON.stringify({ error: `Round is ${round.status}`, code: 'round_not_open' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if already a participant
    const { data: existingParticipant, error: existingCheckError } = await supabase
      .from('golf_round_participants')
      .select('id')
      .eq('round_id', roundId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (existingParticipant) {
      return new Response(
        JSON.stringify({ error: 'Already a participant in this round', code: 'already_participant' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check handicap filters if set
    const userHandicap = (userData.handicaps as any)?.[0]?.index ?? null;
    if (round.handicap_min !== null && userHandicap !== null && userHandicap < round.handicap_min) {
      return new Response(
        JSON.stringify({ 
          error: `Handicap must be at least ${round.handicap_min}`, 
          code: 'handicap_too_low',
          yourHandicap: userHandicap,
          requiredMin: round.handicap_min
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    if (round.handicap_max !== null && userHandicap !== null && userHandicap > round.handicap_max) {
      return new Response(
        JSON.stringify({ 
          error: `Handicap must be at most ${round.handicap_max}`, 
          code: 'handicap_too_high',
          yourHandicap: userHandicap,
          requiredMax: round.handicap_max
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Cannot join invite-only rounds directly
    if (round.visibility === 'invite_only') {
      return new Response(
        JSON.stringify({ error: 'This round requires an invitation', code: 'invite_required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Add as confirmed participant
    const { data: participant, error: participantError } = await supabase
      .from('golf_round_participants')
      .insert({
        round_id: roundId,
        user_id: user.id,
        status: 'confirmed',
        joined_at: new Date().toISOString()
      })
      .select('id, status, joined_at')
      .single();

    if (participantError) {
      console.error('Error joining round:', participantError);
      return new Response(
        JSON.stringify({ error: 'Failed to join round', code: 'join_failed' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update spots available
    const { error: updateError } = await supabase
      .from('golf_rounds')
      .update({ spots_available: round.spots_available - 1 })
      .eq('id', roundId);

    if (updateError) {
      console.error('Error updating spots:', updateError);
    }

    // Send notification to organizer
    try {
      const organizer = round.organizer as any;
      if (organizer?.email) {
        await sendTransactionalEmail({
          userId: round.organizer_id,
          to: organizer.email,
          subject: 'New participant joined your round',
          html: `<p>Hello ${organizer.display_name || 'there'},</p>
                 <p><strong>${userData.display_name || 'Someone'}</strong> has joined your round at <strong>${(round.course as any)?.name}</strong> on ${round.round_date} at ${round.tee_time}.</p>
                 <p>You now have ${round.spots_available - 1} spot(s) remaining.</p>`,
          eventType: 'round_participant_joined',
          payload: { roundId, participantId: user.id }
        });
      }
    } catch (notifyError) {
      console.error('Error sending notification:', notifyError);
    }

    const response: RoundResponse = {
      id: round.id,
      courseId: round.course_id,
      courseName: (round.course as any)?.name || 'Unknown Course',
      organizerId: round.organizer_id,
      roundDate: round.round_date,
      teeTime: round.tee_time,
      format: round.format,
      totalSpots: round.total_spots,
      spotsAvailable: round.spots_available - 1,
      status: round.status,
      participantStatus: participant.status,
      joinedAt: participant.joined_at
    };

    return new Response(
      JSON.stringify({ data: response }),
      { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Rounds join error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Internal server error', code: 'internal_error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

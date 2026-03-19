// Epic 5: Standing Foursomes Schedule Edge Function
// Generates a new round from a standing foursome

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import { corsHeaders } from '../_shared/cors.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface ScheduleRoundRequest {
  foursomeId: string;
  scheduledAt: string; // ISO 8601 datetime
  courseId?: string;
  notes?: string;
}

interface ScheduleRoundResponse {
  roundId: string;
  foursomeId: string;
  status: string;
  scheduledAt: string;
  invitedCount: number;
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

    const body: ScheduleRoundRequest = await req.json();

    // Validation
    if (!body.foursomeId) {
      return new Response(
        JSON.stringify({ error: 'foursomeId is required', code: 'missing_foursome_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!body.scheduledAt) {
      return new Response(
        JSON.stringify({ error: 'scheduledAt is required', code: 'missing_scheduled_at' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const scheduledAt = new Date(body.scheduledAt);
    if (isNaN(scheduledAt.getTime()) || scheduledAt <= new Date()) {
      return new Response(
        JSON.stringify({ error: 'scheduledAt must be a valid future datetime', code: 'invalid_scheduled_at' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get foursome details
    const { data: foursome, error: foursomeError } = await supabase
      .from('standing_foursomes')
      .select('id, name, organizer_id, preferred_course_id, tier_id, status')
      .eq('id', body.foursomeId)
      .single();

    if (foursomeError || !foursome) {
      return new Response(
        JSON.stringify({ error: 'Standing foursome not found', code: 'foursome_not_found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user is organizer
    if (foursome.organizer_id !== user.id) {
      return new Response(
        JSON.stringify({ error: 'Only the organizer can schedule rounds', code: 'not_organizer' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check foursome is active
    if (foursome.status !== 'active') {
      return new Response(
        JSON.stringify({ error: `Foursome is ${foursome.status}`, code: 'foursome_inactive' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get members
    const { data: members, error: membersError } = await supabase
      .from('standing_foursome_members')
      .select('user_id')
      .eq('foursome_id', foursome.id);

    if (membersError || !members || members.length < 2) {
      return new Response(
        JSON.stringify({ error: 'Foursome must have at least 2 members', code: 'insufficient_members' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Determine course
    const courseId = body.courseId || foursome.preferred_course_id;
    if (!courseId) {
      return new Response(
        JSON.stringify({ error: 'Course must be specified (no preferred course set)', code: 'missing_course' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify course exists
    const { data: course, error: courseError } = await supabase
      .from('golf_courses')
      .select('id, is_active')
      .eq('id', courseId)
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

    // Create the round
    const { data: round, error: roundError } = await supabase
      .from('rounds')
      .insert({
        creator_id: user.id,
        course_id: courseId,
        scheduled_at: body.scheduledAt,
        max_players: 4,
        cart_preference: 'either',
        tier_id: foursome.tier_id,
        status: 'open',
        lifecycle_status: 'invited',
        source_type: 'standing_foursome',
        standing_foursome_id: foursome.id,
        notes: body.notes?.substring(0, 500) ?? null
      })
      .select('id, status, lifecycle_status')
      .single();

    if (roundError || !round) {
      console.error('Error creating round:', roundError);
      return new Response(
        JSON.stringify({ error: 'Failed to create round', code: 'create_failed' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Send invitations to all members (including organizer, who will auto-accept via trigger)
    const memberIds = members.map(m => m.user_id);
    const invitations = memberIds.map(userId => ({
      round_id: round.id,
      invitee_id: userId,
      status: 'pending',
      message: `Playing with ${foursome.name}`
    }));

    const { error: inviteError } = await supabase
      .from('round_invitations')
      .insert(invitations);

    if (inviteError) {
      console.error('Error sending invitations:', inviteError);
    }

    // Update next_round_at on foursome
    await supabase
      .from('standing_foursomes')
      .update({ next_round_at: body.scheduledAt })
      .eq('id', foursome.id);

    const response: ScheduleRoundResponse = {
      roundId: round.id,
      foursomeId: foursome.id,
      status: round.lifecycle_status,
      scheduledAt: body.scheduledAt,
      invitedCount: invitations.length
    };

    return new Response(
      JSON.stringify({ data: response }),
      { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Standing foursomes schedule error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Internal server error', code: 'internal_error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

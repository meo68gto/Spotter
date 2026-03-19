// Epic 5: Standing Foursomes Create Edge Function
// Creates a new standing foursome group

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import { corsHeaders } from '../_shared/cors.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface CreateStandingFoursomeRequest {
  name: string;
  description?: string;
  memberIds: string[];
  preferredCourseId?: string;
  cadence?: 'weekly' | 'biweekly' | 'monthly' | 'flexible';
  preferredDay?: 'weekday' | 'weekend' | 'flexible';
  preferredTime?: 'morning' | 'midday' | 'afternoon' | 'flexible';
}

interface StandingFoursomeResponse {
  id: string;
  name: string;
  description?: string;
  organizerId: string;
  members: Array<{
    userId: string;
    displayName: string;
    avatarUrl?: string;
    role: 'organizer' | 'member';
  }>;
  cadence: string;
  preferredDay?: string;
  preferredTime?: string;
  status: string;
  roundsPlayedCount: number;
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

    const body: CreateStandingFoursomeRequest = await req.json();

    // Validation
    if (!body.name || body.name.trim().length < 2) {
      return new Response(
        JSON.stringify({ error: 'Name must be at least 2 characters', code: 'invalid_name' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!body.memberIds || body.memberIds.length < 2 || body.memberIds.length > 3) {
      return new Response(
        JSON.stringify({ error: 'Standing foursome requires 2-3 other members (3-4 total)', code: 'invalid_member_count' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get organizer's tier
    const { data: organizerData, error: organizerError } = await supabase
      .from('users')
      .select('id, tier_id, tier_status, display_name')
      .eq('id', user.id)
      .single();

    if (organizerError || !organizerData) {
      return new Response(
        JSON.stringify({ error: 'User not found', code: 'user_not_found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (organizerData.tier_status !== 'active') {
      return new Response(
        JSON.stringify({ error: 'Membership not active', code: 'tier_not_active' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify all members exist and are same tier
    const { data: members, error: membersError } = await supabase
      .from('users')
      .select('id, tier_id, tier_status, display_name, avatar_url')
      .in('id', body.memberIds);

    if (membersError || !members || members.length !== body.memberIds.length) {
      return new Response(
        JSON.stringify({ error: 'One or more members not found', code: 'members_not_found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check same-tier enforcement
    for (const member of members) {
      if (member.tier_id !== organizerData.tier_id) {
        return new Response(
          JSON.stringify({ 
            error: 'All members must be in the same tier', 
            code: 'tier_mismatch',
            details: { memberId: member.id, memberTier: member.tier_id }
          }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (member.tier_status !== 'active') {
        return new Response(
          JSON.stringify({ 
            error: 'One or more members has inactive membership', 
            code: 'member_tier_not_active',
            details: { memberId: member.id }
          }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Create standing foursome
    const { data: foursome, error: foursomeError } = await supabase
      .from('standing_foursomes')
      .insert({
        name: body.name.trim(),
        description: body.description?.substring(0, 280) ?? null,
        organizer_id: user.id,
        preferred_course_id: body.preferredCourseId ?? null,
        cadence: body.cadence ?? 'flexible',
        preferred_day: body.preferredDay ?? 'flexible',
        preferred_time: body.preferredTime ?? 'flexible',
        tier_id: organizerData.tier_id,
        status: 'active'
      })
      .select('id, name, description, organizer_id, cadence, preferred_day, preferred_time, status, rounds_played_count, created_at')
      .single();

    if (foursomeError || !foursome) {
      console.error('Error creating foursome:', foursomeError);
      return new Response(
        JSON.stringify({ error: 'Failed to create standing foursome', code: 'create_failed' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Add organizer as member
    const { error: organizerMemberError } = await supabase
      .from('standing_foursome_members')
      .insert({
        foursome_id: foursome.id,
        user_id: user.id,
        role: 'organizer'
      });

    if (organizerMemberError) {
      console.error('Error adding organizer:', organizerMemberError);
    }

    // Add other members
    const memberInserts = members.map(member => ({
      foursome_id: foursome.id,
      user_id: member.id,
      role: 'member' as const
    }));

    const { error: membersInsertError } = await supabase
      .from('standing_foursome_members')
      .insert(memberInserts);

    if (membersInsertError) {
      console.error('Error adding members:', membersInsertError);
    }

    // Build response
    const response: StandingFoursomeResponse = {
      id: foursome.id,
      name: foursome.name,
      description: foursome.description ?? undefined,
      organizerId: foursome.organizer_id,
      members: [
        { userId: user.id, displayName: organizerData.display_name, role: 'organizer' },
        ...members.map(m => ({ userId: m.id, displayName: m.display_name, avatarUrl: m.avatar_url ?? undefined, role: 'member' as const }))
      ],
      cadence: foursome.cadence,
      preferredDay: foursome.preferred_day ?? undefined,
      preferredTime: foursome.preferred_time ?? undefined,
      status: foursome.status,
      roundsPlayedCount: foursome.rounds_played_count,
      createdAt: foursome.created_at
    };

    return new Response(
      JSON.stringify({ data: response }),
      { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Standing foursomes create error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Internal server error', code: 'internal_error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

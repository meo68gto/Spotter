// Epic 5: Standing Foursomes List Edge Function
// Lists user's standing foursomes

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import { corsHeaders } from '../_shared/cors.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface StandingFoursomeResponse {
  id: string;
  name: string;
  description?: string;
  organizerId: string;
  organizerName: string;
  organizerAvatarUrl?: string;
  members: Array<{
    userId: string;
    displayName: string;
    avatarUrl?: string;
    role: 'organizer' | 'member';
  }>;
  cadence: string;
  preferredCourse?: {
    id: string;
    name: string;
    city: string;
    state: string;
  };
  preferredDay?: string;
  preferredTime?: string;
  status: string;
  roundsPlayedCount: number;
  lastRoundAt?: string;
  nextRoundAt?: string;
  createdAt: string;
}

interface StandingFoursomesListResponse {
  data: StandingFoursomeResponse[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'GET') {
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

    // Parse query parameters
    const url = new URL(req.url);
    const statusFilter = url.searchParams.get('status');
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '20', 10), 100);
    const offset = parseInt(url.searchParams.get('offset') || '0', 10);

    // Get foursomes where user is a member
    let query = supabase
      .from('standing_foursome_members')
      .select(
        `
        foursome:standing_foursomes!inner(
          id,
          name,
          description,
          organizer_id,
          preferred_course_id,
          cadence,
          preferred_day,
          preferred_time,
          status,
          rounds_played_count,
          last_round_at,
          next_round_at,
          created_at,
          organizer:users!standing_foursomes_organizer_id_fkey(display_name, avatar_url),
          preferred_course:golf_courses!standing_foursomes_preferred_course_id_fkey(id, name, city, state)
        ),
        role
        `,
        { count: 'exact' }
      )
      .eq('user_id', user.id);

    // Apply status filter
    if (statusFilter) {
      query = query.eq('foursome.status', statusFilter);
    }

    // Order by last_round_at (most recent first), then created_at
    query = query.order('foursome.last_round_at', { ascending: false, nullsFirst: false });
    query = query.order('foursome.created_at', { ascending: false });

    // Apply pagination
    query = query.range(offset, offset + limit - 1);

    const { data: memberships, error: membershipsError, count } = await query;

    if (membershipsError) {
      console.error('Error fetching foursomes:', membershipsError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch standing foursomes', code: 'fetch_failed' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!memberships || memberships.length === 0) {
      const emptyResponse: StandingFoursomesListResponse = {
        data: [],
        pagination: { total: 0, limit, offset }
      };
      return new Response(
        JSON.stringify(emptyResponse),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const foursomeIds = memberships.map(m => m.foursome.id);

    // Get all members for these foursomes
    const { data: allMembers } = await supabase
      .from('standing_foursome_members')
      .select(`
        foursome_id,
        user_id,
        role,
        users!inner(display_name, avatar_url)
      `)
      .in('foursome_id', foursomeIds);

    // Group members by foursome
    const membersByFoursome: Record<string, Array<{ userId: string; displayName: string; avatarUrl?: string; role: string }>> = {};
    if (allMembers) {
      for (const member of allMembers) {
        const userData = member.users as any;
        if (!membersByFoursome[member.foursome_id]) {
          membersByFoursome[member.foursome_id] = [];
        }
        membersByFoursome[member.foursome_id].push({
          userId: member.user_id,
          displayName: userData.display_name,
          avatarUrl: userData.avatar_url,
          role: member.role
        });
      }
    }

    // Transform response
    const foursomes: StandingFoursomeResponse[] = memberships.map(membership => {
      const foursome = membership.foursome as any;
      const organizer = foursome.organizer as any;
      const preferredCourse = foursome.preferred_course as any;

      return {
        id: foursome.id,
        name: foursome.name,
        description: foursome.description ?? undefined,
        organizerId: foursome.organizer_id,
        organizerName: organizer?.display_name || 'Unknown',
        organizerAvatarUrl: organizer?.avatar_url,
        members: membersByFoursome[foursome.id] || [],
        cadence: foursome.cadence,
        preferredCourse: preferredCourse ? {
          id: preferredCourse.id,
          name: preferredCourse.name,
          city: preferredCourse.city,
          state: preferredCourse.state
        } : undefined,
        preferredDay: foursome.preferred_day ?? undefined,
        preferredTime: foursome.preferred_time ?? undefined,
        status: foursome.status,
        roundsPlayedCount: foursome.rounds_played_count,
        lastRoundAt: foursome.last_round_at ?? undefined,
        nextRoundAt: foursome.next_round_at ?? undefined,
        createdAt: foursome.created_at
      };
    });

    const response: StandingFoursomesListResponse = {
      data: foursomes,
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
    console.error('Standing foursomes list error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Internal server error', code: 'internal_error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

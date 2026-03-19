// Golf Rounds List Edge Function
// Handles discovering and listing golf rounds with filters
// Endpoints:
// - GET /rounds/list - List open rounds with filters
// - GET /rounds/my-rounds - List user's rounds (as organizer or participant)

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import { corsHeaders } from '../_shared/cors.ts';
import { TIER_SLUGS, getTierFeatures, TierSlug } from '../_shared/tier-gate.ts';

// Initialize Supabase client
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface RoundFilters {
  dateFrom?: string;
  dateTo?: string;
  courseId?: string;
  format?: string;
  city?: string;
  state?: string;
  sortBy?: 'date' | 'spots_available' | 'created';
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
  status?: string;
}

interface RoundResponse {
  id: string;
  courseId: string;
  courseName: string;
  courseCity: string;
  courseState: string;
  courseLocation?: { latitude: number; longitude: number };
  organizerId: string;
  organizerName?: string;
  organizerAvatar?: string;
  organizerTier?: string;
  roundDate: string;
  teeTime: string;
  format: string;
  totalSpots: number;
  spotsAvailable: number;
  visibility: string;
  handicapMin: number | null;
  handicapMax: number | null;
  notes: string | null;
  status: string;
  participantCount: number;
  myRole: 'organizer' | 'participant' | null;
  myStatus: 'confirmed' | 'pending' | 'invited' | null;
  createdAt: string;
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

    // Parse URL to determine endpoint
    const url = new URL(req.url);
    const path = url.pathname;
    const isMyRounds = path.includes('my-rounds') || url.searchParams.get('my_rounds') === 'true';

    // Get user's tier
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select(`
        id,
        tier_id,
        membership_tiers (
          id,
          slug
        )
      `)
      .eq('id', user.id)
      .single();

    if (userError) {
      return new Response(
        JSON.stringify({ error: 'User not found', code: 'user_not_found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const tier = userData.membership_tiers as { slug: TierSlug } | null;
    const userTier = tier?.slug || TIER_SLUGS.FREE;

    // Parse query parameters
    const filters: RoundFilters = {
      dateFrom: url.searchParams.get('date_from') || undefined,
      dateTo: url.searchParams.get('date_to') || undefined,
      courseId: url.searchParams.get('course_id') || undefined,
      format: url.searchParams.get('format') || undefined,
      city: url.searchParams.get('city') || undefined,
      state: url.searchParams.get('state') || undefined,
      sortBy: (url.searchParams.get('sort_by') as RoundFilters['sortBy']) || 'date',
      sortOrder: (url.searchParams.get('sort_order') as RoundFilters['sortOrder']) || 'asc',
      limit: Math.min(parseInt(url.searchParams.get('limit') || '20', 10), 100),
      offset: parseInt(url.searchParams.get('offset') || '0', 10),
      status: url.searchParams.get('status') || undefined
    };

    let rounds: any[] = [];
    let totalCount = 0;

    if (isMyRounds) {
      // Get user's rounds (as organizer or participant)
      const { data: organizedRounds, error: organizedError } = await supabase
        .from('golf_rounds')
        .select(
          `
          id,
          course_id,
          course:course_id (name, city, state, location),
          organizer_id,
          round_date,
          tee_time,
          format,
          total_spots,
          spots_available,
          visibility,
          handicap_min,
          handicap_max,
          notes,
          status,
          created_at,
          participants:golf_round_participants (count)
        `
        )
        .eq('organizer_id', user.id);

      const { data: participatingRounds, error: participantError } = await supabase
        .from('golf_round_participants')
        .select(
          `
          status,
          joined_at,
          round:round_id (
            id,
            course_id,
            course:course_id (name, city, state, location),
            organizer_id,
            round_date,
            tee_time,
            format,
            total_spots,
            spots_available,
            visibility,
            handicap_min,
            handicap_max,
            notes,
            status,
            created_at
          )
        `
        )
        .eq('user_id', user.id)
        .neq('round.organizer_id', user.id); // Exclude organized rounds

      if (organizedError || participantError) {
        console.error('Error fetching my rounds:', organizedError || participantError);
        return new Response(
          JSON.stringify({ error: 'Failed to fetch rounds', code: 'fetch_failed' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Combine and transform rounds
      const organized = (organizedRounds || []).map(r => ({
        ...r,
        myRole: 'organizer',
        myStatus: 'confirmed'
      }));

      const participating = (participatingRounds || [])
        .filter(p => p.round)
        .map(p => ({
          ...p.round,
          myRole: 'participant',
          myStatus: p.status
        }));

      rounds = [...organized, ...participating];
      totalCount = rounds.length;

      // Apply filters
      if (filters.status) {
        rounds = rounds.filter(r => r.status === filters.status);
      }
      if (filters.dateFrom) {
        rounds = rounds.filter(r => r.round_date >= filters.dateFrom);
      }
      if (filters.dateTo) {
        rounds = rounds.filter(r => r.round_date <= filters.dateTo);
      }

      // Sort
      rounds.sort((a, b) => {
        const dateA = new Date(a.round_date + 'T' + a.tee_time);
        const dateB = new Date(b.round_date + 'T' + b.tee_time);
        return filters.sortOrder === 'asc' ? dateA.getTime() - dateB.getTime() : dateB.getTime() - dateA.getTime();
      });

      // Apply pagination
      rounds = rounds.slice(filters.offset, filters.offset + filters.limit);
    } else {
      // List open rounds (discovery)
      // Build base query
      let query = supabase
        .from('golf_rounds')
        .select(
          `
          id,
          course_id,
          course:course_id (name, city, state, location),
          organizer_id,
          organizer:organizer_id (display_name, avatar_url, tier_id, tier:tier_id (slug)),
          round_date,
          tee_time,
          format,
          total_spots,
          spots_available,
          visibility,
          handicap_min,
          handicap_max,
          notes,
          status,
          created_at,
          participants:golf_round_participants (count)
        `,
          { count: 'exact' }
        )
        .eq('status', filters.status || 'open');

      // Apply same-tier visibility filter
      // Users can only see rounds from users in their tier (except Summit can see all)
      if (userTier !== TIER_SLUGS.SUMMIT) {
        // Get all user IDs in the same tier
        const { data: sameTierUsers } = await supabase
          .from('users')
          .select('id')
          .eq('tier_id', userData.tier_id);

        const sameTierUserIds = (sameTierUsers || []).map(u => u.id);
        sameTierUserIds.push(user.id); // Always include own rounds

        query = query.in('organizer_id', sameTierUserIds);
      }

      // Exclude user's own rounds
      query = query.neq('organizer_id', user.id);

      // Apply date range filters
      if (filters.dateFrom) {
        query = query.gte('round_date', filters.dateFrom);
      }
      if (filters.dateTo) {
        query = query.lte('round_date', filters.dateTo);
      }

      // Apply course filter
      if (filters.courseId) {
        query = query.eq('course_id', filters.courseId);
      }

      // Apply format filter
      if (filters.format) {
        query = query.eq('format', filters.format);
      }

      // Apply sorting
      const sortColumn = {
        date: 'round_date',
        spots_available: 'spots_available',
        created: 'created_at'
      }[filters.sortBy || 'date'];

      query = query.order(sortColumn, { ascending: filters.sortOrder === 'asc' });

      // Apply pagination
      query = query.range(filters.offset, filters.offset + filters.limit - 1);

      // Execute query
      const { data: fetchedRounds, error: roundsError, count } = await query;

      if (roundsError) {
        console.error('Error fetching rounds:', roundsError);
        return new Response(
          JSON.stringify({ error: 'Failed to fetch rounds', code: 'fetch_failed' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      rounds = fetchedRounds || [];
      totalCount = count || 0;

      // Filter by city/state in memory if specified
      if (filters.city || filters.state) {
        rounds = rounds.filter(round => {
          const course = round.course as any;
          if (filters.city && course?.city?.toLowerCase() !== filters.city.toLowerCase()) {
            return false;
          }
          if (filters.state && course?.state?.toLowerCase() !== filters.state.toLowerCase()) {
            return false;
          }
          return true;
        });
      }
    }

    // Transform response
    const roundResponses: RoundResponse[] = rounds.map(round => {
      const course = round.course as any;
      const organizer = round.organizer as any;
      const participants = round.participants as any;

      return {
        id: round.id,
        courseId: round.course_id,
        courseName: course?.name || 'Unknown Course',
        courseCity: course?.city,
        courseState: course?.state,
        courseLocation: course?.location,
        organizerId: round.organizer_id,
        organizerName: organizer?.display_name,
        organizerAvatar: organizer?.avatar_url,
        organizerTier: organizer?.tier?.slug,
        roundDate: round.round_date,
        teeTime: round.tee_time,
        format: round.format,
        totalSpots: round.total_spots,
        spotsAvailable: round.spots_available,
        visibility: round.visibility,
        handicapMin: round.handicap_min,
        handicapMax: round.handicap_max,
        notes: round.notes,
        status: round.status,
        participantCount: participants?.[0]?.count || 0,
        myRole: round.myRole || null,
        myStatus: round.myStatus || null,
        createdAt: round.created_at
      };
    });

    return new Response(
      JSON.stringify({
        data: roundResponses,
        pagination: {
          total: totalCount,
          limit: filters.limit,
          offset: filters.offset
        }
      }),
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

// Golf Courses List Edge Function
// Handles course discovery with location filters

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import { corsHeaders } from '../_shared/cors.ts';
import { TIER_SLUGS, getTierFeatures, TierSlug } from '../_shared/tier-gate.ts';

// Initialize Supabase client
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface CourseFilters {
  lat?: number;
  lng?: number;
  radiusKm?: number;
  city?: string;
  state?: string;
  minHoles?: number;
  isPublic?: boolean;
  maxCourseRating?: number;
  minCourseRating?: number;
  query?: string;
  sortBy?: 'distance' | 'rating' | 'name';
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

interface CourseResponse {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  country: string;
  location: { latitude: number; longitude: number };
  holes: number;
  par: number;
  totalYards?: number;
  courseRating?: number;
  slopeRating?: number;
  isPublic: boolean;
  phone?: string;
  websiteUrl?: string;
  bookingUrl?: string;
  active: boolean;
  distanceKm?: number;
  createdAt: string;
  updatedAt: string;
}

// Calculate distance between two points using Haversine formula
function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371; // Earth's radius in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
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

  // Get auth header (optional - courses can be browsed without auth for discovery)
  const authHeader = req.headers.get('Authorization');
  let userTier = TIER_SLUGS.FREE;

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // If auth provided, get user tier
    if (authHeader) {
      const authedSupabase = createClient(supabaseUrl, supabaseServiceKey, {
        global: { headers: { Authorization: authHeader } }
      });

      const { data: { user } } = await authedSupabase.auth.getUser();
      if (user) {
        const { data: userData } = await supabase
          .from('users')
          .select('tier_id, membership_tiers(slug)')
          .eq('id', user.id)
          .single();

        const tier = userData?.membership_tiers as { slug: TierSlug } | null;
        userTier = tier?.slug || TIER_SLUGS.FREE;
      }
    }

    // Parse query parameters
    const url = new URL(req.url);
    const path = url.pathname;
    const isDetailEndpoint = path.includes('/courses/') && path.split('/courses/')[1];

    // Handle course detail endpoint
    if (isDetailEndpoint) {
      const courseId = path.split('/courses/')[1].split('?')[0];
      return handleCourseDetail(supabase, courseId);
    }

    // Parse filters
    const filters: CourseFilters = {
      lat: url.searchParams.get('lat') ? parseFloat(url.searchParams.get('lat')!) : undefined,
      lng: url.searchParams.get('lng') ? parseFloat(url.searchParams.get('lng')!) : undefined,
      radiusKm: url.searchParams.get('radius_km') ? parseFloat(url.searchParams.get('radius_km')!) : undefined,
      city: url.searchParams.get('city') || undefined,
      state: url.searchParams.get('state') || undefined,
      minHoles: url.searchParams.get('min_holes') ? parseInt(url.searchParams.get('min_holes')!, 10) : undefined,
      isPublic: url.searchParams.get('is_public') ? url.searchParams.get('is_public') === 'true' : undefined,
      maxCourseRating: url.searchParams.get('max_course_rating') ? parseFloat(url.searchParams.get('max_course_rating')!) : undefined,
      minCourseRating: url.searchParams.get('min_course_rating') ? parseFloat(url.searchParams.get('min_course_rating')!) : undefined,
      query: url.searchParams.get('q') || undefined,
      sortBy: (url.searchParams.get('sort_by') as CourseFilters['sortBy']) || 'name',
      sortOrder: (url.searchParams.get('sort_order') as CourseFilters['sortOrder']) || 'asc',
      limit: Math.min(parseInt(url.searchParams.get('limit') || '20', 10), 100),
      offset: parseInt(url.searchParams.get('offset') || '0', 10)
    };

    // Validate pagination
    if (filters.limit && filters.limit < 1) {
      return new Response(
        JSON.stringify({ error: 'limit must be at least 1', code: 'invalid_limit' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate coordinates if provided
    if ((filters.lat !== undefined || filters.lng !== undefined) && 
        (filters.lat === undefined || filters.lng === undefined)) {
      return new Response(
        JSON.stringify({ error: 'Both lat and lng are required for location search', code: 'invalid_location' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build base query
    let query = supabase
      .from('golf_courses')
      .select('*')
      .eq('active', true);

    // Apply text search (name or address)
    if (filters.query) {
      query = query.or(`name.ilike.%${filters.query}%,address.ilike.%${filters.query}%,city.ilike.%${filters.query}%`);
    }

    // Apply city filter
    if (filters.city) {
      query = query.ilike('city', filters.city);
    }

    // Apply state filter
    if (filters.state) {
      query = query.ilike('state', filters.state);
    }

    // Apply min holes filter
    if (filters.minHoles) {
      query = query.gte('holes', filters.minHoles);
    }

    // Apply public/private filter
    if (filters.isPublic !== undefined) {
      query = query.eq('is_public', filters.isPublic);
    }

    // Apply course rating filters
    if (filters.minCourseRating !== undefined) {
      query = query.gte('course_rating', filters.minCourseRating);
    }
    if (filters.maxCourseRating !== undefined) {
      query = query.lte('course_rating', filters.maxCourseRating);
    }

    // Apply sorting
    const sortColumn = {
      distance: 'name', // Distance is calculated, we'll sort after fetch
      rating: 'course_rating',
      name: 'name'
    }[filters.sortBy || 'name'];

    query = query.order(sortColumn, { ascending: filters.sortOrder === 'asc' });

    // Execute query
    const { data: courses, error: coursesError } = await query;

    if (coursesError) {
      console.error('Error fetching courses:', coursesError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch courses', code: 'fetch_failed' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Transform and filter results
    let courseResponses: CourseResponse[] = (courses || []).map(course => ({
      id: course.id,
      name: course.name,
      address: course.address,
      city: course.city,
      state: course.state,
      country: course.country,
      location: course.location,
      holes: course.holes,
      par: course.par,
      totalYards: course.total_yards,
      courseRating: course.course_rating,
      slopeRating: course.slope_rating,
      isPublic: course.is_public,
      phone: course.phone,
      websiteUrl: course.website_url,
      bookingUrl: course.booking_url,
      active: course.active,
      createdAt: course.created_at,
      updatedAt: course.updated_at
    }));

    // Calculate distances if location provided
    if (filters.lat !== undefined && filters.lng !== undefined) {
      courseResponses = courseResponses.map(course => ({
        ...course,
        distanceKm: calculateDistance(
          filters.lat!,
          filters.lng!,
          course.location.latitude,
          course.location.longitude
        )
      }));

      // Filter by radius if specified
      if (filters.radiusKm) {
        courseResponses = courseResponses.filter(course => 
          course.distanceKm! <= filters.radiusKm!
        );
      }

      // Sort by distance if requested
      if (filters.sortBy === 'distance') {
        courseResponses.sort((a, b) => {
          const distA = a.distanceKm || Infinity;
          const distB = b.distanceKm || Infinity;
          return filters.sortOrder === 'asc' ? distA - distB : distB - distA;
        });
      }
    }

    // Apply pagination
    const totalCount = courseResponses.length;
    courseResponses = courseResponses.slice(filters.offset, filters.offset + filters.limit!);

    // Apply tier-based limits on search results
    const tierFeatures = getTierFeatures(userTier);
    if (tierFeatures.maxSearchResults !== null && courseResponses.length > tierFeatures.maxSearchResults) {
      // Only apply limit for free tier
      if (userTier === TIER_SLUGS.FREE) {
        courseResponses = courseResponses.slice(0, tierFeatures.maxSearchResults);
      }
    }

    return new Response(
      JSON.stringify({
        data: courseResponses,
        pagination: {
          total: totalCount,
          limit: filters.limit,
          offset: filters.offset
        },
        tier: {
          slug: userTier,
          maxResults: tierFeatures.maxSearchResults
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Courses list error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Internal server error', code: 'internal_error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function handleCourseDetail(supabase: any, courseId: string) {
  if (!courseId) {
    return new Response(
      JSON.stringify({ error: 'Course ID is required', code: 'missing_course_id' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const { data: course, error } = await supabase
    .from('golf_courses')
    .select('*')
    .eq('id', courseId)
    .eq('active', true)
    .single();

  if (error || !course) {
    return new Response(
      JSON.stringify({ error: 'Course not found', code: 'course_not_found' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const response: CourseResponse = {
    id: course.id,
    name: course.name,
    address: course.address,
    city: course.city,
    state: course.state,
    country: course.country,
    location: course.location,
    holes: course.holes,
    par: course.par,
    totalYards: course.total_yards,
    courseRating: course.course_rating,
    slopeRating: course.slope_rating,
    isPublic: course.is_public,
    phone: course.phone,
    websiteUrl: course.website_url,
    bookingUrl: course.booking_url,
    active: course.active,
    createdAt: course.created_at,
    updatedAt: course.updated_at
  };

  return new Response(
    JSON.stringify({ data: response }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

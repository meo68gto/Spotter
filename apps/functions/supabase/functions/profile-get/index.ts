// Profile Get Edge Function
// Get current user's extended profile or another user's profile (same-tier only)
// Routes: GET /profile/get, GET /profile/get/:id

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import { corsHeaders } from '../_shared/cors.ts';
import { TIER_SLUGS, getTierFeatures, canSeeSameTier, TierSlug } from '../_shared/tier-gate.ts';

// Initialize Supabase client
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

interface ProfileResponse {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  bio: string | null;
  timezone: string | null;
  professionalIdentity: {
    company: string | null;
    title: string | null;
    industry: string | null;
    linkedinUrl: string | null;
    yearsExperience: number | null;
  };
  golfIdentity: {
    handicap: number | null;
    homeCourseId: string | null;
    homeCourseName: string | null;
    playingFrequency: string | null;
    favoriteFormats: string[];
    yearsPlaying: number | null;
  };
  tier: {
    id: string;
    name: string;
    slug: TierSlug;
    cardColor: string;
  };
  reputation: {
    overallScore: number;
    completionRate: number;
    ratingsAverage: number;
    networkSize: number;
    referralsCount: number;
    profileCompleteness: number;
    attendanceRate: number;
  };
  profileCompleteness: number;
  createdAt: string;
  updatedAt: string;
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
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
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

    // Parse URL to get target user ID
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/');
    const targetUserId = pathParts[pathParts.length - 1] === 'get' 
      ? user.id 
      : pathParts[pathParts.length - 1];

    // Get current user's tier info
    const { data: currentUserData, error: currentUserError } = await supabase
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

    if (currentUserError || !currentUserData) {
      return new Response(
        JSON.stringify({ error: 'Current user not found', code: 'user_not_found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const currentTier = currentUserData.membership_tiers as { slug: TierSlug } | null;
    const currentTierSlug = currentTier?.slug || TIER_SLUGS.FREE;

    // Get target user's profile with tier
    const { data: targetUser, error: targetUserError } = await supabase
      .from('users')
      .select(`
        id,
        email,
        display_name,
        avatar_url,
        bio,
        timezone,
        tier_id,
        profile_completeness,
        created_at,
        updated_at,
        membership_tiers (
          id,
          name,
          slug,
          card_color
        )
      `)
      .eq('id', targetUserId)
      .single();

    if (targetUserError || !targetUser) {
      return new Response(
        JSON.stringify({ error: 'User not found', code: 'user_not_found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const targetTier = targetUser.membership_tiers as { id: string; name: string; slug: TierSlug; card_color: string } | null;
    const targetTierSlug = targetTier?.slug || TIER_SLUGS.FREE;

    // Check same-tier visibility
    if (user.id !== targetUserId && !canSeeSameTier(currentTierSlug, targetTierSlug)) {
      return new Response(
        JSON.stringify({ 
          error: 'Profile not visible', 
          code: 'tier_visibility_restricted',
          message: 'You can only view profiles from users in your tier or higher tiers'
        }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get professional identity
    const { data: professionalIdentity } = await supabase
      .from('user_professional_identities')
      .select('company, title, industry, linkedin_url, years_experience')
      .eq('user_id', targetUserId)
      .maybeSingle();

    // Get golf identity
    const { data: golfIdentity } = await supabase
      .from('user_golf_identities')
      .select('handicap, home_course_id, playing_frequency, favorite_formats, years_playing')
      .eq('user_id', targetUserId)
      .maybeSingle();

    // Get home course name if available
    let homeCourseName: string | null = null;
    if (golfIdentity?.home_course_id) {
      const { data: course } = await supabase
        .from('golf_courses')
        .select('name')
        .eq('id', golfIdentity.home_course_id)
        .maybeSingle();
      homeCourseName = course?.name || null;
    }

    // Get reputation
    const { data: reputation } = await supabase
      .from('user_reputation')
      .select('overall_score, completion_rate, ratings_average, network_size, referrals_count, profile_completeness, attendance_rate')
      .eq('user_id', targetUserId)
      .maybeSingle();

    // Get network size (connections count)
    const { count: networkSize } = await supabase
      .from('user_connections')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', targetUserId)
      .eq('status', 'accepted');

    // Build response
    const response: ProfileResponse = {
      id: targetUser.id,
      email: targetUser.email,
      displayName: targetUser.display_name,
      avatarUrl: targetUser.avatar_url,
      bio: targetUser.bio,
      timezone: targetUser.timezone,
      professionalIdentity: {
        company: professionalIdentity?.company || null,
        title: professionalIdentity?.title || null,
        industry: professionalIdentity?.industry || null,
        linkedinUrl: professionalIdentity?.linkedin_url || null,
        yearsExperience: professionalIdentity?.years_experience || null
      },
      golfIdentity: {
        handicap: golfIdentity?.handicap || null,
        homeCourseId: golfIdentity?.home_course_id || null,
        homeCourseName,
        playingFrequency: golfIdentity?.playing_frequency || null,
        favoriteFormats: golfIdentity?.favorite_formats || [],
        yearsPlaying: golfIdentity?.years_playing || null
      },
      tier: {
        id: targetTier?.id || '',
        name: targetTier?.name || 'Free',
        slug: targetTierSlug,
        cardColor: targetTier?.card_color || '#94A3B8'
      },
      reputation: {
        overallScore: reputation?.overall_score || 0,
        completionRate: reputation?.completion_rate || 0,
        ratingsAverage: reputation?.ratings_average || 0,
        networkSize: networkSize || 0,
        referralsCount: reputation?.referrals_count || 0,
        profileCompleteness: reputation?.profile_completeness || targetUser.profile_completeness || 0,
        attendanceRate: reputation?.attendance_rate || 0
      },
      profileCompleteness: targetUser.profile_completeness || 0,
      createdAt: targetUser.created_at,
      updatedAt: targetUser.updated_at
    };

    return new Response(
      JSON.stringify({ data: response }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Profile get error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Internal server error', code: 'internal_error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// Profile Update Edge Function
// Update user profile fields with tier-based validation
// Route: POST /profile/update

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import { corsHeaders } from '../_shared/cors.ts';
import { TIER_SLUGS, getTierFeatures, TierSlug } from '../_shared/tier-gate.ts';

// Initialize Supabase client
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// Fields that all tiers can update
const FREE_EDITABLE_FIELDS = [
  'display_name',
  'avatar_url',
  'bio',
  'timezone'
];

// Fields that require SELECT or higher
const SELECT_EDITABLE_FIELDS = [
  ...FREE_EDITABLE_FIELDS,
  'professional_identity',
  'golf_identity'
];

interface ProfileUpdateRequest {
  displayName?: string;
  avatarUrl?: string;
  bio?: string;
  timezone?: string;
  professionalIdentity?: {
    company?: string;
    title?: string;
    industry?: string;
    linkedinUrl?: string;
    yearsExperience?: number;
  };
  golfIdentity?: {
    handicap?: number;
    homeCourseId?: string;
    playingFrequency?: string;
    favoriteFormats?: string[];
    yearsPlaying?: number;
  };
}

interface ProfileResponse {
  id: string;
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
    playingFrequency: string | null;
    favoriteFormats: string[];
    yearsPlaying: number | null;
  };
  profileCompleteness: number;
  updatedAt: string;
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
    // Create client with user's JWT for auth check
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
    let body: ProfileUpdateRequest;
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: 'Invalid JSON body', code: 'invalid_json' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get user with tier info
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select(`
        id,
        tier_id,
        tier_status,
        membership_tiers (
          id,
          slug
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
    const tierSlug = tier?.slug || TIER_SLUGS.FREE;
    const tierFeatures = getTierFeatures(tierSlug);

    // Check tier status is active
    if (userData.tier_status !== 'active') {
      return new Response(
        JSON.stringify({ 
          error: 'Your membership is not active', 
          code: 'tier_not_active',
          tierStatus: userData.tier_status
        }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user is trying to update fields beyond their tier
    const hasProfessionalIdentityUpdate = body.professionalIdentity !== undefined;
    const hasGolfIdentityUpdate = body.golfIdentity !== undefined;

    if ((hasProfessionalIdentityUpdate || hasGolfIdentityUpdate) && tierSlug === TIER_SLUGS.FREE) {
      return new Response(
        JSON.stringify({ 
          error: 'Your tier does not allow updating professional or golf identity. Upgrade to Select or Summit.', 
          code: 'tier_insufficient',
          currentTier: tierSlug,
          requiredTier: TIER_SLUGS.SELECT
        }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build user table updates
    const userUpdates: Record<string, any> = {};
    
    if (body.displayName !== undefined) {
      if (body.displayName.length < 2 || body.displayName.length > 50) {
        return new Response(
          JSON.stringify({ error: 'Display name must be between 2 and 50 characters', code: 'invalid_display_name' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      userUpdates.display_name = body.displayName;
    }
    
    if (body.avatarUrl !== undefined) {
      // Basic URL validation
      if (body.avatarUrl && !body.avatarUrl.match(/^https?:\/\/.+/)) {
        return new Response(
          JSON.stringify({ error: 'Invalid avatar URL', code: 'invalid_avatar_url' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      userUpdates.avatar_url = body.avatarUrl;
    }
    
    if (body.bio !== undefined) {
      if (body.bio.length > 500) {
        return new Response(
          JSON.stringify({ error: 'Bio must be 500 characters or less', code: 'invalid_bio' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      userUpdates.bio = body.bio;
    }
    
    if (body.timezone !== undefined) {
      // Validate timezone format (e.g., "America/New_York")
      if (body.timezone && !body.timezone.match(/^[A-Za-z_]+\/[A-Za-z_]+$/)) {
        return new Response(
          JSON.stringify({ error: 'Invalid timezone format. Use format like "America/New_York"', code: 'invalid_timezone' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      userUpdates.timezone = body.timezone;
    }

    // Update users table
    if (Object.keys(userUpdates).length > 0) {
      const { error: updateError } = await supabase
        .from('users')
        .update(userUpdates)
        .eq('id', user.id);

      if (updateError) {
        return new Response(
          JSON.stringify({ error: 'Failed to update profile', code: 'update_failed', details: updateError.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Update professional identity
    if (hasProfessionalIdentityUpdate && tierSlug !== TIER_SLUGS.FREE) {
      const profData = body.professionalIdentity;
      
      // Validate LinkedIn URL if provided
      if (profData?.linkedinUrl && !profData.linkedinUrl.match(/^https:\/\/([a-z]+\.)?linkedin\.com\/in\/.+/)) {
        return new Response(
          JSON.stringify({ error: 'Invalid LinkedIn URL format', code: 'invalid_linkedin_url' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { error: profError } = await supabase
        .from('user_professional_identities')
        .upsert({
          user_id: user.id,
          company: profData?.company || null,
          title: profData?.title || null,
          industry: profData?.industry || null,
          linkedin_url: profData?.linkedinUrl || null,
          years_experience: profData?.yearsExperience || null,
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_id' });

      if (profError) {
        console.error('Error updating professional identity:', profError);
      }
    }

    // Update golf identity
    if (hasGolfIdentityUpdate && tierSlug !== TIER_SLUGS.FREE) {
      const golfData = body.golfIdentity;

      // Validate handicap if provided (typically -5 to 54)
      if (golfData?.handicap !== undefined) {
        if (golfData.handicap < -5 || golfData.handicap > 54) {
          return new Response(
            JSON.stringify({ error: 'Handicap must be between -5 and 54', code: 'invalid_handicap' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      // Validate home course if provided
      if (golfData?.homeCourseId) {
        const { data: course, error: courseError } = await supabase
          .from('golf_courses')
          .select('id')
          .eq('id', golfData.homeCourseId)
          .single();

        if (courseError || !course) {
          return new Response(
            JSON.stringify({ error: 'Home course not found', code: 'course_not_found' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      const { error: golfError } = await supabase
        .from('user_golf_identities')
        .upsert({
          user_id: user.id,
          handicap: golfData?.handicap || null,
          home_course_id: golfData?.homeCourseId || null,
          playing_frequency: golfData?.playingFrequency || null,
          favorite_formats: golfData?.favoriteFormats || [],
          years_playing: golfData?.yearsPlaying || null,
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_id' });

      if (golfError) {
        console.error('Error updating golf identity:', golfError);
      }
    }

    // Calculate new profile completeness
    const profileCompleteness = await calculateProfileCompleteness(supabase, user.id);

    // Update profile completeness on user record
    await supabase
      .from('users')
      .update({ profile_completeness: profileCompleteness })
      .eq('id', user.id);

    // Get updated profile
    const { data: updatedUser, error: fetchError } = await supabase
      .from('users')
      .select('id, display_name, avatar_url, bio, timezone, profile_completeness, updated_at')
      .eq('id', user.id)
      .single();

    if (fetchError || !updatedUser) {
      return new Response(
        JSON.stringify({ error: 'Failed to fetch updated profile', code: 'fetch_failed' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get professional identity
    const { data: professionalIdentity } = await supabase
      .from('user_professional_identities')
      .select('company, title, industry, linkedin_url, years_experience')
      .eq('user_id', user.id)
      .maybeSingle();

    // Get golf identity
    const { data: golfIdentity } = await supabase
      .from('user_golf_identities')
      .select('handicap, home_course_id, playing_frequency, favorite_formats, years_playing')
      .eq('user_id', user.id)
      .maybeSingle();

    // Build response
    const response: ProfileResponse = {
      id: updatedUser.id,
      displayName: updatedUser.display_name,
      avatarUrl: updatedUser.avatar_url,
      bio: updatedUser.bio,
      timezone: updatedUser.timezone,
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
        playingFrequency: golfIdentity?.playing_frequency || null,
        favoriteFormats: golfIdentity?.favorite_formats || [],
        yearsPlaying: golfIdentity?.years_playing || null
      },
      profileCompleteness,
      updatedAt: updatedUser.updated_at
    };

    return new Response(
      JSON.stringify({ data: response }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Profile update error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Internal server error', code: 'internal_error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

/**
 * Calculate profile completeness percentage
 */
async function calculateProfileCompleteness(supabase: any, userId: string): Promise<number> {
  const fields = [];
  let filledFields = 0;

  // Check base user fields
  const { data: user } = await supabase
    .from('users')
    .select('display_name, avatar_url, bio, timezone')
    .eq('id', userId)
    .single();

  if (user) {
    fields.push('display_name', 'avatar_url', 'bio', 'timezone');
    if (user.display_name) filledFields++;
    if (user.avatar_url) filledFields++;
    if (user.bio) filledFields++;
    if (user.timezone) filledFields++;
  }

  // Check professional identity
  const { data: prof } = await supabase
    .from('user_professional_identities')
    .select('company, title, industry, linkedin_url, years_experience')
    .eq('user_id', userId)
    .maybeSingle();

  if (prof) {
    fields.push('company', 'title', 'industry', 'linkedin_url', 'years_experience');
    if (prof.company) filledFields++;
    if (prof.title) filledFields++;
    if (prof.industry) filledFields++;
    if (prof.linkedin_url) filledFields++;
    if (prof.years_experience !== null) filledFields++;
  }

  // Check golf identity
  const { data: golf } = await supabase
    .from('user_golf_identities')
    .select('handicap, home_course_id, playing_frequency, favorite_formats, years_playing')
    .eq('user_id', userId)
    .maybeSingle();

  if (golf) {
    fields.push('handicap', 'home_course_id', 'playing_frequency', 'favorite_formats', 'years_playing');
    if (golf.handicap !== null) filledFields++;
    if (golf.home_course_id) filledFields++;
    if (golf.playing_frequency) filledFields++;
    if (golf.favorite_formats?.length > 0) filledFields++;
    if (golf.years_playing !== null) filledFields++;
  }

  return fields.length > 0 ? Math.round((filledFields / fields.length) * 100) : 0;
}

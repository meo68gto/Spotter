// ============================================================================
// Phase 1 Onboarding Edge Function
// Handles tier selection, golf identity, professional identity, and networking preferences
// ============================================================================

import { createClient } from '@supabase/supabase-js';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface OnboardingPayload {
  tierSlug: string;
  golfIdentity: {
    handicapBand: string;
    typicalScore: number;
    homeCourse: string | null;
    playFrequency: string | null;
    yearsPlaying: number | null;
  };
  professionalIdentity: {
    role: string;
    company: string;
    industry: string | null;
    linkedinUrl: string | null;
  } | null;
  networkingPreferences: {
    networkingIntent: string;
    openToIntros: boolean;
    openToSendingIntros: boolean;
    openToRecurringRounds: boolean;
    preferredGroupSize: string;
    cartPreference: string;
    preferredGolfArea: string | null;
  };
  location: {
    city: string;
    timezone: string;
  };
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Create Supabase client with service role for elevated access
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // Get current user from JWT
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const payload: OnboardingPayload = await req.json();

    // Validate required fields
    if (!payload.tierSlug) {
      return new Response(
        JSON.stringify({ error: 'tierSlug is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!payload.golfIdentity?.handicapBand) {
      return new Response(
        JSON.stringify({ error: 'golfIdentity.handicapBand is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!payload.networkingPreferences?.networkingIntent) {
      return new Response(
        JSON.stringify({ error: 'networkingPreferences.networkingIntent is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get tier ID from slug
    const { data: tierData, error: tierError } = await supabaseClient
      .from('membership_tiers')
      .select('id, slug')
      .eq('slug', payload.tierSlug)
      .single();

    if (tierError || !tierData) {
      return new Response(
        JSON.stringify({ error: 'Invalid tier slug' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Calculate tier expiration based on billing interval
    const now = new Date();
    let tierExpiresAt: string | null = null;
    
    if (payload.tierSlug === 'free') {
      // Free tier never expires
      tierExpiresAt = null;
    } else if (payload.tierSlug === 'select') {
      // Select tier: 1 year from now
      const expiry = new Date(now);
      expiry.setFullYear(expiry.getFullYear() + 1);
      tierExpiresAt = expiry.toISOString();
    } else if (payload.tierSlug === 'summit') {
      // Summit tier: lifetime (set to 100 years from now as a practical limit)
      const expiry = new Date(now);
      expiry.setFullYear(expiry.getFullYear() + 100);
      tierExpiresAt = expiry.toISOString();
    }

    // Update user with tier and basic info
    const { error: userUpdateError } = await supabaseClient
      .from('users')
      .update({
        tier_id: tierData.id,
        tier_enrolled_at: now.toISOString(),
        tier_expires_at: tierExpiresAt,
        tier_status: 'active',
        city: payload.location.city || null,
        timezone: payload.location.timezone,
        updated_at: now.toISOString(),
      })
      .eq('id', user.id);

    if (userUpdateError) {
      console.error('Error updating user tier:', userUpdateError);
      return new Response(
        JSON.stringify({ error: 'Failed to update user tier' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create or update golf identity
    const { error: golfIdentityError } = await supabaseClient
      .from('user_golf_identities')
      .upsert({
        user_id: user.id,
        handicap: payload.golfIdentity.typicalScore || null,
        home_course_id: null, // Would need to look up course ID from name
        playing_frequency: payload.golfIdentity.playFrequency,
        years_playing: payload.golfIdentity.yearsPlaying,
        updated_at: now.toISOString(),
      }, {
        onConflict: 'user_id',
      });

    if (golfIdentityError) {
      console.error('Error creating golf identity:', golfIdentityError);
      // Continue - not critical
    }

    // Create or update professional identity (if provided)
    if (payload.professionalIdentity?.role && payload.professionalIdentity?.company) {
      const { error: profIdentityError } = await supabaseClient
        .from('user_professional_identities')
        .upsert({
          user_id: user.id,
          company: payload.professionalIdentity.company,
          title: payload.professionalIdentity.role,
          industry: payload.professionalIdentity.industry,
          linkedin_url: payload.professionalIdentity.linkedinUrl,
          updated_at: now.toISOString(),
        }, {
          onConflict: 'user_id',
        });

      if (profIdentityError) {
        console.error('Error creating professional identity:', profIdentityError);
        // Continue - not critical
      }
    }

    // Create or update networking preferences
    const { error: networkingPrefsError } = await supabaseClient
      .from('user_networking_preferences')
      .upsert({
        user_id: user.id,
        networking_intent: payload.networkingPreferences.networkingIntent,
        open_to_intros: payload.networkingPreferences.openToIntros,
        open_to_sending_intros: payload.networkingPreferences.openToSendingIntros,
        open_to_recurring_rounds: payload.networkingPreferences.openToRecurringRounds,
        preferred_group_size: payload.networkingPreferences.preferredGroupSize,
        cart_preference: payload.networkingPreferences.cartPreference,
        preferred_golf_area: payload.networkingPreferences.preferredGolfArea,
        updated_at: now.toISOString(),
      }, {
        onConflict: 'user_id',
      });

    if (networkingPrefsError) {
      console.error('Error creating networking preferences:', networkingPrefsError);
      // Continue - not critical
    }

    // Create initial reputation record
    const { error: reputationError } = await supabaseClient
      .from('user_reputation')
      .upsert({
        user_id: user.id,
        overall_score: 50, // Starting score
        completion_rate: 0,
        ratings_average: 0,
        network_size: 0,
        referrals_count: 0,
        profile_completeness: 75, // Good starting point after onboarding
        attendance_rate: 100,
        calculated_at: now.toISOString(),
        updated_at: now.toISOString(),
      }, {
        onConflict: 'user_id',
      });

    if (reputationError) {
      console.error('Error creating reputation:', reputationError);
      // Continue - not critical
    }

    // Log the onboarding completion
    await supabaseClient
      .from('tier_history')
      .insert({
        user_id: user.id,
        previous_tier_id: null,
        new_tier_id: tierData.id,
        previous_status: 'pending',
        new_status: 'active',
        change_reason: 'onboarding_phase1_completed',
        changed_at: now.toISOString(),
        metadata: {
          handicap_band: payload.golfIdentity.handicapBand,
          networking_intent: payload.networkingPreferences.networkingIntent,
          onboarding_version: 'phase1',
        },
      });

    return new Response(
      JSON.stringify({
        success: true,
        userId: user.id,
        tierSlug: payload.tierSlug,
        message: 'Onboarding completed successfully',
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Onboarding error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

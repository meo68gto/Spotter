// Discovery Search Edge Function
// POST /discovery/search - Find discoverable golfers in same tier
// Same-tier visibility enforced at database level via discover_golfers() function

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import { corsHeaders } from '../_shared/cors.ts';
import { createTierViolationResponse, TIER_VIOLATION_STATUS } from '../_shared/enforcement.ts';

// Initialize Supabase client
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

// Validation constants
const VALID_HANDICAP_BANDS = ['low', 'mid', 'high'] as const;
const VALID_INTENTS = ['business', 'social', 'competitive', 'business_social'] as const;
const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 20;

// Type definitions
interface DiscoveryFilters {
  handicap_band?: 'low' | 'mid' | 'high';
  location?: string;
  intent?: 'business' | 'social' | 'competitive' | 'business_social';
  limit?: number;
  offset?: number;
}

interface DiscoverableGolfer {
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  city: string | null;
  tier_id: string;
  tier_slug: string;
  // Professional identity
  company: string | null;
  title: string | null;
  industry: string | null;
  years_experience: number | null;
  // Golf identity
  handicap: number | null;
  home_course_id: string | null;
  home_course_name: string | null;
  playing_frequency: string | null;
  years_playing: number | null;
  // Networking preferences
  networking_intent: string | null;
  open_to_intros: boolean | null;
  open_to_recurring_rounds: boolean | null;
  preferred_group_size: string | null;
  cart_preference: string | null;
  preferred_golf_area: string | null;
  // Reputation
  reputation_score: number;
  // Compatibility
  compatibility_score: number;
  // Metadata
  profile_completeness: number;
  created_at: string;
}

interface DiscoveryResponse {
  golfers: DiscoverableGolfer[];
  pagination: {
    limit: number;
    offset: number;
    total: number;
    has_more: boolean;
  };
  filters: DiscoveryFilters;
  caller_tier: {
    tier_id: string;
    slug: string;
  };
}

serve(async (req) => {
  // CORS preflight
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
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized', code: 'invalid_token', details: authError?.message }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get caller's tier info
    const { data: callerData, error: callerError } = await supabase
      .from('users')
      .select('tier_id, tier_status, membership_tiers(slug)')
      .eq('id', user.id)
      .single();

    if (callerError || !callerData) {
      return new Response(
        JSON.stringify({ error: 'Failed to get user tier', code: 'tier_lookup_failed', details: callerError?.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user has an active tier
    if (!callerData.tier_id || callerData.tier_status !== 'active') {
      return new Response(
        JSON.stringify({ error: 'Active tier membership required', code: 'inactive_tier' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    let body: DiscoveryFilters = {};
    try {
      const text = await req.text();
      if (text) {
        body = JSON.parse(text);
      }
    } catch (e) {
      return new Response(
        JSON.stringify({ error: 'Invalid JSON body', code: 'invalid_json' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate and sanitize filters
    const filters: DiscoveryFilters = {};

    // Handicap band validation
    if (body.handicap_band !== undefined) {
      if (!VALID_HANDICAP_BANDS.includes(body.handicap_band as typeof VALID_HANDICAP_BANDS[number])) {
        return new Response(
          JSON.stringify({ 
            error: 'Invalid handicap_band', 
            code: 'invalid_filter',
            details: `Must be one of: ${VALID_HANDICAP_BANDS.join(', ')}`
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      filters.handicap_band = body.handicap_band as typeof VALID_HANDICAP_BANDS[number];
    }

    // Location validation (sanitize input)
    if (body.location !== undefined && body.location !== null) {
      const location = String(body.location).trim();
      if (location.length > 100) {
        return new Response(
          JSON.stringify({ error: 'Location too long', code: 'invalid_filter', details: 'Maximum 100 characters' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (location) {
        filters.location = location;
      }
    }

    // Intent validation
    if (body.intent !== undefined) {
      if (!VALID_INTENTS.includes(body.intent as typeof VALID_INTENTS[number])) {
        return new Response(
          JSON.stringify({ 
            error: 'Invalid intent', 
            code: 'invalid_filter',
            details: `Must be one of: ${VALID_INTENTS.join(', ')}`
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      filters.intent = body.intent as typeof VALID_INTENTS[number];
    }

    // Pagination validation
    const limit = Math.min(
      Math.max(1, parseInt(String(body.limit ?? DEFAULT_LIMIT), 10)),
      MAX_LIMIT
    );
    const offset = Math.max(0, parseInt(String(body.offset ?? 0), 10));

    filters.limit = limit;
    filters.offset = offset;

    // Call the discover_golfers PostgreSQL function
    // Same-tier visibility is enforced by the function itself
    const { data: golfers, error: discoveryError } = await supabase
      .rpc('discover_golfers', {
        p_user_id: user.id,
        p_handicap_band: filters.handicap_band ?? null,
        p_location: filters.location ?? null,
        p_intent: filters.intent ?? null,
        p_limit: limit,
        p_offset: offset
      });

    if (discoveryError) {
      console.error('Discovery query error:', discoveryError);
      return new Response(
        JSON.stringify({ 
          error: 'Discovery query failed', 
          code: 'discovery_failed',
          details: discoveryError.message 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get total count for pagination (separate query for performance)
    // We estimate based on returned results
    const hasMore = golfers && golfers.length === limit;

    // Build response
    const response: DiscoveryResponse = {
      golfers: (golfers || []).map((g: DiscoverableGolfer) => ({
        user_id: g.user_id,
        display_name: g.display_name,
        avatar_url: g.avatar_url,
        city: g.city,
        tier_id: g.tier_id,
        tier_slug: g.tier_slug,
        company: g.company,
        title: g.title,
        industry: g.industry,
        years_experience: g.years_experience,
        handicap: g.handicap ? parseFloat(g.handicap as unknown as string) : null,
        home_course_id: g.home_course_id,
        home_course_name: g.home_course_name,
        playing_frequency: g.playing_frequency,
        years_playing: g.years_playing,
        networking_intent: g.networking_intent,
        open_to_intros: g.open_to_intros,
        open_to_recurring_rounds: g.open_to_recurring_rounds,
        preferred_group_size: g.preferred_group_size,
        cart_preference: g.cart_preference,
        preferred_golf_area: g.preferred_golf_area,
        reputation_score: g.reputation_score,
        compatibility_score: g.compatibility_score,
        profile_completeness: g.profile_completeness,
        created_at: g.created_at
      })),
      pagination: {
        limit,
        offset,
        total: offset + (golfers?.length || 0) + (hasMore ? 1 : 0), // Estimated
        has_more: hasMore
      },
      filters: {
        handicap_band: filters.handicap_band,
        location: filters.location,
        intent: filters.intent
      },
      caller_tier: {
        tier_id: callerData.tier_id,
        slug: (callerData.membership_tiers as any)?.slug || 'unknown'
      }
    };

    return new Response(
      JSON.stringify(response),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Discovery search error:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Internal server error', 
        code: 'internal_error' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

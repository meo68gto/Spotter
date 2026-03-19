// Trust Reliability Edge Function
// Get reliability breakdown for a user
// Route: GET /trust-reliability/:userId

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import { corsHeaders } from '../_shared/cors.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface ReliabilityBreakdown {
  reliabilityScore: number;
  reliabilityLabel: string;
  showRate: number;
  punctualityRate: number;
  roundsCompleted: number;
  roundsScheduled: number;
  minutesEarlyAvg: number;
  lastCalculatedAt: string;
  // Don't expose exact percentages - use buckets
  showRateBucket: 'excellent' | 'good' | 'fair' | 'building';
  punctualityBucket: 'excellent' | 'good' | 'fair' | 'building';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized', code: 'missing_auth' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

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

    // Parse userId from URL
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/');
    const targetUserId = pathParts[pathParts.length - 1];

    if (!targetUserId || targetUserId === 'trust-reliability') {
      return new Response(
        JSON.stringify({ error: 'User ID required', code: 'missing_user_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check tier visibility
    if (targetUserId !== user.id) {
      const { data: caller } = await supabase
        .from('users')
        .select('tier_id')
        .eq('id', user.id)
        .single();

      const { data: target } = await supabase
        .from('users')
        .select('tier_id')
        .eq('id', targetUserId)
        .single();

      if (caller?.tier_id !== target?.tier_id) {
        return new Response(
          JSON.stringify({ error: 'Access denied', code: 'tier_restricted' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Get reliability data
    const { data: reputation, error } = await supabase
      .from('user_reputation')
      .select('reliability_score, reliability_label, show_rate, punctuality_rate, rounds_completed, rounds_scheduled, minutes_early_avg, last_reliability_calc_at')
      .eq('user_id', targetUserId)
      .single();

    if (error && error.code !== 'PGRST116') {
      return new Response(
        JSON.stringify({ error: 'Failed to fetch reliability', code: 'fetch_failed' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Map to buckets (don't expose exact percentages)
    const toBucket = (rate: number): 'excellent' | 'good' | 'fair' | 'building' => {
      if (rate >= 95) return 'excellent';
      if (rate >= 80) return 'good';
      if (rate >= 60) return 'fair';
      return 'building';
    };

    const breakdown: ReliabilityBreakdown = {
      reliabilityScore: reputation?.reliability_score ?? 50,
      reliabilityLabel: reputation?.reliability_label ?? 'Building',
      showRate: reputation?.show_rate ?? 100,
      punctualityRate: reputation?.punctuality_rate ?? 100,
      roundsCompleted: reputation?.rounds_completed ?? 0,
      roundsScheduled: reputation?.rounds_scheduled ?? 0,
      minutesEarlyAvg: reputation?.minutes_early_avg ?? 0,
      lastCalculatedAt: reputation?.last_reliability_calc_at ?? new Date().toISOString(),
      showRateBucket: toBucket(reputation?.show_rate ?? 100),
      punctualityBucket: toBucket(reputation?.punctuality_rate ?? 100)
    };

    return new Response(
      JSON.stringify({ data: breakdown }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Trust reliability error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', code: 'internal_error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

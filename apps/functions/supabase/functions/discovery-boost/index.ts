// Discovery Boost Edge Function
// Calculate discovery visibility boost for a user
// Route: GET /discovery-boost/:userId

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import { corsHeaders } from '../_shared/cors.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface DiscoveryBoost {
  userId: string;
  baseVisibility: number;
  reliabilityBoost: number;
  badgeBoost: number;
  totalBoost: number; // multiplier (e.g., 1.5 = 50% boost)
  breakdown: {
    reliabilityScore: number;
    reliabilityTier: 'none' | 'low' | 'medium' | 'high' | 'max';
    badgeCount: number;
    badgeTier: 'none' | 'bronze' | 'silver' | 'gold';
  };
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

    if (!targetUserId || targetUserId === 'discovery-boost') {
      return new Response(
        JSON.stringify({ error: 'User ID required', code: 'missing_user_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Users can only check their own discovery boost
    if (targetUserId !== user.id) {
      return new Response(
        JSON.stringify({ error: 'Can only check own discovery boost', code: 'unauthorized' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get reliability data
    const { data: reputation } = await supabase
      .from('user_reputation')
      .select('reliability_score')
      .eq('user_id', targetUserId)
      .single();

    // Get badge count
    const { count: badgeCount } = await supabase
      .from('trust_badges')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', targetUserId)
      .eq('is_visible', true);

    const reliabilityScore = reputation?.reliability_score ?? 50;
    const badges = badgeCount || 0;

    // Calculate reliability boost: +30% for 95%+, +15% for 85%+, +5% for 75%+
    let reliabilityBoost = 0;
    let reliabilityTier: 'none' | 'low' | 'medium' | 'high' | 'max' = 'none';
    
    if (reliabilityScore >= 95) {
      reliabilityBoost = 0.30;
      reliabilityTier = 'max';
    } else if (reliabilityScore >= 85) {
      reliabilityBoost = 0.15;
      reliabilityTier = 'high';
    } else if (reliabilityScore >= 75) {
      reliabilityBoost = 0.05;
      reliabilityTier = 'medium';
    } else if (reliabilityScore >= 60) {
      reliabilityTier = 'low';
    }

    // Calculate badge boost: +20% for 3+ badges, +10% for 1+ badge
    let badgeBoost = 0;
    let badgeTier: 'none' | 'bronze' | 'silver' | 'gold' = 'none';
    
    if (badges >= 3) {
      badgeBoost = 0.20;
      badgeTier = 'gold';
    } else if (badges >= 1) {
      badgeBoost = 0.10;
      badgeTier = badges >= 2 ? 'silver' : 'bronze';
    }

    // Total boost (capped at 1.5x for now)
    const totalBoost = Math.min(1.50, 1.00 + reliabilityBoost + badgeBoost);

    const boost: DiscoveryBoost = {
      userId: targetUserId,
      baseVisibility: 100,
      reliabilityBoost,
      badgeBoost,
      totalBoost,
      breakdown: {
        reliabilityScore,
        reliabilityTier,
        badgeCount: badges,
        badgeTier
      }
    };

    return new Response(
      JSON.stringify({ data: boost }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Discovery boost error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', code: 'internal_error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

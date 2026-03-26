// User with Tier Edge Function
// Get current user with their tier information and computed features

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import { corsHeaders } from '../_shared/cors.ts';
import { TIER_SLUGS, getTierFeatures, TierFeatures } from '../_shared/tier-gate.ts';

// Initialize Supabase client
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

serve(async (req) => {
  // CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // Get auth header
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response(
      JSON.stringify({ error: 'Unauthorized' }),
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
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get user with tier info
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select(`
        id,
        email,
        display_name,
        avatar_url,
        tier_id,
        tier_enrolled_at,
        tier_expires_at,
        tier_status,
        monthly_rounds_count,
        monthly_intros_sent,
        intro_credits_remaining,
        intro_credits_reset_at,
        membership_tiers (
          id,
          name,
          slug,
          description,
          short_description,
          price_cents,
          billing_interval,
          features,
          badge_url,
          card_color
        )
      `)
      .eq('id', user.id)
      .single();

    if (userError) {
      return new Response(
        JSON.stringify({ error: userError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Extract tier info
    const tier = userData.membership_tiers || null;
    const tierFeatures = tier?.features as TierFeatures || getTierFeatures(TIER_SLUGS.FREE);

    // Check if tier is expired
    const now = new Date();
    const expiresAt = userData.tier_expires_at ? new Date(userData.tier_expires_at) : null;
    const isExpired = expiresAt ? expiresAt < now : false;

    // Build response
    const response = {
      user: {
        id: userData.id,
        email: userData.email,
        displayName: userData.display_name,
        avatarUrl: userData.avatar_url,
        tier: tier ? {
          id: tier.id,
          name: tier.name,
          slug: tier.slug,
          description: tier.description,
          shortDescription: tier.short_description,
          priceCents: tier.price_cents,
          billingInterval: tier.billing_interval,
          badgeUrl: tier.badge_url,
          cardColor: tier.card_color,
          features: tierFeatures
        } : null,
        tierStatus: {
          enrolledAt: userData.tier_enrolled_at,
          expiresAt: userData.tier_expires_at,
          status: userData.tier_status,
          isExpired,
          isActive: userData.tier_status === 'active' && !isExpired
        }
      },
      computed: {
        canCreateRounds: tierFeatures.canCreateRounds && userData.tier_status === 'active',
        canSendIntros: tierFeatures.canSendIntros && userData.tier_status === 'active',
        canReceiveIntros: tierFeatures.canReceiveIntros,
        monthlyRoundsCount: userData.monthly_rounds_count || 0,
        monthlyIntrosSent: userData.monthly_intros_sent || 0,
        introCreditsRemaining: userData.intro_credits_remaining || 0,
        introCreditsResetAt: userData.intro_credits_reset_at,
        maxConnections: tierFeatures.maxConnections,
        maxRoundsPerMonth: tierFeatures.maxRoundsPerMonth,
        introCreditsMonthly: tierFeatures.introCreditsMonthly,
        hasUnlimitedConnections: tierFeatures.maxConnections === null,
        hasUnlimitedRounds: tierFeatures.maxRoundsPerMonth === null,
        hasUnlimitedIntros: tierFeatures.introCreditsMonthly === null
      }
    };

    return new Response(
      JSON.stringify(response),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

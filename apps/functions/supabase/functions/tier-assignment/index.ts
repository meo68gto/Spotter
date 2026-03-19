// Tier Assignment Edge Function
// Handles tier assignment, upgrades, and Stripe webhooks

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import { corsHeaders } from '../_shared/cors.ts';
import {
  TIER_SLUGS,
  isValidTier,
  canUpgrade,
  getDefaultTier,
  TierSlug
} from '../_shared/tier-gate.ts';

interface RequestBody {
  action: 'assign-default' | 'upgrade' | 'stripe-webhook';
  userId?: string;
  targetTier?: TierSlug;
  stripeEvent?: any;
}

// Initialize Supabase client
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

serve(async (req) => {
  // CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const body: RequestBody = await req.json();

    switch (body.action) {
      case 'assign-default':
        return await assignDefaultTier(supabase, body.userId);

      case 'upgrade':
        return await upgradeTier(supabase, body.userId, body.targetTier);

      case 'stripe-webhook':
        return await handleStripeWebhook(supabase, body.stripeEvent);

      default:
        return new Response(
          JSON.stringify({ error: 'Invalid action' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
  } catch (error) {
    console.error('Tier assignment error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

/**
 * Assign FREE tier to a new user
 */
async function assignDefaultTier(supabase: any, userId: string | undefined) {
  if (!userId) {
    return new Response(
      JSON.stringify({ error: 'userId is required' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Get FREE tier ID
  const { data: tier, error: tierError } = await supabase
    .from('membership_tiers')
    .select('id')
    .eq('slug', TIER_SLUGS.FREE)
    .single();

  if (tierError || !tier) {
    return new Response(
      JSON.stringify({ error: 'FREE tier not found' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Assign tier to user
  const { error: updateError } = await supabase
    .from('users')
    .update({
      tier_id: tier.id,
      tier_enrolled_at: new Date().toISOString(),
      tier_status: 'active',
      tier_expires_at: null // FREE doesn't expire
    })
    .eq('id', userId);

  if (updateError) {
    return new Response(
      JSON.stringify({ error: updateError.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  return new Response(
    JSON.stringify({
      success: true,
      userId,
      tier: TIER_SLUGS.FREE,
      message: 'FREE tier assigned successfully'
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

/**
 * Upgrade user to a higher tier
 */
async function upgradeTier(
  supabase: any,
  userId: string | undefined,
  targetTier: TierSlug | undefined
) {
  if (!userId || !targetTier) {
    return new Response(
      JSON.stringify({ error: 'userId and targetTier are required' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  if (!isValidTier(targetTier)) {
    return new Response(
      JSON.stringify({ error: 'Invalid target tier' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Get current user tier
  const { data: user, error: userError } = await supabase
    .from('users')
    .select('tier_id, tier_status')
    .eq('id', userId)
    .single();

  if (userError || !user) {
    return new Response(
      JSON.stringify({ error: 'User not found' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Get current tier slug
  const { data: currentTier, error: currentTierError } = await supabase
    .from('membership_tiers')
    .select('slug')
    .eq('id', user.tier_id)
    .single();

  const currentTierSlug = currentTier?.slug || TIER_SLUGS.FREE;

  // Check if upgrade is allowed
  if (!canUpgrade(currentTierSlug, targetTier)) {
    return new Response(
      JSON.stringify({
        error: 'Cannot upgrade',
        currentTier: currentTierSlug,
        targetTier
      }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Get target tier ID and details
  const { data: targetTierData, error: targetTierError } = await supabase
    .from('membership_tiers')
    .select('id, billing_interval, price_cents')
    .eq('slug', targetTier)
    .single();

  if (targetTierError || !targetTierData) {
    return new Response(
      JSON.stringify({ error: 'Target tier not found' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Calculate expiration for non-lifetime tiers
  let expiresAt = null;
  if (targetTierData.billing_interval !== 'lifetime') {
    const now = new Date();
    expiresAt = targetTierData.billing_interval === 'annual'
      ? new Date(now.setFullYear(now.getFullYear() + 1)).toISOString()
      : new Date(now.setMonth(now.getMonth() + 1)).toISOString();
  }

  // Update user tier
  const { error: updateError } = await supabase
    .from('users')
    .update({
      tier_id: targetTierData.id,
      tier_enrolled_at: new Date().toISOString(),
      tier_expires_at: expiresAt,
      tier_status: 'active'
    })
    .eq('id', userId);

  if (updateError) {
    return new Response(
      JSON.stringify({ error: updateError.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  return new Response(
    JSON.stringify({
      success: true,
      userId,
      previousTier: currentTierSlug,
      newTier: targetTier,
      expiresAt,
      message: 'Tier upgraded successfully'
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

/**
 * Handle Stripe webhook for tier payments
 */
async function handleStripeWebhook(supabase: any, stripeEvent: any) {
  if (!stripeEvent) {
    return new Response(
      JSON.stringify({ error: 'stripeEvent is required' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const { type, data } = stripeEvent;

  switch (type) {
    case 'checkout.session.completed':
      return await handleCheckoutCompleted(supabase, data.object);

    case 'invoice.payment_succeeded':
      return await handleInvoicePayment(supabase, data.object);

    case 'invoice.payment_failed':
      return await handlePaymentFailed(supabase, data.object);

    case 'customer.subscription.deleted':
      return await handleSubscriptionCancelled(supabase, data.object);

    default:
      console.log(`Unhandled Stripe event type: ${type}`);
      return new Response(
        JSON.stringify({ received: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
  }
}

/**
 * Handle checkout session completed
 */
async function handleCheckoutCompleted(supabase: any, session: any) {
  const { customer, metadata, subscription, payment_intent } = session;
  const userId = metadata?.userId;
  const tierSlug = metadata?.tierSlug;

  if (!userId || !tierSlug) {
    console.error('Missing metadata in checkout session', session);
    return new Response(
      JSON.stringify({ error: 'Missing metadata' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Upgrade user tier
  const upgradeResponse = await upgradeTier(supabase, userId, tierSlug);

  // Log the checkout session
  await supabase.from('tier_history').insert({
    user_id: userId,
    new_tier_id: (await supabase.from('membership_tiers').select('id').eq('slug', tierSlug).single()).data.id,
    new_status: 'active',
    change_reason: 'stripe_checkout_completed',
    stripe_checkout_session_id: session.id,
    stripe_payment_intent_id: payment_intent,
    metadata: { subscription_id: subscription }
  });

  return upgradeResponse;
}

/**
 * Handle invoice payment succeeded
 */
async function handleInvoicePayment(supabase: any, invoice: any) {
  // Renewal - extend expiration
  const { subscription, customer } = invoice;
  // Implementation depends on your subscription tracking
  console.log('Invoice payment succeeded', invoice);
  return new Response(
    JSON.stringify({ received: true, action: 'renewal_processed' }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

/**
 * Handle invoice payment failed
 */
async function handlePaymentFailed(supabase: any, invoice: any) {
  const { customer } = invoice;
  // Mark tier as suspended or send notification
  console.log('Invoice payment failed', invoice);
  return new Response(
    JSON.stringify({ received: true, action: 'payment_failed_noted' }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

/**
 * Handle subscription cancelled
 */
async function handleSubscriptionCancelled(supabase: any, subscription: any) {
  const { customer, metadata } = subscription;
  const userId = metadata?.userId;

  if (userId) {
    // Revert to FREE tier
    await assignDefaultTier(supabase, userId);
  }

  return new Response(
    JSON.stringify({ received: true, action: 'reverted_to_free' }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

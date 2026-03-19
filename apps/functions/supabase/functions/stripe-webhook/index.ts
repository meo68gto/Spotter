// Stripe Webhook Edge Function
// Handles Stripe webhooks for payment processing

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import Stripe from 'https://esm.sh/stripe@13.11.0';
import { corsHeaders } from '../_shared/cors.ts';

// Initialize Stripe
const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2023-10-16',
  httpClient: Stripe.createFetchHttpClient(),
});

const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')!;

// Initialize Supabase client
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

serve(async (req) => {
  // CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // Only accept POST requests
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Get the raw body for signature verification
    const body = await req.text();
    const signature = req.headers.get('stripe-signature');

    if (!signature) {
      return new Response(
        JSON.stringify({ error: 'Missing Stripe signature' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify webhook signature
    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err) {
      console.error('Webhook signature verification failed:', err);
      return new Response(
        JSON.stringify({ error: 'Invalid signature' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Processing webhook: ${event.type}`);

    // Handle the event
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutSessionCompleted(supabase, event.data.object as Stripe.Checkout.Session);
        break;

      case 'invoice.payment_succeeded':
        await handleInvoicePaymentSucceeded(supabase, event.data.object as Stripe.Invoice);
        break;

      case 'invoice.payment_failed':
        await handleInvoicePaymentFailed(supabase, event.data.object as Stripe.Invoice);
        break;

      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(supabase, event.data.object as Stripe.Subscription);
        break;

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(supabase, event.data.object as Stripe.Subscription);
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return new Response(
      JSON.stringify({ received: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Webhook processing error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

/**
 * Handle checkout.session.completed
 * Called when checkout is successful
 */
async function handleCheckoutSessionCompleted(
  supabase: any,
  session: Stripe.Checkout.Session
): Promise<void> {
  const metadata = session.metadata || {};
  const type = metadata.type;

  switch (type) {
    case 'tier_upgrade':
      await processTierUpgrade(supabase, session);
      break;

    case 'event_registration':
      await processEventRegistration(supabase, session);
      break;

    case 'organizer_tier':
      await processOrganizerTierUpgrade(supabase, session);
      break;

    default:
      console.log(`Unknown checkout type: ${type}`);
  }
}

/**
 * Process tier upgrade after successful checkout
 */
async function processTierUpgrade(
  supabase: any,
  session: Stripe.Checkout.Session
): Promise<void> {
  const userId = session.metadata?.userId;
  const tierSlug = session.metadata?.tierSlug;
  const subscriptionId = session.subscription as string;

  if (!userId || !tierSlug) {
    console.error('Missing metadata in checkout session', session);
    return;
  }

  // Get target tier ID
  const { data: tier, error: tierError } = await supabase
    .from('membership_tiers')
    .select('id, billing_interval, price_cents')
    .eq('slug', tierSlug)
    .single();

  if (tierError || !tier) {
    console.error('Tier not found:', tierSlug);
    return;
  }

  // Calculate expiration
  let expiresAt = null;
  if (tier.billing_interval !== 'lifetime') {
    const interval = tier.billing_interval === 'annual' ? 'year' : 'month';
    expiresAt = new Date();
    if (interval === 'year') {
      expiresAt.setFullYear(expiresAt.getFullYear() + 1);
    } else {
      expiresAt.setMonth(expiresAt.getMonth() + 1);
    }
    expiresAt = expiresAt.toISOString();
  }

  // Get current user tier for history
  const { data: currentUser } = await supabase
    .from('users')
    .select('tier_id')
    .eq('id', userId)
    .single();

  // Update user tier
  const { error: updateError } = await supabase
    .from('users')
    .update({
      tier_id: tier.id,
      tier_status: 'active',
      tier_enrolled_at: new Date().toISOString(),
      tier_expires_at: expiresAt,
      stripe_subscription_id: subscriptionId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId);

  if (updateError) {
    console.error('Failed to update user tier:', updateError);
    return;
  }

  // Log tier history
  await supabase.from('tier_history').insert({
    user_id: userId,
    previous_tier_id: currentUser?.tier_id || null,
    new_tier_id: tier.id,
    change_reason: 'stripe_checkout_completed',
    new_status: 'active',
    stripe_checkout_session_id: session.id,
    stripe_payment_intent_id: session.payment_intent as string,
    stripe_subscription_id: subscriptionId,
    metadata: session.metadata,
    created_at: new Date().toISOString(),
  });

  console.log(`Tier upgraded for user ${userId} to ${tierSlug}`);
}

/**
 * Process event registration after successful payment
 */
async function processEventRegistration(
  supabase: any,
  session: Stripe.Checkout.Session
): Promise<void> {
  const userId = session.metadata?.userId;
  const eventId = session.metadata?.eventId;

  if (!userId || !eventId) {
    console.error('Missing metadata for event registration', session);
    return;
  }

  // Update registration status
  const { error: updateError } = await supabase
    .from('event_registrations')
    .update({
      status: 'confirmed',
      confirmed_at: new Date().toISOString(),
      stripe_payment_intent_id: session.payment_intent as string,
    })
    .eq('stripe_checkout_session_id', session.id);

  if (updateError) {
    console.error('Failed to update event registration:', updateError);
    return;
  }

  // Increment event registration count
  await supabase.rpc('increment_event_registration_count', {
    event_id: eventId,
  });

  console.log(`Event registration confirmed for user ${userId}, event ${eventId}`);
}

/**
 * Process organizer tier upgrade
 */
async function processOrganizerTierUpgrade(
  supabase: any,
  session: Stripe.Checkout.Session
): Promise<void> {
  const userId = session.metadata?.userId;
  const organizerTier = session.metadata?.organizerTier;
  const subscriptionId = session.subscription as string;

  if (!userId || !organizerTier) {
    console.error('Missing metadata for organizer tier', session);
    return;
  }

  // Update user as organizer with tier
  const { error: updateError } = await supabase
    .from('users')
    .update({
      is_organizer: true,
      organizer_tier: organizerTier,
      stripe_subscription_id: subscriptionId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId);

  if (updateError) {
    console.error('Failed to update organizer tier:', updateError);
    return;
  }

  console.log(`Organizer tier upgraded for user ${userId} to ${organizerTier}`);
}

/**
 * Handle invoice.payment_succeeded
 * Called for subscription renewals
 */
async function handleInvoicePaymentSucceeded(
  supabase: any,
  invoice: Stripe.Invoice
): Promise<void> {
  const subscriptionId = invoice.subscription as string;
  const customerId = invoice.customer as string;

  if (!subscriptionId) return;

  // Get subscription details
  const { data: subscription } = await supabase
    .from('users')
    .select('id, tier_id, tier_expires_at')
    .eq('stripe_subscription_id', subscriptionId)
    .single();

  if (!subscription) return;

  // Get tier for billing interval
  const { data: tier } = await supabase
    .from('membership_tiers')
    .select('billing_interval')
    .eq('id', subscription.tier_id)
    .single();

  if (!tier) return;

  // Extend expiration
  const currentExpiresAt = subscription.tier_expires_at
    ? new Date(subscription.tier_expires_at)
    : new Date();

  if (tier.billing_interval === 'annual') {
    currentExpiresAt.setFullYear(currentExpiresAt.getFullYear() + 1);
  } else {
    currentExpiresAt.setMonth(currentExpiresAt.getMonth() + 1);
  }

  await supabase
    .from('users')
    .update({
      tier_expires_at: currentExpiresAt.toISOString(),
      tier_status: 'active',
      updated_at: new Date().toISOString(),
    })
    .eq('id', subscription.id);

  console.log(`Subscription renewed for user ${subscription.id}`);
}

/**
 * Handle invoice.payment_failed
 * Called when subscription payment fails
 */
async function handleInvoicePaymentFailed(
  supabase: any,
  invoice: Stripe.Invoice
): Promise<void> {
  const subscriptionId = invoice.subscription as string;
  const customerId = invoice.customer as string;

  if (!subscriptionId) return;

  // Get user
  const { data: user } = await supabase
    .from('users')
    .select('id, email')
    .eq('stripe_subscription_id', subscriptionId)
    .single();

  if (!user) return;

  // Mark tier as payment_failed
  await supabase
    .from('users')
    .update({
      tier_status: 'payment_failed',
      updated_at: new Date().toISOString(),
    })
    .eq('id', user.id);

  // Log the failure
  await supabase.from('tier_history').insert({
    user_id: user.id,
    change_reason: 'stripe_payment_failed',
    new_status: 'payment_failed',
    stripe_invoice_id: invoice.id,
    metadata: { invoice },
    created_at: new Date().toISOString(),
  });

  console.log(`Payment failed for user ${user.id}`);
}

/**
 * Handle customer.subscription.updated
 * Called when subscription is updated (tier change, etc.)
 */
async function handleSubscriptionUpdated(
  supabase: any,
  subscription: Stripe.Subscription
): Promise<void> {
  const subscriptionId = subscription.id;
  const status = subscription.status;

  // Get user
  const { data: user } = await supabase
    .from('users')
    .select('id, tier_id')
    .eq('stripe_subscription_id', subscriptionId)
    .single();

  if (!user) return;

  // Handle different subscription statuses
  switch (status) {
    case 'active':
    case 'trialing':
      // Subscription is active - ensure tier status is active
      await supabase
        .from('users')
        .update({
          tier_status: 'active',
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);
      break;

    case 'past_due':
      // Payment is past due
      await supabase
        .from('users')
        .update({
          tier_status: 'past_due',
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);
      break;

    case 'canceled':
    case 'unpaid':
      // Will be handled by subscription.deleted event
      break;
  }

  console.log(`Subscription ${subscriptionId} updated with status ${status}`);
}

/**
 * Handle customer.subscription.deleted
 * Called when subscription is cancelled
 */
async function handleSubscriptionDeleted(
  supabase: any,
  subscription: Stripe.Subscription
): Promise<void> {
  const subscriptionId = subscription.id;

  // Get user
  const { data: user } = await supabase
    .from('users')
    .select('id, tier_id')
    .eq('stripe_subscription_id', subscriptionId)
    .single();

  if (!user) return;

  // Get free tier ID
  const { data: freeTier } = await supabase
    .from('membership_tiers')
    .select('id')
    .eq('slug', 'free')
    .single();

  if (!freeTier) {
    console.error('Free tier not found');
    return;
  }

  // Revert to free tier
  await supabase
    .from('users')
    .update({
      tier_id: freeTier.id,
      tier_status: 'active',
      tier_expires_at: null,
      stripe_subscription_id: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', user.id);

  // Log the cancellation
  await supabase.from('tier_history').insert({
    user_id: user.id,
    previous_tier_id: user.tier_id,
    new_tier_id: freeTier.id,
    change_reason: 'stripe_subscription_cancelled',
    new_status: 'active',
    stripe_subscription_id: subscriptionId,
    created_at: new Date().toISOString(),
  });

  console.log(`Subscription cancelled for user ${user.id}, reverted to free`);
}

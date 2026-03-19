// Stripe Checkout Edge Function
// Creates checkout sessions for tier upgrades and event registrations

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import Stripe from 'https://esm.sh/stripe@13.11.0';
import { corsHeaders } from '../_shared/cors.ts';
import { isValidTier, TierSlug } from '../_shared/tier-gate.ts';

// Initialize Stripe
const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2023-10-16',
  httpClient: Stripe.createFetchHttpClient(),
});

// Initialize Supabase client
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface CheckoutRequest {
  type: 'tier_upgrade' | 'event_registration' | 'organizer_tier';
  userId: string;
  // For tier upgrades
  targetTier?: TierSlug;
  billingInterval?: 'monthly' | 'yearly';
  // For event registration
  eventId?: string;
  // For organizer tiers
  organizerTier?: 'bronze' | 'silver' | 'gold';
  // Callback URL
  successUrl?: string;
  cancelUrl?: string;
}

serve(async (req) => {
  // CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const body: CheckoutRequest = await req.json();

    // Validate required fields
    if (!body.userId) {
      return new Response(
        JSON.stringify({ error: 'userId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get user details
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, email, stripe_customer_id')
      .eq('id', body.userId)
      .single();

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'User not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get or create Stripe customer
    let stripeCustomerId = user.stripe_customer_id;
    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { userId: user.id },
      });
      stripeCustomerId = customer.id;

      // Save customer ID to user record
      await supabase
        .from('users')
        .update({ stripe_customer_id: stripeCustomerId })
        .eq('id', user.id);
    }

    let session;

    switch (body.type) {
      case 'tier_upgrade':
        session = await createTierUpgradeSession(
          stripe,
          stripeCustomerId,
          user.id,
          body.targetTier!,
          body.billingInterval || 'monthly',
          body.successUrl,
          body.cancelUrl
        );
        break;

      case 'event_registration':
        session = await createEventRegistrationSession(
          stripe,
          supabase,
          stripeCustomerId,
          user.id,
          body.eventId!,
          body.successUrl,
          body.cancelUrl
        );
        break;

      case 'organizer_tier':
        session = await createOrganizerTierSession(
          stripe,
          stripeCustomerId,
          user.id,
          body.organizerTier!,
          body.billingInterval || 'monthly',
          body.successUrl,
          body.cancelUrl
        );
        break;

      default:
        return new Response(
          JSON.stringify({ error: 'Invalid checkout type' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

    return new Response(
      JSON.stringify({
        success: true,
        checkoutUrl: session.url,
        sessionId: session.id,
        type: body.type,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Stripe checkout error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

/**
 * Create checkout session for tier upgrade
 */
async function createTierUpgradeSession(
  stripe: Stripe,
  customerId: string,
  userId: string,
  targetTier: TierSlug,
  billingInterval: 'monthly' | 'yearly',
  successUrl?: string,
  cancelUrl?: string
): Promise<Stripe.Checkout.Session> {
  if (!isValidTier(targetTier)) {
    throw new Error('Invalid target tier');
  }

  if (targetTier === 'free') {
    throw new Error('Cannot checkout for free tier');
  }

  // Get tier price ID from environment or configuration
  const priceId = getTierPriceId(targetTier, billingInterval);

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    subscription_data: {
      metadata: {
        userId,
        tierSlug: targetTier,
        type: 'tier_upgrade',
      },
    },
    metadata: {
      userId,
      tierSlug: targetTier,
      type: 'tier_upgrade',
    },
    success_url: successUrl || `${Deno.env.get('APP_URL')}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: cancelUrl || `${Deno.env.get('APP_URL')}/checkout/cancel`,
    allow_promotion_codes: true,
    billing_address_collection: 'required',
  });

  return session;
}

/**
 * Create checkout session for event registration
 */
async function createEventRegistrationSession(
  stripe: Stripe,
  supabase: any,
  customerId: string,
  userId: string,
  eventId: string,
  successUrl?: string,
  cancelUrl?: string
): Promise<Stripe.Checkout.Session> {
  // Get event details
  const { data: event, error: eventError } = await supabase
    .from('events')
    .select('id, title, price_cents, is_paid')
    .eq('id', eventId)
    .single();

  if (eventError || !event) {
    throw new Error('Event not found');
  }

  if (!event.is_paid || event.price_cents === 0) {
    throw new Error('Event does not require payment');
  }

  // Create payment intent session for one-time payment
  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'payment',
    line_items: [
      {
        price_data: {
          currency: 'usd',
          unit_amount: event.price_cents,
          product_data: {
            name: `Event Registration: ${event.title}`,
          },
        },
        quantity: 1,
      },
    ],
    metadata: {
      userId,
      eventId,
      type: 'event_registration',
    },
    success_url: successUrl || `${Deno.env.get('APP_URL')}/events/registration/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: cancelUrl || `${Deno.env.get('APP_URL')}/events/registration/cancel`,
    billing_address_collection: 'required',
  });

  // Create pending registration record
  await supabase.from('event_registrations').insert({
    user_id: userId,
    event_id: eventId,
    status: 'pending_payment',
    stripe_checkout_session_id: session.id,
    registered_at: new Date().toISOString(),
  });

  return session;
}

/**
 * Create checkout session for organizer tier
 */
async function createOrganizerTierSession(
  stripe: Stripe,
  customerId: string,
  userId: string,
  organizerTier: 'bronze' | 'silver' | 'gold',
  billingInterval: 'monthly' | 'yearly',
  successUrl?: string,
  cancelUrl?: string
): Promise<Stripe.Checkout.Session> {
  const priceId = getOrganizerTierPriceId(organizerTier, billingInterval);

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    subscription_data: {
      metadata: {
        userId,
        organizerTier,
        type: 'organizer_tier',
      },
    },
    metadata: {
      userId,
      organizerTier,
      type: 'organizer_tier',
    },
    success_url: successUrl || `${Deno.env.get('APP_URL')}/organizer/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: cancelUrl || `${Deno.env.get('APP_URL')}/organizer/checkout/cancel`,
    allow_promotion_codes: true,
    billing_address_collection: 'required',
  });

  return session;
}

/**
 * Get Stripe price ID for tier
 */
function getTierPriceId(tier: TierSlug, interval: 'monthly' | 'yearly'): string {
  const envVar = interval === 'yearly'
    ? `STRIPE_PRICE_${tier.toUpperCase()}_YEARLY`
    : `STRIPE_PRICE_${tier.toUpperCase()}_MONTHLY`;

  const priceId = Deno.env.get(envVar);
  if (!priceId) {
    throw new Error(`Price ID not configured for ${tier} ${interval}`);
  }
  return priceId;
}

/**
 * Get Stripe price ID for organizer tier
 */
function getOrganizerTierPriceId(tier: 'bronze' | 'silver' | 'gold', interval: 'monthly' | 'yearly'): string {
  const envVar = interval === 'yearly'
    ? `STRIPE_ORGANIZER_${tier.toUpperCase()}_YEARLY`
    : `STRIPE_ORGANIZER_${tier.toUpperCase()}_MONTHLY`;

  const priceId = Deno.env.get(envVar);
  if (!priceId) {
    throw new Error(`Price ID not configured for organizer ${tier} ${interval}`);
  }
  return priceId;
}

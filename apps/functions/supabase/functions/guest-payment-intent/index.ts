// Guest Payment Intent Edge Function
// Creates Stripe PaymentIntents for unauthenticated guest checkout

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import Stripe from 'https://esm.sh/stripe@13.11.0';
import { corsHeaders } from '../_shared/cors.ts';

// Initialize Stripe
const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2023-10-16',
  httpClient: Stripe.createFetchHttpClient(),
});

// Initialize Supabase client
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface GuestPaymentRequest {
  guestSessionId: string;
  email: string;
  eventId: string;
  amountCents: number;
  currency: string;
}

interface GuestPaymentResponse {
  clientSecret: string;
  paymentIntentId: string;
  orderId: string;
}

serve(async (req) => {
  // CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // Only accept POST
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const body: GuestPaymentRequest = await req.json();

    // Validate required fields
    if (!body.guestSessionId || !body.email || !body.eventId) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: guestSessionId, email, eventId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!body.amountCents || body.amountCents <= 0) {
      return new Response(
        JSON.stringify({ error: 'Invalid amount' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify guest session exists and is valid
    const { data: guestSession, error: sessionError } = await supabase
      .from('guest_sessions')
      .select('id, email, verified, expires_at')
      .eq('id', body.guestSessionId)
      .single();

    if (sessionError || !guestSession) {
      return new Response(
        JSON.stringify({ error: 'Invalid guest session', code: 'invalid_session' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if session is expired
    if (new Date(guestSession.expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ error: 'Guest session expired', code: 'session_expired' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify email matches
    if (guestSession.email !== body.email) {
      return new Response(
        JSON.stringify({ error: 'Email mismatch', code: 'email_mismatch' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get event details
    const { data: event, error: eventError } = await supabase
      .from('sponsor_events')
      .select('id, title, price, currency, sponsor_id')
      .eq('id', body.eventId)
      .single();

    if (eventError || !event) {
      return new Response(
        JSON.stringify({ error: 'Event not found', code: 'event_not_found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify amount matches event price
    if (event.price * 100 !== body.amountCents) {
      return new Response(
        JSON.stringify({ error: 'Amount mismatch', code: 'amount_mismatch' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Stripe customer for guest
    const customer = await stripe.customers.create({
      email: body.email,
      metadata: {
        guest_session_id: body.guestSessionId,
        event_id: body.eventId,
      },
    });

    // Create PaymentIntent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: body.amountCents,
      currency: body.currency || 'usd',
      customer: customer.id,
      automatic_payment_methods: { enabled: true },
      metadata: {
        guest_session_id: body.guestSessionId,
        event_id: body.eventId,
        email: body.email,
      },
    });

    // Create guest order record
    const { data: order, error: orderError } = await supabase
      .from('guest_orders')
      .insert({
        guest_session_id: body.guestSessionId,
        event_id: body.eventId,
        amount_cents: body.amountCents,
        currency: body.currency || 'usd',
        stripe_payment_intent_id: paymentIntent.id,
        stripe_customer_id: customer.id,
        status: 'pending',
      })
      .select('id')
      .single();

    if (orderError || !order) {
      // Cancel the payment intent if order creation fails
      await stripe.paymentIntents.cancel(paymentIntent.id);
      return new Response(
        JSON.stringify({ error: 'Failed to create order', code: 'order_creation_failed' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const response: GuestPaymentResponse = {
      clientSecret: paymentIntent.client_secret!,
      paymentIntentId: paymentIntent.id,
      orderId: order.id,
    };

    return new Response(
      JSON.stringify({ data: response }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    console.error('Guest payment intent error:', err);
    return new Response(
      JSON.stringify({ 
        error: err instanceof Error ? err.message : 'Internal server error',
        code: 'internal_error'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

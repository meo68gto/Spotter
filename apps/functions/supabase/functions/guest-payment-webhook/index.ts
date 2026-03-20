// Guest Payment Webhook
// Handles Stripe webhook events for guest checkout payments

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import Stripe from 'https://esm.sh/stripe@13.11.0';

// Initialize Stripe
const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2023-10-16',
  httpClient: Stripe.createFetchHttpClient(),
});

// Initialize Supabase client
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')!;

serve(async (req) => {
  // Only accept POST
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Get the raw body
    const body = await req.text();
    const signature = req.headers.get('stripe-signature');

    if (!signature) {
      return new Response('Missing signature', { status: 400 });
    }

    // Verify webhook signature
    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err) {
      console.error('Webhook signature verification failed:', err);
      return new Response('Invalid signature', { status: 400 });
    }

    // Handle payment intent events
    if (event.type === 'payment_intent.succeeded') {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      
      // Check if this is a guest order
      const { data: order, error: orderError } = await supabase
        .from('guest_orders')
        .select('id, guest_session_id, event_id')
        .eq('stripe_payment_intent_id', paymentIntent.id)
        .single();

      if (orderError || !order) {
        // Not a guest order, ignore
        return new Response('OK', { status: 200 });
      }

      // Update order status
      await supabase
        .from('guest_orders')
        .update({ 
          status: 'paid',
          paid_at: new Date().toISOString()
        })
        .eq('id', order.id);

      // Create event registration
      const { data: guestSession } = await supabase
        .from('guest_sessions')
        .select('email, first_name, last_name, phone')
        .eq('id', order.guest_session_id)
        .single();

      if (guestSession) {
        await supabase
          .from('event_registrations')
          .insert({
            event_id: order.event_id,
            email: guestSession.email,
            first_name: guestSession.first_name,
            last_name: guestSession.last_name,
            phone: guestSession.phone,
            status: 'confirmed',
            payment_status: 'paid',
            guest_order_id: order.id,
          });

        // TODO: Send confirmation email
        console.log(`Guest registration confirmed for ${guestSession.email}`);
      }
    }

    if (event.type === 'payment_intent.payment_failed') {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      
      // Update guest order status
      await supabase
        .from('guest_orders')
        .update({ status: 'failed' })
        .eq('stripe_payment_intent_id', paymentIntent.id);
    }

    return new Response('OK', { status: 200 });

  } catch (err) {
    console.error('Webhook error:', err);
    return new Response('Internal error', { status: 500 });
  }
});

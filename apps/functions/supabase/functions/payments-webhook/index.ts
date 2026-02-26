// supabase/functions/payments-webhook/index.ts
import Stripe from 'https://esm.sh/stripe@17.7.0';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { createLogger } from '../_shared/telemetry.ts';
import { handleCors, ok, error } from '../_shared/http.ts';
import { getEnv } from '../_shared/env.ts';

Deno.serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const requestId = req.headers.get('x-request-id') ?? crypto.randomUUID();
  const log = createLogger('payments-webhook', requestId);

  const env = getEnv();
  const stripe = new Stripe(env.stripeSecretKey, { apiVersion: '2024-12-18.acacia' });

  // IMPORTANT: Read raw body BEFORE any JSON parsing.
  // stripe.webhooks.constructEvent requires the raw request body bytes
  // to verify the HMAC signature. Using req.json() first would consume
  // the body and make signature verification impossible.
  const rawBody = await req.text();
  const sig = req.headers.get('stripe-signature');

  if (!sig) {
    log.warn('Missing stripe-signature header');
    return error('Missing stripe-signature header', 400, 'missing_signature');
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, env.stripeWebhookSecret);
  } catch (err) {
    log.error('Stripe webhook signature verification failed', err);
    return error(
      `Webhook signature verification failed: ${err instanceof Error ? err.message : String(err)}`,
      400,
      'invalid_signature'
    );
  }

  log.info('webhook_received', { type: event.type, id: event.id });

  const supabase = createClient(env.supabaseUrl, env.serviceRoleKey, {
    auth: { persistSession: false },
  });

  try {
    switch (event.type) {
      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        log.info('payment_intent.succeeded', { id: paymentIntent.id });

        await supabase
          .from('payment_intents')
          .update({
            status: 'succeeded',
            updated_at: new Date().toISOString(),
          })
          .eq('stripe_payment_intent_id', paymentIntent.id);

        // Release any matching payment holds
        const { data: engagement } = await supabase
          .from('engagements')
          .select('id, user_id, expert_id')
          .eq('payment_intent_id', paymentIntent.id)
          .single();

        if (engagement) {
          await supabase
            .from('engagements')
            .update({
              payment_captured_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq('id', engagement.id);

          log.info('engagement_payment_captured', { engagementId: engagement.id });
        }
        break;
      }

      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        log.warn('payment_intent.payment_failed', {
          id: paymentIntent.id,
          lastError: paymentIntent.last_payment_error?.message,
        });

        await supabase
          .from('payment_intents')
          .update({
            status: 'failed',
            updated_at: new Date().toISOString(),
          })
          .eq('stripe_payment_intent_id', paymentIntent.id);
        break;
      }

      case 'payment_intent.canceled': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        log.info('payment_intent.canceled', { id: paymentIntent.id });

        await supabase
          .from('payment_intents')
          .update({
            status: 'canceled',
            updated_at: new Date().toISOString(),
          })
          .eq('stripe_payment_intent_id', paymentIntent.id);
        break;
      }

      case 'charge.refunded': {
        const charge = event.data.object as Stripe.Charge;
        log.info('charge.refunded', { id: charge.id, paymentIntentId: charge.payment_intent });

        await supabase
          .from('payment_intents')
          .update({
            status: 'refunded',
            updated_at: new Date().toISOString(),
          })
          .eq('stripe_payment_intent_id', charge.payment_intent);
        break;
      }

      case 'account.updated': {
        const account = event.data.object as Stripe.Account;
        log.info('account.updated', { id: account.id });

        const chargesEnabled = account.charges_enabled ?? false;
        const payoutsEnabled = account.payouts_enabled ?? false;

        await supabase
          .from('expert_profiles')
          .update({
            stripe_charges_enabled: chargesEnabled,
            stripe_payouts_enabled: payoutsEnabled,
            stripe_onboarding_complete: chargesEnabled && payoutsEnabled,
            updated_at: new Date().toISOString(),
          })
          .eq('stripe_account_id', account.id);
        break;
      }

      default:
        log.info('unhandled_event_type', { type: event.type });
    }

    return ok({ received: true, type: event.type });
  } catch (err) {
    log.error('webhook_handler_error', err, { type: event.type });
    return error(
      `Failed to process webhook event: ${err instanceof Error ? err.message : String(err)}`,
      500,
      'handler_error'
    );
  }
});

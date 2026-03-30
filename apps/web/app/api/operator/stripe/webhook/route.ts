import { NextRequest, NextResponse } from 'next/server';
import { constructWebhookEvent } from '@/lib/stripe';
import { createServerClient } from '@/lib/supabase/server';
import type Stripe from 'stripe';

// Disable body parsing for webhook signature verification
export const runtime = 'nodejs';

// --- Alerting helper ---
function sendWebhookAlert(message: string, details?: unknown): void {
  // Log to console in all environments
  console.error(`[WEBHOOK_ALERT] ${message}`, details ?? '');
  // In production, this should fire to a monitored channel:
  // - PagerDuty: send alert to on-call
  // - Slack: post to #alerts or #stripe-events channel
  // - Sentry: captureMessage with level 'critical'
  // Example (Slack webhook):
  // await fetch(process.env.SLACK_WEBHOOK_URL!, {
  //   method: 'POST',
  //   headers: { 'Content-Type': 'application/json' },
  //   body: JSON.stringify({ text: `[WEBHOOK_ALERT] ${message}` }),
  // });
}

export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = req.headers.get('stripe-signature');

  if (!signature) {
    return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = constructWebhookEvent(body, signature);
  } catch (err) {
    console.error('[webhook] Signature verification failed:', err);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  const supabase = createServerClient();

  // Idempotency check — skip if already processed
  const { data: existing } = await supabase
    .from('processed_stripe_events')
    .select('event_id')
    .eq('event_id', event.id)
    .maybeSingle();

  if (existing) {
    // Already processed — return 200 to prevent Stripe retrying
    return NextResponse.json({ received: true, skipped: true });
  }

  // Mark as processing before handling (prevent race on retries)
  const { error: insertError } = await supabase
    .from('processed_stripe_events')
    .insert({ event_id: event.id });

  if (insertError) {
    // If insert fails due to duplicate key (race), skip processing
    if (insertError.code === '23505') {
      return NextResponse.json({ received: true, skipped: true });
    }
    // Any other DB failure means we cannot safely process — return 500 so Stripe retries
    console.error('[webhook] Failed to insert idempotency record:', insertError);
    return NextResponse.json(
      { error: 'Database unavailable' },
      { status: 500 },
    );
  }

  // Handle different event types
  try {
    switch (event.type) {
      case 'account.updated': {
        const account = event.data.object as Stripe.Account;
        await handleAccountUpdated(supabase, account);
        break;
      }
      case 'payout.paid': {
        const payout = event.data.object as Stripe.Payout;
        await handlePayoutPaid(supabase, payout);
        break;
      }
      case 'payout.failed': {
        const payout = event.data.object as Stripe.Payout;
        await handlePayoutFailed(supabase, payout);
        break;
      }
      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        await handlePaymentIntentSucceeded(supabase, paymentIntent);
        break;
      }
      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        await handlePaymentIntentFailed(supabase, paymentIntent);
        break;
      }
      default:
        console.log(`[webhook] Unhandled event type: ${event.type}`);
    }
  } catch (handlerErr) {
    const errMsg = handlerErr instanceof Error ? handlerErr.message : String(handlerErr);
    console.error(`[webhook] Handler error for event ${event.type} (${event.id}):`, handlerErr);
    sendWebhookAlert(
      `Stripe webhook handler failed for event ${event.type} (${event.id}): ${errMsg}`,
      { eventType: event.type, eventId: event.id, error: errMsg },
    );
    await supabase
      .from('processed_stripe_events')
      .delete()
      .eq('event_id', event.id);
    // Return non-200 so Stripe will retry — do NOT acknowledge this event
    return NextResponse.json({ error: 'Handler failed' }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

async function handleAccountUpdated(
  supabase: ReturnType<typeof createServerClient>,
  account: Stripe.Account,
) {
  const { error } = await supabase
    .from('organizer_accounts')
    .update({
      stripe_onboarding_status: account.details_submitted ? 'completed' : 'pending',
    })
    .eq('stripe_account_id', account.id);

  if (error) {
    console.error('Failed to update organizer Stripe status:', error);
    throw error; // Propagate so webhook returns 500
  }
}

async function handlePayoutPaid(
  supabase: ReturnType<typeof createServerClient>,
  payout: Stripe.Payout,
) {
  if (!payout.id) return;

  const { error } = await supabase
    .from('payouts')
    .update({
      status: 'paid',
      processed_at: new Date().toISOString(),
      stripe_transfer_id: payout.id,
    })
    .eq('stripe_transfer_id', payout.id);

  if (error) {
    console.error('Failed to update payout status:', error);
    throw error;
  }
}

async function handlePayoutFailed(
  supabase: ReturnType<typeof createServerClient>,
  payout: Stripe.Payout,
) {
  if (!payout.id) return;

  const { error } = await supabase
    .from('payouts')
    .update({
      status: 'failed',
      processed_at: new Date().toISOString(),
    })
    .eq('stripe_transfer_id', payout.id);

  if (error) {
    console.error('Failed to update payout status to failed:', error);
    throw error;
  }
}

async function handlePaymentIntentSucceeded(
  supabase: ReturnType<typeof createServerClient>,
  paymentIntent: Stripe.PaymentIntent,
) {
  const tournamentId = paymentIntent.metadata?.tournamentId;
  const golferId = paymentIntent.metadata?.golferId;
  const organizerId = paymentIntent.metadata?.organizerId;

  if (!tournamentId || !golferId) {
    console.warn('[webhook] payment_intent.succeeded missing tournamentId or golferId in metadata:', paymentIntent.id);
    return;
  }

  // Security: verify the organizerId in metadata actually owns this tournament
  if (organizerId) {
    const { data: tournament } = await supabase
      .from('organizer_events')
      .select('id')
      .eq('id', tournamentId)
      .eq('organizer_id', organizerId)
      .maybeSingle();

    if (!tournament) {
      console.error('[webhook] payment_intent.succeeded: tournament does not belong to organizer in metadata:', {
        tournamentId,
        organizerId,
        paymentIntentId: paymentIntent.id,
      });
      throw new Error('Tournament ownership verification failed');
    }
  }

  const { error } = await supabase
    .from('organizer_event_registrations')
    .update({ payment_status: 'paid' })
    .eq('event_id', tournamentId)
    .eq('user_id', golferId);

  if (error) {
    console.error('Failed to update registration payment status:', error);
    throw error;
  }
}

async function handlePaymentIntentFailed(
  supabase: ReturnType<typeof createServerClient>,
  paymentIntent: Stripe.PaymentIntent,
) {
  const tournamentId = paymentIntent.metadata?.tournamentId;
  const golferId = paymentIntent.metadata?.golferId;

  if (tournamentId && golferId) {
    const { error } = await supabase
      .from('organizer_event_registrations')
      .update({ payment_status: 'pending' })
      .eq('event_id', tournamentId)
      .eq('user_id', golferId);

    if (error) {
      console.error('Failed to update registration payment status:', error);
      throw error;
    }
  }
}

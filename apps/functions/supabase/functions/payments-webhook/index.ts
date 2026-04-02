import { createServiceClient } from '../_shared/client.ts';
import { addEngagementStatusEvent } from '../_shared/coach-commerce.ts';
import { json } from '../_shared/http.ts';
import { sendTransactionalEmail } from '../_shared/notifications.ts';
import { verifyStripeWebhookSignature } from '../_shared/payments.ts';
import { getRuntimeEnv } from '../_shared/env.ts';
import { trackServerEvent } from '../_shared/telemetry.ts';

type StripeEvent = {
  id: string;
  type: string;
  data: {
    object: Record<string, unknown>;
  };
};

const resolveOrderByPaymentIntent = async (paymentIntentId: string) => {
  const service = createServiceClient();
  const { data } = await service
    .from('review_orders')
    .select('id, buyer_user_id, status')
    .eq('stripe_payment_intent_id', paymentIntentId)
    .maybeSingle();
  return data;
};

Deno.serve(async (req) => {
  const env = getRuntimeEnv();
  const rawBody = await req.text();
  const signature = req.headers.get('stripe-signature');

  const valid = await verifyStripeWebhookSignature(rawBody, signature, env.stripeWebhookSecret);
  if (!valid) {
    return json(401, { error: 'Invalid Stripe webhook signature', code: 'invalid_webhook_signature' });
  }

  const event = JSON.parse(rawBody) as StripeEvent;
  const service = createServiceClient();

  const { data: existingEvent } = await service
    .from('payment_events')
    .select('id')
    .eq('stripe_event_id', event.id)
    .maybeSingle();

  if (existingEvent) {
    return json(200, { received: true, deduped: true });
  }

  await service.from('payment_events').insert({
    stripe_event_id: event.id,
    event_type: event.type,
    payload: event as unknown as Record<string, unknown>
  });

  if (event.type === 'payment_intent.succeeded') {
    const paymentIntentId = String(event.data.object.id ?? '');
    const order = await resolveOrderByPaymentIntent(paymentIntentId);
    if (order) {
      const paidAt = new Date().toISOString();
      await service
        .from('review_orders')
        .update({ status: 'paid', paid_at: paidAt, payout_status: 'held' })
        .eq('id', order.id)
        .in('status', ['created', 'requires_payment_method', 'processing']);

      // Queue any associated engagement so it becomes visible in coach inbox immediately.
      const { data: engagement } = await service
        .from('engagement_requests')
        .select('id, status')
        .eq('review_order_id', order.id)
        .in('status', ['payment_pending', 'draft', 'created'])
        .maybeSingle();

      if (engagement) {
        await service
          .from('engagement_requests')
          .update({
            status: 'queued',
            paid_at: paidAt,
            accepted_deadline_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
          })
          .eq('id', engagement.id);

        await addEngagementStatusEvent({
          engagementRequestId: engagement.id,
          eventType: 'payment_succeeded',
          fromStatus: engagement.status,
          toStatus: 'queued',
          payload: { reviewOrderId: order.id, paymentIntentId }
        });
        
        await trackServerEvent('engagement_auto_published', order.buyer_user_id, {
          engagement_id: engagement.id,
          review_order_id: order.id,
          source: 'webhook'
        });
      }

      const userRecord = await service.auth.admin.getUserById(order.buyer_user_id);
      const email = userRecord.data.user?.email;
      if (email) {
        await sendTransactionalEmail({
          userId: order.buyer_user_id,
          to: email,
          subject: 'Spotter payment receipt',
          html: '<p>Your coach review payment is complete.</p>',
          eventType: 'payment_receipt',
          payload: { order_id: order.id, payment_intent_id: paymentIntentId }
        });
      }

      await trackServerEvent('payment_intent_succeeded', order.buyer_user_id, {
        review_order_id: order.id,
        payment_intent_id: paymentIntentId,
        engagement_published: !!engagement
      });
    }
  }

  if (event.type === 'payment_intent.payment_failed') {
    const paymentIntentId = String(event.data.object.id ?? '');
    await service
      .from('review_orders')
      .update({ status: 'failed' })
      .eq('stripe_payment_intent_id', paymentIntentId)
      .in('status', ['created', 'requires_payment_method', 'processing']);
    const order = await resolveOrderByPaymentIntent(paymentIntentId);
    if (order) {
      const { data: engagement } = await service
        .from('engagement_requests')
        .select('id, status')
        .eq('review_order_id', order.id)
        .maybeSingle();

      if (engagement) {
        await service
          .from('engagement_requests')
          .update({ status: 'payment_pending' })
          .eq('id', engagement.id)
          .in('status', ['payment_pending', 'draft', 'created']);

        await addEngagementStatusEvent({
          engagementRequestId: engagement.id,
          eventType: 'payment_failed',
          fromStatus: engagement.status,
          toStatus: 'payment_pending',
          payload: { reviewOrderId: order.id, paymentIntentId }
        });
      }

      await trackServerEvent('payment_intent_failed', order.buyer_user_id, {
        review_order_id: order.id,
        payment_intent_id: paymentIntentId
      });
    }
  }

  if (event.type === 'charge.refunded') {
    const paymentIntentId = String(event.data.object.payment_intent ?? '');
    const { data: order } = await service
      .from('review_orders')
      .select('id, buyer_user_id')
      .eq('stripe_payment_intent_id', paymentIntentId)
      .maybeSingle();

    if (order) {
      await service
        .from('review_orders')
        .update({ status: 'refunded', refunded_at: new Date().toISOString(), payout_status: 'reversed' })
        .eq('id', order.id);

      const { data: engagement } = await service
        .from('engagement_requests')
        .select('id, status')
        .eq('review_order_id', order.id)
        .maybeSingle();

      if (engagement) {
        await service
          .from('engagement_requests')
          .update({ status: 'refunded', closed_reason: 'charge_refunded' })
          .eq('id', engagement.id);

        await addEngagementStatusEvent({
          engagementRequestId: engagement.id,
          eventType: 'charge_refunded',
          fromStatus: engagement.status,
          toStatus: 'refunded',
          payload: { reviewOrderId: order.id, paymentIntentId }
        });
      }

      const userRecord = await service.auth.admin.getUserById(order.buyer_user_id);
      const email = userRecord.data.user?.email;
      if (email) {
        await sendTransactionalEmail({
          userId: order.buyer_user_id,
          to: email,
          subject: 'Spotter refund confirmation',
          html: '<p>Your refund has been processed.</p>',
          eventType: 'refund_confirmation',
          payload: { order_id: order.id, payment_intent_id: paymentIntentId }
        });
      }

      await trackServerEvent('refund_processed', order.buyer_user_id, {
        review_order_id: order.id,
        payment_intent_id: paymentIntentId
      });
    }
  }

  if (event.type === 'account.updated') {
    const accountId = String(event.data.object.id ?? '');
    const chargesEnabled = Boolean(event.data.object.charges_enabled);
    const detailsSubmitted = Boolean(event.data.object.details_submitted);

    await service
      .from('coaches')
      .update({
        onboarding_status: chargesEnabled && detailsSubmitted ? 'active' : 'pending'
      })
      .eq('stripe_account_id', accountId);
  }

  return json(200, { received: true, deduped: false });
});

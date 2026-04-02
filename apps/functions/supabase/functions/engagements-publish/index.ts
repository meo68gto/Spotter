import { createServiceClient } from '../_shared/client.ts';
import { transitionEngagementStatus } from '../_shared/coach-commerce.ts';
import { mapStripeIntentToOrderStatus } from '../_shared/engagements.ts';
import { parseJson, requireLegalConsent, requireUser } from '../_shared/guard.ts';
import { badRequest, json } from '../_shared/http.ts';
import { stripeRequest } from '../_shared/payments.ts';

type Payload = { engagementRequestId?: string; forcePublish?: boolean };

Deno.serve(async (req) => {
  const auth = await requireUser(req);
  if (auth instanceof Response) return auth;

  const legal = await requireLegalConsent(auth.user.id);
  if (legal) return legal;

  const body = await parseJson<Payload>(req);
  if (body instanceof Response) return body;
  if (!body.engagementRequestId) return badRequest('Missing engagementRequestId', 'missing_engagement_request_id');

  const service = createServiceClient();

  const { data: engagement, error: engagementError } = await service
    .from('engagement_requests')
    .select('id, requester_user_id, status, review_order_id')
    .eq('id', body.engagementRequestId)
    .eq('requester_user_id', auth.user.id)
    .maybeSingle();

  if (engagementError || !engagement) return badRequest('Engagement not found', 'engagement_not_found');

  if (!['draft', 'payment_pending', 'paid', 'queued'].includes(engagement.status)) {
    return json(200, { data: { id: engagement.id, status: engagement.status, alreadyPublished: true } });
  }

  if (engagement.review_order_id) {
    const { data: order } = await service
      .from('review_orders')
      .select('id, status, buyer_user_id, stripe_payment_intent_id')
      .eq('id', engagement.review_order_id)
      .eq('buyer_user_id', auth.user.id)
      .maybeSingle();

    if (!order) return badRequest('Order not found', 'order_not_found');

    // If order has a stripe_payment_intent_id, verify with Stripe before publishing
    if (order.stripe_payment_intent_id && !order.stripe_payment_intent_id.startsWith('pi_local_')) {
      try {
        const intent = await stripeRequest<{ status: string; id: string }>(
          `/payment_intents/${order.stripe_payment_intent_id}`,
          'GET'
        );
        const stripeStatus = mapStripeIntentToOrderStatus(intent.status);
        
        // Update order status if Stripe says it's paid but order isn't
        if (stripeStatus === 'paid' && order.status !== 'paid') {
          await service
            .from('review_orders')
            .update({ status: 'paid', paid_at: new Date().toISOString() })
            .eq('id', order.id);
        }
        
        if (stripeStatus !== 'paid') {
          return badRequest('Payment is not complete', 'payment_not_complete');
        }
      } catch (e) {
        // Stripe check failed, fallback to order status
        if (!['paid', 'processing'].includes(order.status)) {
          return badRequest('Order is not paid yet', 'order_not_paid');
        }
      }
    } else if (!['paid', 'processing'].includes(order.status)) {
      return badRequest('Order is not paid yet', 'order_not_paid');
    }
  }

  const data = await transitionEngagementStatus({
    engagementRequestId: engagement.id,
    toStatus: 'queued',
    actorUserId: auth.user.id,
    payload: { eventType: 'request_queued' },
    extraFields: { paid_at: new Date().toISOString() }
  });

  return json(200, { data: { id: data.id, status: data.status, paidAt: data.paid_at } });
});

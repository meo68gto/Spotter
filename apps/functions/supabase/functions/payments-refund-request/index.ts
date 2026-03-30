import { createServiceClient } from '../_shared/client.ts';
import { parseJson, requireUser } from '../_shared/guard.ts';
import { badRequest, json } from '../_shared/http.ts';
import { stripeRequest } from '../_shared/payments.ts';
import { rateLimitUser } from '../_shared/rate-limit.ts';

type Payload = {
  reviewOrderId?: string;
  reason?: string;
};

interface StripeRefund {
  id: string;
  status: string;
}

Deno.serve(async (req) => {
  const auth = await requireUser(req);
  if (auth instanceof Response) return auth;

  // Rate limiting: 10 refund requests per minute per user
  const { allowed, retryAfterSeconds } = await rateLimitUser(auth.user.id, 'payment_refund', 10, 60);
  if (!allowed) {
    return new Response(JSON.stringify({ error: 'Too many refund requests', code: 'refund_rate_limited', retryAfterSeconds }), {
      status: 429,
      headers: { 'Content-Type': 'application/json', 'Retry-After': String(retryAfterSeconds ?? 60) },
    });
  }

  const body = await parseJson<Payload>(req);
  if (body instanceof Response) return body;

  if (!body.reviewOrderId) {
    return badRequest('Missing reviewOrderId', 'missing_review_order_id');
  }

  const service = createServiceClient();
  const { data: order, error: orderErr } = await service
    .from('review_orders')
    .select('id, buyer_user_id, stripe_payment_intent_id, status')
    .eq('id', body.reviewOrderId)
    .eq('buyer_user_id', auth.user.id)
    .single();

  if (orderErr || !order) {
    return badRequest('Review order not found', 'review_order_not_found');
  }
  if (!order.stripe_payment_intent_id || order.status !== 'paid') {
    return badRequest('Only paid orders can be refunded', 'refund_not_allowed');
  }

  const { data: refundRequest, error: reqErr } = await service
    .from('refund_requests')
    .insert({
      review_order_id: order.id,
      requester_user_id: auth.user.id,
      reason: body.reason ?? null,
      status: 'pending'
    })
    .select('id')
    .single();

  if (reqErr || !refundRequest) {
    return json(500, { error: reqErr?.message ?? 'Refund request failed', code: 'refund_request_failed' });
  }

  try {
    const stripeRefund = await stripeRequest<StripeRefund>('/refunds', 'POST', {
      payment_intent: order.stripe_payment_intent_id,
      reason: 'requested_by_customer'
    });

    const resolvedAt = new Date().toISOString();
    await service
      .from('refund_requests')
      .update({ status: 'approved', stripe_refund_id: stripeRefund.id, resolved_at: resolvedAt })
      .eq('id', refundRequest.id);

    await service
      .from('review_orders')
      .update({ status: 'refunded', refunded_at: resolvedAt })
      .eq('id', order.id);

    return json(200, {
      data: {
        id: refundRequest.id,
        status: 'approved',
        stripeRefundId: stripeRefund.id
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Refund processing failed';
    await service
      .from('refund_requests')
      .update({ status: 'failed' })
      .eq('id', refundRequest.id);

    return json(500, { error: message, code: 'refund_processing_failed' });
  }
});

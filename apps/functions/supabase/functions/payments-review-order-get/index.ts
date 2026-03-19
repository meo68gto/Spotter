import { createServiceClient } from '../_shared/client.ts';
import { parseJson, requireUser } from '../_shared/guard.ts';
import { badRequest, json } from '../_shared/http.ts';

type Payload = {
  reviewOrderId?: string;
};

Deno.serve(async (req) => {
  const auth = await requireUser(req);
  if (auth instanceof Response) return auth;

  const body = await parseJson<Payload>(req);
  if (body instanceof Response) return body;

  if (!body.reviewOrderId) {
    return badRequest('Missing reviewOrderId', 'missing_review_order_id');
  }

  const service = createServiceClient();

  const { data: order, error } = await service
    .from('review_orders')
    .select('id, status, paid_at, refunded_at, amount_cents, currency, buyer_user_id')
    .eq('id', body.reviewOrderId)
    .eq('buyer_user_id', auth.user.id) // Ensure user owns this order
    .single();

  if (error || !order) {
    return json(404, { error: 'Order not found', code: 'order_not_found' });
  }

  return json(200, {
    data: {
      order: {
        id: order.id,
        status: order.status,
        paidAt: order.paid_at,
        refundedAt: order.refunded_at,
        amountCents: order.amount_cents,
        currency: order.currency
      }
    }
  });
});

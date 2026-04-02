import { createServiceClient } from '../_shared/client.ts';
import { parseJson, requireUser } from '../_shared/guard.ts';
import { badRequest, json } from '../_shared/http.ts';
import { rateLimitUser } from '../_shared/rate-limit.ts';

type Payload = {
  reviewOrderId?: string;
  status?: 'processing' | 'paid' | 'failed';
};

Deno.serve(async (req) => {
  const auth = await requireUser(req);
  if (auth instanceof Response) return auth;

  // Rate limiting: 10 confirm requests per minute per user
  const { allowed, retryAfterSeconds } = await rateLimitUser(auth.user.id, 'payment_confirm', 10, 60);
  if (!allowed) {
    return new Response(JSON.stringify({ error: 'Too many confirm requests', code: 'confirm_rate_limited', retryAfterSeconds }), {
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
  const { data, error } = await service
    .from('review_orders')
    .select('id, status, paid_at, refunded_at')
    .eq('id', body.reviewOrderId)
    .eq('buyer_user_id', auth.user.id)
    .single();

  if (error || !data) {
    return json(404, { error: error?.message ?? 'Review order not found', code: 'review_order_not_found' });
  }

  return json(409, {
    error: 'Client-side order confirmation has been retired. Use webhook-driven status checks via payments-review-order-get.',
    code: 'payment_confirm_retired',
    details: { reviewOrderId: data.id, currentStatus: data.status }
  });
});

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

  if (!body.reviewOrderId || !body.status) {
    return badRequest('Missing required fields', 'missing_required_fields');
  }

  const service = createServiceClient();
  const { data, error } = await service
    .from('review_orders')
    .update({
      status: body.status,
      paid_at: body.status === 'paid' ? new Date().toISOString() : null
    })
    .eq('id', body.reviewOrderId)
    .eq('buyer_user_id', auth.user.id)
    .select('id, status, paid_at, refunded_at')
    .single();

  if (error) {
    return json(500, { error: error.message, code: 'review_order_confirm_failed' });
  }

  return json(200, { data });
});

import { createServiceClient } from '../_shared/client.ts';
import { capturePaymentIntent } from '../_shared/engagements.ts';
import { getRuntimeEnv } from '../_shared/env.ts';
import { forbidden, json } from '../_shared/http.ts';

Deno.serve(async (req) => {
  const adminToken = req.headers.get('x-admin-token');
  const env = getRuntimeEnv();
  if (!env.adminDeletionToken || adminToken !== env.adminDeletionToken) {
    return forbidden('Invalid admin token', 'invalid_admin_token');
  }

  const service = createServiceClient();
  const { data: rows, error } = await service
    .from('engagement_requests')
    .select('id, review_order_id, status, engagement_mode')
    .eq('engagement_mode', 'video_call')
    .eq('status', 'completed')
    .limit(200);

  if (error) return json(500, { error: error.message, code: 'call_billing_query_failed' });

  let billed = 0;
  for (const row of rows ?? []) {
    if (!row.review_order_id) continue;
    const { data: order } = await service.from('review_orders').select('id, status, stripe_payment_intent_id').eq('id', row.review_order_id).maybeSingle();
    if (!order || order.status === 'paid' || !order.stripe_payment_intent_id) continue;

    try {
      await capturePaymentIntent(order.stripe_payment_intent_id);
      await service.from('review_orders').update({ status: 'paid', paid_at: new Date().toISOString() }).eq('id', order.id);
      billed += 1;
    } catch {
      await service.from('review_orders').update({ status: 'failed' }).eq('id', order.id);
    }
  }

  return json(200, { data: { billed } });
});

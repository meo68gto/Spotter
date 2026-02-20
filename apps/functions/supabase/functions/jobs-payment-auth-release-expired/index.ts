import { createServiceClient } from '../_shared/client.ts';
import { cancelPaymentIntent } from '../_shared/engagements.ts';
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
    .from('review_orders')
    .select('id, stripe_payment_intent_id')
    .in('status', ['created', 'requires_payment_method', 'processing'])
    .lte('authorization_expires_at', new Date().toISOString())
    .limit(200);

  if (error) return json(500, { error: error.message, code: 'auth_release_query_failed' });

  let released = 0;
  for (const row of rows ?? []) {
    try {
      if (row.stripe_payment_intent_id) {
        await cancelPaymentIntent(row.stripe_payment_intent_id);
      }
      await service
        .from('review_orders')
        .update({ status: 'cancelled', authorization_released_at: new Date().toISOString() })
        .eq('id', row.id);
      released += 1;
    } catch {
      // continue
    }
  }

  return json(200, { data: { released } });
});

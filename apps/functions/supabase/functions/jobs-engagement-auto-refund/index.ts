import { createServiceClient } from '../_shared/client.ts';
import { refundOrderWithTransferReversal } from '../_shared/coach-commerce.ts';
import { json } from '../_shared/http.ts';

Deno.serve(async () => {
  const service = createServiceClient();
  const { data: rows } = await service
    .from('engagement_requests')
    .select('id, review_order_id, status')
    .in('status', ['expired', 'refund_pending'])
    .not('review_order_id', 'is', null)
    .limit(100);

  let refundedCount = 0;
  for (const row of rows ?? []) {
    if (!row.review_order_id) continue;
    await refundOrderWithTransferReversal({
      reviewOrderId: row.review_order_id,
      reason: row.status === 'expired' ? 'acceptance_sla_expired' : 'auto_refund',
      requestStatus: 'refunded'
    });
    refundedCount += 1;
  }

  return json(200, { data: { refundedCount } });
});

import { createServiceClient } from '../_shared/client.ts';
import { addEngagementStatusEvent } from '../_shared/coach-commerce.ts';
import { json } from '../_shared/http.ts';

Deno.serve(async () => {
  const service = createServiceClient();
  const now = new Date().toISOString();
  const { data: rows } = await service
    .from('engagement_requests')
    .select('id, status')
    .in('status', ['queued', 'paid'])
    .lt('accepted_deadline_at', now)
    .limit(100);

  for (const row of rows ?? []) {
    await service
      .from('engagement_requests')
      .update({ status: 'expired', closed_reason: 'coach_acceptance_sla_expired' })
      .eq('id', row.id);

    await addEngagementStatusEvent({
      engagementRequestId: row.id,
      eventType: 'acceptance_sla_expired',
      fromStatus: row.status,
      toStatus: 'expired'
    });
  }

  return json(200, { data: { expiredCount: rows?.length ?? 0 } });
});

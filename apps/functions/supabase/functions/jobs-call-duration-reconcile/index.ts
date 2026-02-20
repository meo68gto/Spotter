import { createServiceClient } from '../_shared/client.ts';
import { billableMinutesFromSeconds } from '../_shared/engagement-utils.ts';
import { getRuntimeEnv } from '../_shared/env.ts';
import { forbidden, json } from '../_shared/http.ts';

Deno.serve(async (req) => {
  const env = getRuntimeEnv();
  const adminToken = req.headers.get('x-admin-token');
  if (!env.adminDeletionToken || adminToken !== env.adminDeletionToken) {
    return forbidden('Invalid admin token', 'invalid_admin_token');
  }

  const service = createServiceClient();
  const staleCutoff = new Date(Date.now() - 30 * 60 * 1000).toISOString();

  const { data: rows, error } = await service
    .from('video_call_sessions')
    .select('id, started_at, ended_at, duration_seconds')
    .or('duration_seconds.is.null,billable_minutes.is.null')
    .lte('created_at', staleCutoff)
    .limit(300);

  if (error) return json(500, { error: error.message, code: 'call_duration_reconcile_query_failed' });

  let reconciled = 0;
  for (const row of rows ?? []) {
    const endedAt = row.ended_at ?? new Date().toISOString();
    const durationSeconds =
      row.duration_seconds ?? Math.max(0, Math.floor((new Date(endedAt).getTime() - new Date(row.started_at ?? endedAt).getTime()) / 1000));
    const billableMinutes = billableMinutesFromSeconds(durationSeconds);

    await service
      .from('video_call_sessions')
      .update({ ended_at: endedAt, duration_seconds: durationSeconds, billable_minutes: billableMinutes })
      .eq('id', row.id);
    reconciled += 1;
  }

  return json(200, { data: { reconciled } });
});

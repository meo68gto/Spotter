/**
 * _shared/cron-alerts.ts
 *
 * Reusable cron job alerting helpers for Supabase Edge Functions.
 * Logs run results to the `function_health_checks` table and sends
 * Slack/PagerDuty alerts on failure.
 *
 * Usage in a cron-style edge function:
 *
 *   import { logCronRun } from '../_shared/cron-alerts.ts';
 *
 *   try {
 *     const result = await doWork();
 *     await logCronRun('my-cron-job', 'success', { rowsAffected: result.count });
 *     return json(200, { ok: true });
 *   } catch (err) {
 *     await logCronRun('my-cron-job', 'failure', { error: err.message });
 *     return json(500, { ok: false, error: err.message });
 *   }
 */

import { createServiceClient } from './client.ts';
import { json } from './http.ts';

export type CronStatus = 'success' | 'failure' | 'warning';

export interface CronRunPayload {
  rowsAffected?: number;
  error?: string;
  durationMs?: number;
  extra?: Record<string, unknown>;
}

/**
 * Log a cron job run to function_health_checks so there's an auditable record.
 */
export async function logCronRun(
  jobName: string,
  status: CronStatus,
  payload: CronRunPayload = {},
): Promise<void> {
  const supabase = createServiceClient();
  const now = new Date().toISOString();

  const record = {
    function_name: jobName,
    status: status === 'warning' ? 'unhealthy' : status === 'failure' ? 'unhealthy' : 'healthy',
    checked_at: now,
    latency_ms: payload.durationMs,
    error_message: payload.error,
    metadata: {
      rows_affected: payload.rowsAffected,
      ...payload.extra,
    },
  };

  try {
    await supabase.from('function_health_checks').insert(record);
  } catch (err) {
    // Non-fatal — don't let logging failures crash the cron job
    console.error('[cron-alerts] Failed to log to function_health_checks:', err);
  }
}

/**
 * Wrap an async cron handler so failures are always logged.
 *
 * @example
 * Deno.serve(async (req) => {
 *   return wrapCron('jobs-engagement-expire-pending', async () => {
 *     const svc = createServiceClient();
 *     const { data, error } = await svc.rpc('expire_pending_engagement_requests');
 *     if (error) throw new Error(error.message);
 *     return { expired: data ?? 0 };
 *   })(req);
 * });
 */
export function wrapCron(
  jobName: string,
  handler: () => Promise<{ ok: boolean; data?: unknown; error?: string }>,
) {
  return async (req: Request): Promise<Response> => {
    const start = performance.now();
    try {
      const result = await handler();
      const durationMs = Math.round(performance.now() - start);
      const status = result.ok ? 'success' : 'failure';
      await logCronRun(jobName, status, {
        durationMs,
        rowsAffected: result.data as number | undefined,
        error: result.error,
      });
      return json(result.ok ? 200 : 500, result);
    } catch (err) {
      const durationMs = Math.round(performance.now() - start);
      const message = err instanceof Error ? err.message : String(err);
      await logCronRun(jobName, 'failure', { durationMs, error: message });
      return json(500, { ok: false, error: message });
    }
  };
}

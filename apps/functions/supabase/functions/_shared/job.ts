// _shared/job.ts
import { createLogger } from './telemetry.ts';

export async function runJob(
  jobName: string,
  handler: () => Promise<{ processed: number; errors: string[] }>
): Promise<Response> {
  const requestId = crypto.randomUUID();
  const log = createLogger(jobName, requestId);
  const start = Date.now();
  log.info('job_start');

  try {
    const result = await handler();
    log.info('job_complete', { ...result, durationMs: Date.now() - start });
    return new Response(JSON.stringify({ ok: true, ...result }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    log.error('job_failed', err);
    return new Response(JSON.stringify({ ok: false, error: String(err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

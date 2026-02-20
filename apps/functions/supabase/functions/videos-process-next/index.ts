import { forbidden, json } from '../_shared/http.ts';
import { createServiceClient } from '../_shared/client.ts';

const workerToken = Deno.env.get('VIDEO_WORKER_TOKEN') ?? '';
const backoffScheduleSeconds = [15, 60, 300];

Deno.serve(async (req) => {
  const token = req.headers.get('x-worker-token') ?? '';
  if (!workerToken || token !== workerToken) {
    return forbidden('Invalid worker token', 'invalid_worker_token');
  }

  const supabase = createServiceClient();
  const mode = (await req.json().catch(() => ({}))) as {
    mode?: 'simulate_success' | 'simulate_failure';
    errorCode?: string;
  };
  const nowIso = new Date().toISOString();

  const { data: jobs, error: jobsError } = await supabase
    .from('video_processing_jobs')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(20);

  if (jobsError) return json(500, { error: jobsError.message, code: 'video_job_query_failed' });
  if (!jobs?.length) return json(200, { processed: false, reason: 'no_pending_jobs' });

  const nowMs = Date.now();
  const readyJobs = jobs.filter((item) => !item.next_run_at || new Date(item.next_run_at).getTime() <= nowMs);
  if (!readyJobs.length) return json(200, { processed: false, reason: 'no_ready_jobs' });

  const job = readyJobs[0];

  const nextAttempts = (job.attempts ?? 0) + 1;
  await supabase
    .from('video_processing_jobs')
    .update({
      status: 'processing',
      started_at: nowIso,
      attempts: nextAttempts,
      next_run_at: null
    })
    .eq('id', job.id);

  await supabase.from('video_submissions').update({ status: 'processing' }).eq('id', job.video_submission_id);

  const isSuccess = mode.mode !== 'simulate_failure';

  if (isSuccess) {
    const aiAnalysis = {
      provider: 'manual',
      summary: 'Simulated queue analysis complete',
      metrics: [
        { key: 'balance', label: 'Balance', value: 62 },
        { key: 'control', label: 'Control', value: 58 }
      ],
      annotations: [{ tsMs: 1200, note: 'Keep knees flexed through turn.' }]
    };

    await supabase
      .from('video_submissions')
      .update({ status: 'analyzed', ai_analysis: aiAnalysis })
      .eq('id', job.video_submission_id);

    await supabase
      .from('video_processing_jobs')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        last_error: null,
        last_error_code: null,
        last_error_at: null
      })
      .eq('id', job.id);

    return json(200, { processed: true, status: 'completed', job_id: job.id, video_submission_id: job.video_submission_id });
  }

  const maxAttempts = job.max_attempts ?? 3;
  const failed = nextAttempts >= maxAttempts;
  const delaySeconds = backoffScheduleSeconds[Math.min(nextAttempts - 1, backoffScheduleSeconds.length - 1)];
  const nextRunAt = new Date(Date.now() + delaySeconds * 1000).toISOString();
  const lastErrorCode = mode.errorCode ?? 'simulated_processing_failure';
  const lastError = `Simulated processing failure (attempt ${nextAttempts}/${maxAttempts})`;

  await supabase
    .from('video_processing_jobs')
    .update({
      status: failed ? 'failed' : 'pending',
      next_run_at: failed ? null : nextRunAt,
      last_error: lastError,
      last_error_code: lastErrorCode,
      last_error_at: new Date().toISOString(),
      completed_at: failed ? new Date().toISOString() : null
    })
    .eq('id', job.id);

  await supabase
    .from('video_submissions')
    .update({ status: failed ? 'failed' : 'uploaded' })
    .eq('id', job.video_submission_id);

  return json(200, {
    processed: true,
    status: failed ? 'failed' : 'requeued',
    attempts: nextAttempts,
    max_attempts: maxAttempts,
    next_run_at: failed ? null : nextRunAt,
    last_error_code: lastErrorCode,
    job_id: job.id,
    video_submission_id: job.video_submission_id
  });
});

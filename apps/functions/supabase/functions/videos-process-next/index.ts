import { forbidden, json } from '../_shared/http.ts';
import { createServiceClient } from '../_shared/client.ts';

const workerToken = Deno.env.get('VIDEO_WORKER_TOKEN') ?? '';

Deno.serve(async (req) => {
  const token = req.headers.get('x-worker-token') ?? '';
  if (!workerToken || token !== workerToken) {
    return forbidden('Invalid worker token', 'invalid_worker_token');
  }

  const supabase = createServiceClient();
  const mode = (await req.json().catch(() => ({}))) as { mode?: 'simulate_success' | 'simulate_failure' };

  const { data: jobs, error: jobsError } = await supabase
    .from('video_processing_jobs')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(1);

  if (jobsError) return json(500, { error: jobsError.message, code: 'video_job_query_failed' });
  if (!jobs?.length) return json(200, { processed: false, reason: 'no_pending_jobs' });

  const job = jobs[0];

  await supabase
    .from('video_processing_jobs')
    .update({ status: 'processing', started_at: new Date().toISOString(), attempts: (job.attempts ?? 0) + 1 })
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
      .update({ status: 'completed', completed_at: new Date().toISOString(), last_error: null })
      .eq('id', job.id);

    return json(200, { processed: true, status: 'completed', job_id: job.id, video_submission_id: job.video_submission_id });
  }

  const failed = (job.attempts ?? 0) + 1 >= (job.max_attempts ?? 3);
  await supabase
    .from('video_processing_jobs')
    .update({
      status: failed ? 'failed' : 'pending',
      last_error: 'Simulated processing failure',
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
    job_id: job.id,
    video_submission_id: job.video_submission_id
  });
});

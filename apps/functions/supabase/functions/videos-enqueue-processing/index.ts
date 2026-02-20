import { badRequest, json, unauthorized } from '../_shared/http.ts';
import { createAuthedClient, createServiceClient } from '../_shared/client.ts';

Deno.serve(async (req) => {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return unauthorized('Missing Authorization header', 'missing_auth_header');

  const { videoSubmissionId } = (await req.json()) as { videoSubmissionId?: string };
  if (!videoSubmissionId) return badRequest('Missing videoSubmissionId', 'missing_video_submission_id');

  const authed = createAuthedClient(authHeader);
  const service = createServiceClient();
  const { data: authData, error: authError } = await authed.auth.getUser();
  const user = authData.user;
  if (authError || !user) return unauthorized();

  const { data: submission, error: submissionError } = await service
    .from('video_submissions')
    .select('id, user_id, status')
    .eq('id', videoSubmissionId)
    .single();

  if (submissionError || !submission) {
    return badRequest('Video submission not found', 'video_submission_not_found');
  }
  if (submission.user_id !== user.id) {
    return badRequest('Not owner of submission', 'not_submission_owner');
  }
  if (submission.status !== 'uploaded' && submission.status !== 'failed') {
    return badRequest('Submission not in queueable state', 'invalid_submission_state');
  }

  const { data, error } = await service
    .from('video_processing_jobs')
    .upsert(
      {
        video_submission_id: videoSubmissionId,
        status: 'pending',
        last_error: null
      },
      { onConflict: 'video_submission_id' }
    )
    .select('*')
    .single();

  if (error) return json(500, { error: error.message, code: 'video_enqueue_failed' });

  return json(200, { data });
});

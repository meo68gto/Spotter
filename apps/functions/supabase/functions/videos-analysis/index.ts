import { badRequest, json, unauthorized } from '../_shared/http.ts';
import { createAuthedClient } from '../_shared/client.ts';

interface AnalysisMetric {
  key: string;
  label: string;
  value: number;
  unit?: string;
}

interface Payload {
  videoSubmissionId?: string;
  provider?: 'openai-vision' | 'replicate' | 'manual';
  summary?: string;
  metrics?: AnalysisMetric[];
  annotations?: Array<{ tsMs: number; note: string }>;
}

Deno.serve(async (req) => {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return unauthorized('Missing Authorization header', 'missing_auth_header');

  const body = (await req.json()) as Payload;
  if (!body.videoSubmissionId || !body.provider || !body.summary || !body.metrics) {
    return badRequest('Missing required fields', 'missing_required_fields');
  }

  if (!Array.isArray(body.metrics) || body.metrics.some((m) => !m.key || typeof m.value !== 'number')) {
    return badRequest('Invalid metrics payload', 'invalid_metrics_payload');
  }

  const supabase = createAuthedClient(authHeader);
  const { data: authData, error: authError } = await supabase.auth.getUser();
  const user = authData.user;
  if (authError || !user) return unauthorized();

  const { data: submission, error: subError } = await supabase
    .from('video_submissions')
    .select('id, user_id')
    .eq('id', body.videoSubmissionId)
    .single();

  if (subError || !submission) return badRequest('Video submission not found', 'video_submission_not_found');
  if (submission.user_id !== user.id) return badRequest('Not owner of submission', 'not_submission_owner');

  const aiAnalysis = {
    provider: body.provider,
    summary: body.summary,
    metrics: body.metrics,
    annotations: body.annotations ?? []
  };

  const { data, error } = await supabase
    .from('video_submissions')
    .update({ status: 'analyzed', ai_analysis: aiAnalysis })
    .eq('id', body.videoSubmissionId)
    .select('id, status, ai_analysis, updated_at')
    .single();

  if (error) return json(500, { error: error.message, code: 'analysis_update_failed' });
  return json(200, { data });
});

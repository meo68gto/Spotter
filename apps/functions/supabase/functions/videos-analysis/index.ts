import { badRequest, json, unauthorized } from '../_shared/http.ts';
import { createAuthedClient } from '../_shared/client.ts';
import { trackServerEvent } from '../_shared/telemetry.ts';

interface AnalysisMetric {
  key: string;
  label?: string;
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

const allowedProviders = new Set(['openai-vision', 'replicate', 'manual']);

Deno.serve(async (req) => {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return unauthorized('Missing Authorization header', 'missing_auth_header');

  const body = (await req.json()) as Payload;
  const videoSubmissionId = body.videoSubmissionId ?? new URL(req.url).searchParams.get('videoSubmissionId') ?? '';

  if (!videoSubmissionId || !body.provider || !body.summary || !body.metrics) {
    return badRequest('Missing required fields', 'missing_required_fields');
  }
  if (!allowedProviders.has(body.provider)) {
    return badRequest('Invalid provider', 'invalid_provider');
  }
  if (body.summary.trim().length < 3 || body.summary.trim().length > 1000) {
    return badRequest('Summary length must be between 3 and 1000 characters', 'invalid_summary_length');
  }

  if (
    !Array.isArray(body.metrics) ||
    body.metrics.length === 0 ||
    body.metrics.length > 30 ||
    body.metrics.some(
      (m) =>
        !m.key ||
        typeof m.value !== 'number' ||
        Number.isNaN(m.value) ||
        m.key.length > 64 ||
        (m.label ? m.label.length > 120 : false)
    )
  ) {
    return badRequest('Invalid metrics payload', 'invalid_metrics_payload');
  }
  if (
    body.annotations &&
    (!Array.isArray(body.annotations) ||
      body.annotations.length > 100 ||
      body.annotations.some(
        (a) => typeof a.tsMs !== 'number' || Number.isNaN(a.tsMs) || !a.note?.trim() || a.note.length > 500
      ))
  ) {
    return badRequest('Invalid annotations payload', 'invalid_annotations_payload');
  }

  const supabase = createAuthedClient(authHeader);
  const { data: authData, error: authError } = await supabase.auth.getUser();
  const user = authData.user;
  if (authError || !user) return unauthorized();

  const { data: submission, error: subError } = await supabase
    .from('video_submissions')
    .select('id, user_id')
    .eq('id', videoSubmissionId)
    .single();

  if (subError || !submission) return badRequest('Video submission not found', 'video_submission_not_found');
  if (submission.user_id !== user.id) return badRequest('Not owner of submission', 'not_submission_owner');

  const sanitizedMetrics = body.metrics
    .map((metric) => ({
      key: metric.key.trim().toLowerCase(),
      label: metric.label?.trim() || metric.key.trim(),
      value: Number(metric.value.toFixed(3)),
      unit: metric.unit?.trim() || undefined
    }))
    .sort((a, b) => a.key.localeCompare(b.key));

  const sanitizedAnnotations = (body.annotations ?? [])
    .map((annotation) => ({
      tsMs: Math.max(0, Math.round(annotation.tsMs)),
      note: annotation.note.trim()
    }))
    .sort((a, b) => a.tsMs - b.tsMs);

  const aiAnalysis = {
    provider: body.provider,
    summary: body.summary.trim(),
    metrics: sanitizedMetrics,
    annotations: sanitizedAnnotations,
    ingestedAt: new Date().toISOString()
  };

  const { data, error } = await supabase
    .from('video_submissions')
    .update({ status: 'analyzed', ai_analysis: aiAnalysis })
    .eq('id', videoSubmissionId)
    .select('id, status, ai_analysis, updated_at')
    .single();

  if (error) return json(500, { error: error.message, code: 'analysis_update_failed' });
  await trackServerEvent('video_analysis_ingested', user.id, {
    video_submission_id: videoSubmissionId,
    provider: body.provider,
    metric_count: sanitizedMetrics.length,
    annotation_count: sanitizedAnnotations.length
  });
  return json(200, { data });
});

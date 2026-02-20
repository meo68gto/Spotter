import { badRequest, json, unauthorized } from '../_shared/http.ts';
import { createAuthedClient } from '../_shared/client.ts';

type AnalysisMetric = { key: string; label?: string; value: number; unit?: string };

Deno.serve(async (req) => {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return unauthorized('Missing Authorization header', 'missing_auth_header');

  const { activityId } = (await req.json()) as { activityId?: string };
  if (!activityId) return badRequest('Missing activityId', 'missing_activity_id');

  const supabase = createAuthedClient(authHeader);
  const { data: authData, error: authError } = await supabase.auth.getUser();
  const user = authData.user;
  if (authError || !user) return unauthorized();

  const { data: submissions, error: subError } = await supabase
    .from('video_submissions')
    .select('id, ai_analysis, created_at')
    .eq('user_id', user.id)
    .eq('activity_id', activityId)
    .eq('status', 'analyzed')
    .order('created_at', { ascending: true })
    .limit(10);

  if (subError) return json(500, { error: subError.message, code: 'submission_query_failed' });
  if (!submissions?.length) return badRequest('No analyzed submissions found', 'no_analyzed_submissions');

  const parsed = submissions
    .map((submission) => ({
      id: submission.id as string,
      createdAt: submission.created_at as string,
      metrics: ((submission.ai_analysis as { metrics?: AnalysisMetric[] } | null)?.metrics ?? []).filter(
        (metric) => metric?.key && typeof metric.value === 'number' && !Number.isNaN(metric.value)
      )
    }))
    .filter((item) => item.metrics.length > 0);

  if (!parsed.length) return badRequest('No metric payloads found in analyzed submissions', 'no_metric_payloads');

  const latest = parsed[parsed.length - 1];
  const first = parsed[0];
  const firstByKey = new Map(first.metrics.map((metric) => [metric.key, metric.value]));

  const snapshotMetrics = latest.metrics.map((metric) => {
    const baseline = firstByKey.get(metric.key) ?? metric.value;
    const delta = Number((metric.value - baseline).toFixed(3));
    return {
      key: metric.key,
      label: metric.label ?? metric.key,
      unit: metric.unit ?? null,
      value: Number(metric.value.toFixed(3)),
      baseline_value: Number(baseline.toFixed(3)),
      delta
    };
  });

  const summaryParts = snapshotMetrics
    .slice()
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
    .slice(0, 3)
    .map((metric) => `${metric.label}: ${metric.delta >= 0 ? '+' : ''}${metric.delta}`);

  const trendSummary = summaryParts.length ? summaryParts.join(', ') : 'No metric deltas available';
  const snapshotDate = new Date().toISOString().slice(0, 10);

  const { data: existingToday } = await supabase
    .from('progress_snapshots')
    .select('id')
    .eq('user_id', user.id)
    .eq('activity_id', activityId)
    .eq('snapshot_date', snapshotDate)
    .maybeSingle();

  const payload = {
    user_id: user.id,
    activity_id: activityId,
    source_submission_ids: parsed.map((item) => item.id),
    metrics: snapshotMetrics,
    trend_summary: trendSummary,
    snapshot_date: snapshotDate
  };

  const query = existingToday
    ? supabase.from('progress_snapshots').update(payload).eq('id', existingToday.id)
    : supabase.from('progress_snapshots').insert(payload);

  const { data, error } = await query.select('*').single();

  if (error) return json(500, { error: error.message, code: 'progress_snapshot_create_failed' });
  return json(200, { data });
});

import { badRequest, json, unauthorized } from '../_shared/http.ts';
import { createAuthedClient } from '../_shared/client.ts';

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

  const latest = submissions[submissions.length - 1] as { id: string; ai_analysis?: { metrics?: Array<{ key: string; label?: string; value: number; unit?: string }> } };
  const first = submissions[0] as { ai_analysis?: { metrics?: Array<{ key: string; value: number }> } };
  const latestMetrics = latest.ai_analysis?.metrics ?? [];
  const firstByKey = new Map((first.ai_analysis?.metrics ?? []).map((m) => [m.key, m.value]));

  const trendSummary = latestMetrics.length
    ? latestMetrics
        .slice(0, 3)
        .map((m) => `${m.label ?? m.key}: ${Math.round((m.value ?? 0) - (firstByKey.get(m.key) ?? m.value)) >= 0 ? '+' : ''}${Math.round((m.value ?? 0) - (firstByKey.get(m.key) ?? m.value))}`)
        .join(', ')
    : 'No metric deltas available';

  const { data, error } = await supabase
    .from('progress_snapshots')
    .insert({
      user_id: user.id,
      activity_id: activityId,
      source_submission_ids: submissions.map((s: { id: string }) => s.id),
      metrics: latestMetrics,
      trend_summary: trendSummary,
      snapshot_date: new Date().toISOString().slice(0, 10)
    })
    .select('*')
    .single();

  if (error) return json(500, { error: error.message, code: 'progress_snapshot_create_failed' });
  return json(200, { data });
});

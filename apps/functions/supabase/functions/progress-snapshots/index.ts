import { badRequest, json, unauthorized } from '../_shared/http.ts';
import { createAuthedClient } from '../_shared/client.ts';

Deno.serve(async (req) => {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return unauthorized('Missing Authorization header', 'missing_auth_header');
  const url = new URL(req.url);
  const activityId = url.searchParams.get('activityId');
  const limitRaw = Number(url.searchParams.get('limit') ?? '30');
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 120) : 30;
  if (!activityId) return badRequest('Missing activityId query param', 'missing_activity_id');

  const supabase = createAuthedClient(authHeader);
  const { data: authData, error: authError } = await supabase.auth.getUser();
  const user = authData.user;
  if (authError || !user) return unauthorized();

  const { data, error } = await supabase
    .from('progress_snapshots')
    .select('id, snapshot_date, trend_summary, metrics, source_submission_ids, created_at')
    .eq('user_id', user.id)
    .eq('activity_id', activityId)
    .order('snapshot_date', { ascending: true })
    .limit(limit);

  if (error) return json(500, { error: error.message, code: 'progress_snapshot_query_failed' });

  const snapshots = data ?? [];
  const last = snapshots[snapshots.length - 1];
  const latestMetrics =
    ((last?.metrics as Array<{ key: string; label?: string; value: number; delta?: number }> | undefined) ?? [])
      .slice(0, 5)
      .map((metric) => ({
        key: metric.key,
        label: metric.label ?? metric.key,
        value: metric.value,
        delta: metric.delta ?? 0
      }));

  return json(200, {
    data: snapshots,
    summary: {
      count: snapshots.length,
      latestSnapshotDate: last?.snapshot_date ?? null,
      latestTrendSummary: last?.trend_summary ?? null,
      latestMetrics
    }
  });
});

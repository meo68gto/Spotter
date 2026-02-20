import { badRequest, json, unauthorized } from '../_shared/http.ts';
import { createAuthedClient } from '../_shared/client.ts';

Deno.serve(async (req) => {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return unauthorized('Missing Authorization header', 'missing_auth_header');
  const activityId = new URL(req.url).searchParams.get('activityId');
  if (!activityId) return badRequest('Missing activityId query param', 'missing_activity_id');

  const supabase = createAuthedClient(authHeader);
  const { data: authData, error: authError } = await supabase.auth.getUser();
  const user = authData.user;
  if (authError || !user) return unauthorized();

  const { data, error } = await supabase
    .from('progress_snapshots')
    .select('*')
    .eq('user_id', user.id)
    .eq('activity_id', activityId)
    .order('snapshot_date', { ascending: true });

  if (error) return json(500, { error: error.message, code: 'progress_snapshot_query_failed' });
  return json(200, { data: data ?? [] });
});

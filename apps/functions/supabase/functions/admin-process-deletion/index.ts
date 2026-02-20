import { forbidden, json } from '../_shared/http.ts';
import { createServiceClient } from '../_shared/client.ts';
import { getRuntimeEnv } from '../_shared/env.ts';

Deno.serve(async (req) => {
  const env = getRuntimeEnv();
  const adminToken = req.headers.get('x-admin-token');

  if (!env.adminDeletionToken || adminToken !== env.adminDeletionToken) {
    return forbidden('Invalid admin token', 'invalid_admin_token');
  }

  const supabase = createServiceClient();

  const { data: requests, error: reqErr } = await supabase
    .from('user_deletion_requests')
    .select('id, user_id')
    .eq('status', 'pending')
    .order('requested_at', { ascending: true })
    .limit(25);

  if (reqErr) return json(500, { error: reqErr.message, code: 'deletion_request_query_failed' });
  const processed: string[] = [];

  for (const row of requests ?? []) {
    const anonName = `deleted-${row.user_id.slice(0, 8)}`;

    await supabase
      .from('users')
      .update({
        display_name: anonName,
        avatar_url: null,
        bio: null,
        home_location: null,
        availability: {}
      })
      .eq('id', row.user_id);

    await supabase
      .from('user_deletion_requests')
      .update({ status: 'completed', completed_at: new Date().toISOString() })
      .eq('id', row.id);

    processed.push(row.id);
  }

  return json(200, { processed_count: processed.length, processed_ids: processed });
});

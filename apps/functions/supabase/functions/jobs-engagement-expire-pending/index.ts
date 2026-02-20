import { createServiceClient } from '../_shared/client.ts';
import { getRuntimeEnv } from '../_shared/env.ts';
import { forbidden, json } from '../_shared/http.ts';

Deno.serve(async (req) => {
  const adminToken = req.headers.get('x-admin-token');
  const env = getRuntimeEnv();
  if (!env.adminDeletionToken || adminToken !== env.adminDeletionToken) {
    return forbidden('Invalid admin token', 'invalid_admin_token');
  }

  const service = createServiceClient();
  const { data, error } = await service.rpc('expire_pending_engagement_requests');
  if (error) return json(500, { error: error.message, code: 'engagement_expire_job_failed' });

  return json(200, { data: { expired: data ?? 0 } });
});

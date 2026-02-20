import { createServiceClient } from '../_shared/client.ts';
import { getRuntimeEnv } from '../_shared/env.ts';
import { parseJson } from '../_shared/guard.ts';
import { badRequest, forbidden, json } from '../_shared/http.ts';

type Payload = {
  engagementRequestId?: string;
  moderationStatus?: 'approved' | 'rejected';
};

Deno.serve(async (req) => {
  const adminToken = req.headers.get('x-admin-token');
  const env = getRuntimeEnv();
  if (!env.adminDeletionToken || adminToken !== env.adminDeletionToken) {
    return forbidden('Invalid admin token', 'invalid_admin_token');
  }

  const body = await parseJson<Payload>(req);
  if (body instanceof Response) return body;
  if (!body.engagementRequestId || !body.moderationStatus) {
    return badRequest('Missing required fields', 'missing_required_fields');
  }

  const service = createServiceClient();
  const { data: engagement, error } = await service
    .from('engagement_requests')
    .update({ moderation_status: body.moderationStatus })
    .eq('id', body.engagementRequestId)
    .select('id, moderation_status, public_opt_in')
    .single();

  if (error) return json(500, { error: error.message, code: 'moderation_update_failed' });

  if (body.moderationStatus === 'approved') {
    await service
      .from('home_feed_items')
      .upsert({
        engagement_request_id: body.engagementRequestId,
        score: 1,
        published_at: new Date().toISOString(),
        metadata: {}
      }, { onConflict: 'engagement_request_id' });
  } else {
    await service.from('home_feed_items').delete().eq('engagement_request_id', body.engagementRequestId);
  }

  return json(200, { data: engagement });
});

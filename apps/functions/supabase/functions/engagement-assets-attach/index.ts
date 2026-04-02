import { createServiceClient } from '../_shared/client.ts';
import { addEngagementStatusEvent } from '../_shared/coach-commerce.ts';
import { parseJson, requireUser } from '../_shared/guard.ts';
import { badRequest, json } from '../_shared/http.ts';

type Payload = {
  engagementRequestId?: string;
  videoSubmissionId?: string;
  storagePath?: string;
  role?: string;
};

Deno.serve(async (req) => {
  const auth = await requireUser(req);
  if (auth instanceof Response) return auth;
  const body = await parseJson<Payload>(req);
  if (body instanceof Response) return body;
  if (!body.engagementRequestId || (!body.videoSubmissionId && !body.storagePath)) {
    return badRequest('Missing required fields', 'missing_required_fields');
  }

  const service = createServiceClient();
  const { data: engagement } = await service
    .from('engagement_requests')
    .select('id, requester_user_id')
    .eq('id', body.engagementRequestId)
    .eq('requester_user_id', auth.user.id)
    .single();

  if (!engagement) return badRequest('Engagement request not found', 'engagement_not_found');

  const { data, error } = await service
    .from('engagement_assets')
    .insert({
      engagement_request_id: body.engagementRequestId,
      asset_type: 'video_submission',
      video_submission_id: body.videoSubmissionId ?? null,
      storage_path: body.storagePath ?? null,
      role: body.role ?? 'primary'
    })
    .select('*')
    .single();

  if (error || !data) return json(500, { error: error?.message ?? 'Asset attach failed', code: 'engagement_asset_attach_failed' });

  await addEngagementStatusEvent({
    engagementRequestId: body.engagementRequestId,
    eventType: 'asset_attached',
    actorUserId: auth.user.id,
    payload: { assetId: data.id, videoSubmissionId: body.videoSubmissionId ?? null }
  });

  return json(200, { data });
});

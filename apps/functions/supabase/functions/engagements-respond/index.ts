import { createServiceClient } from '../_shared/client.ts';
import { parseJson, requireLegalConsent, requireUser } from '../_shared/guard.ts';
import { badRequest, json, unauthorized } from '../_shared/http.ts';
import { trackServerEvent } from '../_shared/telemetry.ts';

type Payload = {
  engagementRequestId?: string;
  responseText?: string;
  audioUrl?: string;
  videoUrl?: string;
  transcript?: string;
};

Deno.serve(async (req) => {
  const auth = await requireUser(req);
  if (auth instanceof Response) return auth;
  const body = await parseJson<Payload>(req);
  if (body instanceof Response) return body;
  if (!body.engagementRequestId) return badRequest('Missing engagementRequestId', 'missing_engagement_request_id');
  const legal = await requireLegalConsent(auth.user.id);
  if (legal) return legal;

  const service = createServiceClient();
  const { data: coach } = await service.from('coaches').select('id').eq('user_id', auth.user.id).maybeSingle();
  if (!coach) return unauthorized('Only coaches can respond', 'coach_required');

  const { data: engagement } = await service
    .from('engagement_requests')
    .select('id, coach_id, status')
    .eq('id', body.engagementRequestId)
    .eq('coach_id', coach.id)
    .maybeSingle();

  if (!engagement) return badRequest('Engagement not found', 'engagement_not_found');
  if (!body.responseText && !body.audioUrl && !body.videoUrl) {
    return badRequest('At least one response payload is required', 'missing_response_payload');
  }

  const { data, error } = await service
    .from('engagement_responses')
    .upsert(
      {
        engagement_request_id: engagement.id,
        coach_id: coach.id,
        response_text: body.responseText ?? null,
        audio_url: body.audioUrl ?? null,
        video_url: body.videoUrl ?? null,
        transcript: body.transcript ?? null,
        submitted_at: new Date().toISOString()
      },
      { onConflict: 'engagement_request_id' }
    )
    .select('*')
    .single();

  if (error) return json(500, { error: error.message, code: 'engagement_response_upsert_failed' });

  await service
    .from('engagement_requests')
    .update({ status: 'completed', completed_at: new Date().toISOString() })
    .eq('id', engagement.id);

  await trackServerEvent('engagement_completed', auth.user.id, { engagement_request_id: engagement.id });

  return json(200, { data });
});

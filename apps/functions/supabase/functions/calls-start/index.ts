import { createServiceClient } from '../_shared/client.ts';
import { parseJson, requireLegalConsent, requireUser } from '../_shared/guard.ts';
import { badRequest, json } from '../_shared/http.ts';
import { trackServerEvent } from '../_shared/telemetry.ts';

type Payload = { engagementRequestId?: string };

Deno.serve(async (req) => {
  const auth = await requireUser(req);
  if (auth instanceof Response) return auth;
  const body = await parseJson<Payload>(req);
  if (body instanceof Response) return body;
  if (!body.engagementRequestId) return badRequest('Missing engagementRequestId', 'missing_engagement_request_id');
  const legal = await requireLegalConsent(auth.user.id);
  if (legal) return legal;

  const service = createServiceClient();

  const { data, error } = await service
    .from('video_call_sessions')
    .update({ started_at: new Date().toISOString() })
    .eq('engagement_request_id', body.engagementRequestId)
    .select('*')
    .single();

  if (error) return json(500, { error: error.message, code: 'call_start_failed' });

  await trackServerEvent('video_call_started', auth.user.id, { engagement_request_id: body.engagementRequestId });

  return json(200, { data });
});

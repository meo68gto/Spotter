import { createServiceClient } from '../_shared/client.ts';
import { parseJson, requireUser } from '../_shared/guard.ts';
import { badRequest, json } from '../_shared/http.ts';
import { trackServerEvent } from '../_shared/telemetry.ts';

type Payload = {
  coachId?: string;
  coachServiceId?: string;
  sourceSurface?: string;
  sourceMatchId?: string;
  sourceIntroRequestId?: string;
  sourceConnectionUserId?: string;
  stage?: string;
};

Deno.serve(async (req) => {
  const auth = await requireUser(req);
  if (auth instanceof Response) return auth;
  const body = await parseJson<Payload>(req);
  if (body instanceof Response) return body;
  if (!body.coachId || !body.sourceSurface || !body.stage) {
    return badRequest('Missing required fields', 'missing_required_fields');
  }

  const service = createServiceClient();
  await service.from('notification_events').insert({
    user_id: auth.user.id,
    event_type: 'coach_conversion_touchpoint',
    channel: 'analytics',
    provider: 'internal',
    status: 'logged',
    payload: {
      coachId: body.coachId,
      coachServiceId: body.coachServiceId ?? null,
      sourceSurface: body.sourceSurface,
      sourceMatchId: body.sourceMatchId ?? null,
      sourceIntroRequestId: body.sourceIntroRequestId ?? null,
      sourceConnectionUserId: body.sourceConnectionUserId ?? null,
      stage: body.stage
    }
  });

  await trackServerEvent('coach_conversion_touchpoint', auth.user.id, {
    coach_id: body.coachId,
    coach_service_id: body.coachServiceId ?? null,
    source_surface: body.sourceSurface,
    stage: body.stage
  });

  return json(200, { data: { success: true } });
});

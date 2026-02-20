import { createServiceClient } from '../_shared/client.ts';
import { createDailyRoom, createDailyTokenPair } from '../_shared/daily.ts';
import { parseJson, requireLegalConsent, requireUser } from '../_shared/guard.ts';
import { badRequest, json } from '../_shared/http.ts';

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
  const { data: engagement, error } = await service
    .from('engagement_requests')
    .select('id, requester_user_id, coach_id, engagement_mode, status, scheduled_time')
    .eq('id', body.engagementRequestId)
    .eq('engagement_mode', 'video_call')
    .maybeSingle();

  if (error || !engagement) return badRequest('Engagement not found', 'engagement_not_found');
  if (!['accepted', 'in_progress'].includes(engagement.status)) {
    return badRequest('Engagement not accepted', 'engagement_not_accepted');
  }

  const { data: coach } = await service.from('coaches').select('id, user_id').eq('id', engagement.coach_id).maybeSingle();
  if (!coach) return badRequest('Coach not found', 'coach_not_found');

  const participantIds = [coach.user_id, engagement.requester_user_id].filter(Boolean);
  if (!participantIds.includes(auth.user.id)) return badRequest('Not a call participant', 'participant_mismatch');

  const roomName = `spotter-${engagement.id.slice(0, 8)}-${Date.now()}`;
  const room = await createDailyRoom(roomName, engagement.scheduled_time ?? undefined);
  const tokens = await createDailyTokenPair(room.roomName, coach.user_id, engagement.requester_user_id ?? 'guest-user');

  const { data } = await service
    .from('video_call_sessions')
    .upsert(
      {
        engagement_request_id: engagement.id,
        daily_room_name: room.roomName,
        host_token: tokens.hostToken,
        guest_token: tokens.guestToken
      },
      { onConflict: 'engagement_request_id' }
    )
    .select('*')
    .single();

  await service.from('engagement_requests').update({ status: 'in_progress' }).eq('id', engagement.id);

  return json(200, { data: { ...data, roomUrl: room.roomUrl } });
});

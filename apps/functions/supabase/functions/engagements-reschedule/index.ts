import { createServiceClient } from '../_shared/client.ts';
import { parseJson, requireUser } from '../_shared/guard.ts';
import { badRequest, json } from '../_shared/http.ts';

type Payload = {
  engagementRequestId?: string;
  proposedTime?: string;
};

Deno.serve(async (req) => {
  const auth = await requireUser(req);
  if (auth instanceof Response) return auth;
  const body = await parseJson<Payload>(req);
  if (body instanceof Response) return body;

  if (!body.engagementRequestId || !body.proposedTime) {
    return badRequest('Missing required fields', 'missing_required_fields');
  }

  const proposedDate = new Date(body.proposedTime);
  if (Number.isNaN(proposedDate.getTime())) {
    return badRequest('Invalid proposed time', 'invalid_proposed_time');
  }

  const service = createServiceClient();
  const { data: engagement } = await service
    .from('engagement_requests')
    .select('id, requester_user_id, coach_id, scheduled_time')
    .eq('id', body.engagementRequestId)
    .maybeSingle();

  if (!engagement) return badRequest('Engagement not found', 'engagement_not_found');

  const { data: coach } = await service.from('coaches').select('user_id').eq('id', engagement.coach_id).maybeSingle();
  const participantIds = [engagement.requester_user_id, coach?.user_id].filter(Boolean);
  if (!participantIds.includes(auth.user.id)) {
    return badRequest('Not a participant', 'participant_mismatch');
  }

  const scheduled = engagement.scheduled_time ? new Date(engagement.scheduled_time) : null;
  if (scheduled && scheduled.getTime() - Date.now() < 24 * 60 * 60 * 1000) {
    return badRequest('Reschedule allowed only up to 24h before start', 'reschedule_window_closed');
  }

  const { data, error } = await service
    .from('reschedule_requests')
    .insert({
      engagement_request_id: engagement.id,
      proposed_time: proposedDate.toISOString(),
      requested_by_user_id: auth.user.id,
      status: 'pending'
    })
    .select('*')
    .single();

  if (error) return json(500, { error: error.message, code: 'reschedule_create_failed' });
  return json(200, { data });
});

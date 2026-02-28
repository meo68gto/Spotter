import { createServiceClient } from '../_shared/client.ts';
import { parseJson, requireLegalConsent, requireUser } from '../_shared/guard.ts';
import { badRequest, json } from '../_shared/http.ts';

type Payload = {
  receiverUserId?: string;
  activityId?: string;
  relatedEventId?: string;
  recommendationId?: string;
  purpose?: 'session' | 'tournament' | 'networking';
  message?: string;
};

Deno.serve(async (req) => {
  const auth = await requireUser(req);
  if (auth instanceof Response) return auth;
  const legal = await requireLegalConsent(auth.user.id);
  if (legal) return legal;

  const body = await parseJson<Payload>(req);
  if (body instanceof Response) return body;
  if (!body.receiverUserId || !body.activityId) {
    return badRequest('Missing receiverUserId or activityId', 'missing_required_fields');
  }

  const service = createServiceClient();
  const { data, error } = await service
    .from('networking_invites')
    .insert({
      sender_user_id: auth.user.id,
      receiver_user_id: body.receiverUserId,
      activity_id: body.activityId,
      related_event_id: body.relatedEventId ?? null,
      purpose: body.purpose ?? 'networking',
      message: body.message ?? null
    })
    .select('*')
    .single();

  if (error) {
    return json(500, {
      error: error.message,
      code: 'networking_invite_create_failed'
    });
  }

  if (body.recommendationId) {
    await service
      .from('mcp_booking_recommendations')
      .update({
        clicked_at: new Date().toISOString(),
        accepted_at: new Date().toISOString(),
        conversion_type: 'pairing_invite',
        conversion_metadata: {
          source: 'networking_invite_send',
          invite_id: data.id
        }
      })
      .eq('id', body.recommendationId)
      .is('event_id', null)
      .eq('candidate_user_id', body.receiverUserId);
  }

  return json(200, { data });
});

import { createServiceClient } from '../_shared/client.ts';
import { parseJson, requireLegalConsent, requireUser } from '../_shared/guard.ts';
import { badRequest, json } from '../_shared/http.ts';

type Payload = {
  eventId?: string;
  recommendationId?: string;
  action?: 'register' | 'cancel' | 'accept_invite' | 'decline_invite';
};

Deno.serve(async (req) => {
  const auth = await requireUser(req);
  if (auth instanceof Response) return auth;
  const legal = await requireLegalConsent(auth.user.id);
  if (legal) return legal;

  const body = await parseJson<Payload>(req);
  if (body instanceof Response) return body;
  if (!body.eventId || !body.action) {
    return badRequest('Missing eventId or action', 'missing_required_fields');
  }

  const service = createServiceClient();

  if (body.action === 'register' || body.action === 'cancel') {
    const status = body.action === 'register' ? 'registered' : 'cancelled';
    const { data, error } = await service
      .from('sponsored_event_registrations')
      .upsert(
        {
          event_id: body.eventId,
          user_id: auth.user.id,
          status
        },
        { onConflict: 'event_id,user_id' }
      )
      .select('*')
      .single();
    if (error) return json(500, { error: error.message, code: 'event_rsvp_failed' });

    if (body.recommendationId && status === 'registered') {
      await service
        .from('mcp_booking_recommendations')
        .update({
          clicked_at: new Date().toISOString(),
          accepted_at: new Date().toISOString(),
          converted_at: new Date().toISOString(),
          conversion_type: 'event_rsvp',
          conversion_metadata: {
            source: 'sponsors_event_rsvp',
            registration_id: data.id
          }
        })
        .eq('id', body.recommendationId)
        .eq('event_id', body.eventId);
    }

    return json(200, { data });
  }

  const inviteStatus = body.action === 'accept_invite' ? 'accepted' : 'declined';
  const { data: invite, error: inviteError } = await service
    .from('sponsored_event_invites')
    .update({
      status: inviteStatus,
      responded_at: new Date().toISOString()
    })
    .eq('event_id', body.eventId)
    .eq('invited_user_id', auth.user.id)
    .select('*')
    .single();

  if (inviteError || !invite) {
    return json(500, {
      error: inviteError?.message ?? 'Invite update failed',
      code: 'invite_rsvp_failed'
    });
  }

  if (body.action === 'accept_invite') {
    await service.from('sponsored_event_registrations').upsert(
      {
        event_id: body.eventId,
        user_id: auth.user.id,
        status: 'registered'
      },
      { onConflict: 'event_id,user_id' }
    );

    if (body.recommendationId) {
      await service
        .from('mcp_booking_recommendations')
        .update({
          clicked_at: new Date().toISOString(),
          accepted_at: new Date().toISOString(),
          converted_at: new Date().toISOString(),
          conversion_type: 'event_rsvp',
          conversion_metadata: {
            source: 'sponsors_event_accept_invite',
            invite_id: invite.id
          }
        })
        .eq('id', body.recommendationId)
        .eq('event_id', body.eventId);
    }
  }

  return json(200, { data: invite });
});

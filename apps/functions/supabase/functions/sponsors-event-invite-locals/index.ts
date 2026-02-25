import { createServiceClient } from '../_shared/client.ts';
import { parseJson, requireLegalConsent, requireUser } from '../_shared/guard.ts';
import { badRequest, json, unauthorized } from '../_shared/http.ts';

type Payload = {
  eventId?: string;
  radiusKm?: number;
  limit?: number;
  message?: string;
};

Deno.serve(async (req) => {
  const auth = await requireUser(req);
  if (auth instanceof Response) return auth;
  const legal = await requireLegalConsent(auth.user.id);
  if (legal) return legal;

  const body = await parseJson<Payload>(req);
  if (body instanceof Response) return body;
  if (!body.eventId) return badRequest('Missing eventId', 'missing_event_id');

  const radiusKm = body.radiusKm && body.radiusKm > 0 ? Math.min(body.radiusKm, 120) : 35;
  const limit = body.limit && body.limit > 0 ? Math.min(body.limit, 30) : 12;

  const service = createServiceClient();
  const { data: event, error: eventError } = await service
    .from('sponsored_events')
    .select('id, sponsor_id, activity_id')
    .eq('id', body.eventId)
    .maybeSingle();
  if (eventError || !event) return badRequest('Event not found', 'event_not_found');

  const { data: membership } = await service
    .from('sponsor_memberships')
    .select('id')
    .eq('sponsor_id', event.sponsor_id)
    .eq('user_id', auth.user.id)
    .in('role', ['owner', 'admin'])
    .maybeSingle();
  if (!membership) return unauthorized('Sponsor admin role required', 'sponsor_admin_required');

  const { data: profile } = await service
    .from('skill_profiles')
    .select('skill_band')
    .eq('user_id', auth.user.id)
    .eq('activity_id', event.activity_id)
    .maybeSingle();
  const skillBand = profile?.skill_band ?? 'intermediate';

  const { data: candidates, error: candidateError } = await service.rpc('find_match_candidates_v1', {
    p_requester_id: auth.user.id,
    p_activity_id: event.activity_id,
    p_skill_band: skillBand,
    p_radius_meters: Math.round(radiusKm * 1000),
    p_limit: limit
  });
  if (candidateError) return json(500, { error: candidateError.message, code: 'candidate_lookup_failed' });

  const rows = (candidates ?? []).map((candidate: { candidate_user_id: string }) => ({
    event_id: event.id,
    invited_user_id: candidate.candidate_user_id,
    invited_by_user_id: auth.user.id,
    message: body.message ?? 'Local sponsored tournament invite from Spotter.'
  }));

  if (!rows.length) return json(200, { data: { invited: 0 } });

  const { data, error } = await service
    .from('sponsored_event_invites')
    .upsert(rows, { onConflict: 'event_id,invited_user_id', ignoreDuplicates: true })
    .select('id, invited_user_id, status');

  if (error) return json(500, { error: error.message, code: 'invite_locals_failed' });
  return json(200, { data: { invited: data?.length ?? 0, invites: data ?? [] } });
});

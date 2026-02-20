import { badRequest, json, unauthorized } from '../_shared/http.ts';
import { hasRequiredSessionFields } from '../_shared/validation.ts';
import { createAuthedClient } from '../_shared/client.ts';

interface Payload {
  matchId: string;
  activityId: string;
  partnerUserId: string;
  proposedStartTime: string;
  latitude: number;
  longitude: number;
}

Deno.serve(async (req) => {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return unauthorized('Missing Authorization header', 'missing_auth_header');

  const body = (await req.json()) as Payload;
  if (!hasRequiredSessionFields(body)) {
    return badRequest('Missing required fields', 'missing_required_fields');
  }
  if (Number.isNaN(body.latitude) || Number.isNaN(body.longitude)) {
    return badRequest('Invalid coordinates', 'invalid_coordinates');
  }
  if (body.latitude < -90 || body.latitude > 90 || body.longitude < -180 || body.longitude > 180) {
    return badRequest('Coordinates out of range', 'coordinates_out_of_range');
  }
  const proposed = new Date(body.proposedStartTime);
  if (Number.isNaN(proposed.getTime())) {
    return badRequest('Invalid proposed start time', 'invalid_proposed_start_time');
  }
  if (proposed.getTime() < Date.now() - 5 * 60 * 1000) {
    return badRequest('Proposed time must be in the future', 'proposed_time_in_past');
  }

  const supabase = createAuthedClient(authHeader);

  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return unauthorized();
  }

  const { data: match, error: matchError } = await supabase
    .from('matches')
    .select('id, requester_user_id, candidate_user_id, activity_id, status')
    .eq('id', body.matchId)
    .single();

  if (matchError || !match) {
    return badRequest('Match not found', 'match_not_found');
  }
  if (match.status !== 'accepted' && match.status !== 'pending') {
    return badRequest('Match is not active', 'match_not_active');
  }
  if (match.activity_id !== body.activityId) {
    return badRequest('Activity mismatch for match', 'activity_mismatch');
  }
  const participants = [match.requester_user_id, match.candidate_user_id];
  if (!participants.includes(user.id) || !participants.includes(body.partnerUserId)) {
    return badRequest('User is not a participant in this match', 'participant_mismatch');
  }

  const { data, error } = await supabase
    .from('sessions')
    .insert({
      match_id: body.matchId,
      proposer_user_id: user.id,
      partner_user_id: body.partnerUserId,
      activity_id: body.activityId,
      proposed_start_time: body.proposedStartTime,
      meetup_location: `SRID=4326;POINT(${body.longitude} ${body.latitude})`,
      status: 'proposed'
    })
    .select('*')
    .single();

  if (error) {
    return json(500, { error: error.message });
  }

  return json(200, { data });
});

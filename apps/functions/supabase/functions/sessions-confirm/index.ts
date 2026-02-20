import { badRequest, json, unauthorized } from '../_shared/http.ts';
import { createAuthedClient } from '../_shared/client.ts';

Deno.serve(async (req) => {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return unauthorized('Missing Authorization header', 'missing_auth_header');
  const { sessionId, confirmedTime, latitude, longitude } = (await req.json()) as {
    sessionId?: string;
    confirmedTime?: string;
    latitude?: number;
    longitude?: number;
  };

  if (!sessionId || !confirmedTime) return badRequest('Missing required fields', 'missing_required_fields');
  const parsedConfirmed = new Date(confirmedTime);
  if (Number.isNaN(parsedConfirmed.getTime())) {
    return badRequest('Invalid confirmedTime', 'invalid_confirmed_time');
  }
  if (parsedConfirmed.getTime() < Date.now() - 5 * 60 * 1000) {
    return badRequest('confirmedTime must be in the future', 'confirmed_time_in_past');
  }
  if (
    (typeof latitude === 'number' && Number.isNaN(latitude)) ||
    (typeof longitude === 'number' && Number.isNaN(longitude))
  ) {
    return badRequest('Invalid coordinates', 'invalid_coordinates');
  }
  if (
    typeof latitude === 'number' &&
    typeof longitude === 'number' &&
    (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180)
  ) {
    return badRequest('Coordinates out of range', 'coordinates_out_of_range');
  }

  const supabase = createAuthedClient(authHeader);
  const { data: authData, error: authError } = await supabase.auth.getUser();
  const user = authData.user;
  if (authError || !user) return unauthorized();

  const { data: row, error: rowError } = await supabase
    .from('sessions')
    .select('id, proposer_user_id, partner_user_id, status, confirmed_time, match_id')
    .eq('id', sessionId)
    .single();

  if (rowError || !row) return badRequest('Session not found', 'session_not_found');
  if (row.partner_user_id !== user.id) return badRequest('Only partner can confirm', 'only_partner_can_confirm');
  if (row.status !== 'proposed') return badRequest('Session is not proposed', 'invalid_session_state');
  if (row.confirmed_time) return badRequest('Session already confirmed', 'session_already_confirmed');

  const updatePayload: Record<string, unknown> = { status: 'confirmed', confirmed_time: confirmedTime };
  if (typeof latitude === 'number' && typeof longitude === 'number') {
    updatePayload.meetup_location = `SRID=4326;POINT(${longitude} ${latitude})`;
  }

  const { data, error } = await supabase
    .from('sessions')
    .update(updatePayload)
    .eq('id', sessionId)
    .select('*')
    .single();

  if (error) return json(500, { error: error.message, code: 'session_confirm_failed' });

  await supabase.from('matches').update({ status: 'accepted' }).eq('id', row.match_id).eq('status', 'pending');

  return json(200, { data });
});

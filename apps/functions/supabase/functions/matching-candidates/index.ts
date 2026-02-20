import { badRequest, json, unauthorized } from '../_shared/http.ts';
import { clampMatchLimit } from '../_shared/matching.ts';
import { createAuthedClient } from '../_shared/client.ts';

interface Payload {
  activityId: string;
  radiusKm: number;
  skillBand: string;
  limit?: number;
}

Deno.serve(async (req) => {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return unauthorized('Missing Authorization header', 'missing_auth_header');

  const body = (await req.json()) as Payload;

  if (!body.activityId || !body.radiusKm || !body.skillBand) {
    return badRequest('Missing required fields', 'missing_required_fields');
  }
  if (body.radiusKm <= 0) {
    return badRequest('radiusKm must be greater than zero', 'invalid_radius');
  }

  const supabase = createAuthedClient(authHeader);

  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return unauthorized();
  }

  const { data: me, error: meError } = await supabase
    .from('users')
    .select('id, home_location')
    .eq('id', user.id)
    .single();

  if (meError || !me?.home_location) {
    return json(400, { error: 'User location is required for matching', code: 'missing_user_location' });
  }

  const { data, error } = await supabase.rpc('find_match_candidates_v1', {
    p_requester_id: user.id,
    p_activity_id: body.activityId,
    p_skill_band: body.skillBand,
    p_radius_meters: Math.round(body.radiusKm * 1000),
    p_limit: clampMatchLimit(body.limit)
  });

  if (error) {
    return json(500, { error: error.message, code: 'matching_candidates_failed' });
  }

  return json(200, { data });
});

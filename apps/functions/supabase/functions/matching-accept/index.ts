import { badRequest, json, unauthorized } from '../_shared/http.ts';
import { createAuthedClient } from '../_shared/client.ts';

Deno.serve(async (req) => {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return unauthorized('Missing Authorization header', 'missing_auth_header');
  const { matchId } = (await req.json()) as { matchId?: string };
  if (!matchId) return badRequest('Missing matchId', 'missing_match_id');

  const supabase = createAuthedClient(authHeader);
  const { data: authData, error: authError } = await supabase.auth.getUser();
  const user = authData.user;
  if (authError || !user) return unauthorized();

  const { data: match, error: matchErr } = await supabase
    .from('matches')
    .select('id, requester_user_id, candidate_user_id, status, expires_at')
    .eq('id', matchId)
    .single();

  if (matchErr || !match) return badRequest('Match not found', 'match_not_found');
  if (match.status !== 'pending') return badRequest('Match is not pending', 'invalid_match_state');
  if (match.candidate_user_id !== user.id) {
    return badRequest('Only candidate can accept match requests', 'only_candidate_can_accept');
  }
  if (match.expires_at && new Date(match.expires_at).getTime() <= Date.now()) {
    return badRequest('Match request has expired', 'match_expired');
  }

  const { data, error } = await supabase
    .from('matches')
    .update({ status: 'accepted' })
    .eq('id', matchId)
    .select('*')
    .single();

  if (error) return json(500, { error: error.message, code: 'match_accept_failed' });
  return json(200, { data });
});

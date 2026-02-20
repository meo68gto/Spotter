import { badRequest, json, unauthorized } from '../_shared/http.ts';
import { createAuthedClient } from '../_shared/client.ts';

Deno.serve(async (req) => {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return unauthorized('Missing Authorization header', 'missing_auth_header');
  const { sessionId } = (await req.json()) as { sessionId?: string };
  if (!sessionId) return badRequest('Missing sessionId', 'missing_session_id');

  const supabase = createAuthedClient(authHeader);
  const { data: authData, error: authError } = await supabase.auth.getUser();
  const user = authData.user;
  if (authError || !user) return unauthorized();

  const { data: row, error: rowError } = await supabase
    .from('sessions')
    .select('id, proposer_user_id, partner_user_id, status')
    .eq('id', sessionId)
    .single();

  if (rowError || !row) return badRequest('Session not found', 'session_not_found');
  if (row.partner_user_id !== user.id && row.proposer_user_id !== user.id) {
    return badRequest('Not a session participant', 'participant_mismatch');
  }
  if (row.status !== 'proposed' && row.status !== 'confirmed') {
    return badRequest('Only proposed or confirmed sessions can be cancelled', 'invalid_session_state');
  }

  const { data, error } = await supabase
    .from('sessions')
    .update({ status: 'cancelled' })
    .eq('id', sessionId)
    .select('*')
    .single();

  if (error) return json(500, { error: error.message, code: 'session_cancel_failed' });
  return json(200, { data });
});

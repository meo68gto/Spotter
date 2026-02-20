import { badRequest, json, unauthorized } from '../_shared/http.ts';
import { createAuthedClient } from '../_shared/client.ts';

Deno.serve(async (req) => {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return unauthorized('Missing Authorization header', 'missing_auth_header');

  const { sessionId, thumbsUp, tag } = (await req.json()) as {
    sessionId?: string;
    thumbsUp?: boolean;
    tag?: string;
  };

  if (!sessionId || typeof thumbsUp !== 'boolean') {
    return badRequest('Missing required fields', 'missing_required_fields');
  }

  const supabase = createAuthedClient(authHeader);
  const { data: authData, error: authError } = await supabase.auth.getUser();
  const user = authData.user;
  if (authError || !user) return unauthorized();

  const { data: row, error: rowError } = await supabase
    .from('sessions')
    .select('id, status, proposer_user_id, partner_user_id')
    .eq('id', sessionId)
    .single();

  if (rowError || !row) return badRequest('Session not found', 'session_not_found');
  if (row.status !== 'completed' && row.status !== 'confirmed') {
    return badRequest('Session is not eligible for feedback', 'invalid_session_state');
  }

  const revieweeUserId = row.proposer_user_id === user.id ? row.partner_user_id : row.proposer_user_id;
  if (![row.proposer_user_id, row.partner_user_id].includes(user.id)) {
    return badRequest('Not a session participant', 'participant_mismatch');
  }

  const { data, error } = await supabase
    .from('session_feedback')
    .upsert(
      {
        session_id: sessionId,
        reviewer_user_id: user.id,
        reviewee_user_id: revieweeUserId,
        thumbs_up: thumbsUp,
        tag: tag ?? null
      },
      { onConflict: 'session_id,reviewer_user_id' }
    )
    .select('*')
    .single();

  if (error) return json(500, { error: error.message, code: 'session_feedback_failed' });
  return json(200, { data });
});

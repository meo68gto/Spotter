import { badRequest, json, tooMany, unauthorized } from '../_shared/http.ts';
import { createAuthedClient } from '../_shared/client.ts';
import { exceededMessageLimit } from '../_shared/rate-limit.ts';
import { requireLegalConsent } from '../_shared/guard.ts';

Deno.serve(async (req) => {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return unauthorized('Missing Authorization header', 'missing_auth_header');

  const { sessionId, message, clientMessageId } = (await req.json()) as {
    sessionId?: string;
    message?: string;
    clientMessageId?: string;
  };

  if (!sessionId || !message?.trim()) {
    return badRequest('Missing required fields', 'missing_required_fields');
  }

  const trimmed = message.trim();
  if (trimmed.length > 2000) {
    return badRequest('Message too long', 'message_too_long');
  }

  const supabase = createAuthedClient(authHeader);
  const { data: authData, error: authError } = await supabase.auth.getUser();
  const user = authData.user;
  if (authError || !user) return unauthorized();
  const legal = await requireLegalConsent(user.id);
  if (legal) return legal;

  const { count, error: countError } = await supabase
    .from('messages')
    .select('id', { count: 'exact', head: true })
    .eq('sender_user_id', user.id)
    .gte('created_at', new Date(Date.now() - 60_000).toISOString());

  if (!countError && exceededMessageLimit(count ?? 0)) {
    return tooMany('Message rate limit exceeded', 'message_rate_limited');
  }

  const { data: sessionRow, error: sessionError } = await supabase
    .from('sessions')
    .select('id, proposer_user_id, partner_user_id')
    .eq('id', sessionId)
    .single();

  if (sessionError || !sessionRow) {
    return badRequest('Session not found', 'session_not_found');
  }
  if (![sessionRow.proposer_user_id, sessionRow.partner_user_id].includes(user.id)) {
    return badRequest('Not a session participant', 'participant_mismatch');
  }

  if (clientMessageId) {
    const { data: existing } = await supabase
      .from('messages')
      .select('id, sender_user_id, message, created_at, client_message_id')
      .eq('session_id', sessionId)
      .eq('sender_user_id', user.id)
      .eq('client_message_id', clientMessageId)
      .maybeSingle();

    if (existing) return json(200, { data: existing, deduped: true });
  }

  const { data, error } = await supabase
    .from('messages')
    .insert({
      session_id: sessionId,
      sender_user_id: user.id,
      message: trimmed,
      client_message_id: clientMessageId ?? null,
      moderation_status: 'pending'
    })
    .select('id, sender_user_id, message, created_at, client_message_id')
    .single();

  if (error) return json(500, { error: error.message, code: 'chat_send_failed' });
  return json(200, { data, deduped: false });
});

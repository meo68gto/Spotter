import { createAuthedClient } from '../_shared/client.ts';
import { requireLegalConsent } from '../_shared/guard.ts';
import { badRequest, json, tooMany, unauthorized } from '../_shared/http.ts';
import { exceededMessageLimit } from '../_shared/rate-limit.ts';

type Payload = {
  engagementRequestId?: string;
  message?: string;
  clientMessageId?: string;
};

Deno.serve(async (req) => {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return unauthorized('Missing Authorization header', 'missing_auth_header');

  const body = (await req.json().catch(() => ({}))) as Payload;
  if (!body.engagementRequestId || !body.message?.trim()) {
    return badRequest('Missing required fields', 'missing_required_fields');
  }

  const message = body.message.trim();
  if (message.length > 2000) return badRequest('Message too long', 'message_too_long');

  const supabase = createAuthedClient(authHeader);
  const { data: authData, error: authError } = await supabase.auth.getUser();
  const user = authData.user;
  if (authError || !user) return unauthorized();
  const legal = await requireLegalConsent(user.id);
  if (legal) return legal;

  const { count } = await supabase
    .from('engagement_thread_messages')
    .select('id', { count: 'exact', head: true })
    .eq('sender_user_id', user.id)
    .gte('created_at', new Date(Date.now() - 60_000).toISOString());

  if (exceededMessageLimit(count ?? 0)) {
    return tooMany('Message rate limit exceeded', 'message_rate_limited');
  }

  const { data: engagement, error: engagementError } = await supabase
    .from('engagement_requests')
    .select('id, requester_user_id, coach_id')
    .eq('id', body.engagementRequestId)
    .maybeSingle();

  if (engagementError || !engagement) return badRequest('Engagement not found', 'engagement_not_found');

  const { data: coach } = await supabase.from('coaches').select('id, user_id').eq('id', engagement.coach_id).maybeSingle();
  if (!coach) return badRequest('Coach not found', 'coach_not_found');

  if (![engagement.requester_user_id, coach.user_id].includes(user.id)) {
    return badRequest('Not an engagement participant', 'participant_mismatch');
  }

  if (body.clientMessageId) {
    const { data: existing } = await supabase
      .from('engagement_thread_messages')
      .select('id, engagement_request_id, sender_user_id, message, client_message_id, created_at')
      .eq('engagement_request_id', body.engagementRequestId)
      .eq('sender_user_id', user.id)
      .eq('client_message_id', body.clientMessageId)
      .maybeSingle();
    if (existing) return json(200, { data: existing, deduped: true });
  }

  const { data, error } = await supabase
    .from('engagement_thread_messages')
    .insert({
      engagement_request_id: body.engagementRequestId,
      sender_user_id: user.id,
      message,
      client_message_id: body.clientMessageId ?? null
    })
    .select('id, engagement_request_id, sender_user_id, message, client_message_id, created_at')
    .single();

  if (error) return json(500, { error: error.message, code: 'engagement_chat_send_failed' });
  return json(200, { data, deduped: false });
});

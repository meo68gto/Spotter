import { createServiceClient } from '../_shared/client.ts';
import { hashToken } from '../_shared/engagements.ts';
import { parseJson } from '../_shared/guard.ts';
import { badRequest, json } from '../_shared/http.ts';

type Payload = {
  token?: string;
};

Deno.serve(async (req) => {
  const body = await parseJson<Payload>(req);
  if (body instanceof Response) return body;
  if (!body.token) return badRequest('Missing token', 'missing_token');

  const tokenHash = await hashToken(body.token);
  const service = createServiceClient();

  const { data: guestSession, error } = await service
    .from('guest_checkout_sessions')
    .select('id, email, expires_at, verified_at')
    .eq('verification_token_hash', tokenHash)
    .maybeSingle();

  if (error || !guestSession) return badRequest('Token not found', 'token_not_found');
  if (new Date(guestSession.expires_at).getTime() < Date.now()) return badRequest('Token expired', 'token_expired');

  await service.from('guest_checkout_sessions').update({ verified_at: new Date().toISOString() }).eq('id', guestSession.id);

  const { data: requests } = await service
    .from('engagement_requests')
    .select('id, status, engagement_mode, question_text, created_at')
    .eq('guest_checkout_session_id', guestSession.id)
    .order('created_at', { ascending: false })
    .limit(20);

  return json(200, {
    data: {
      guestSessionId: guestSession.id,
      email: guestSession.email,
      requests: requests ?? []
    }
  });
});

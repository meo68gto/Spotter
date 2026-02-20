import { createServiceClient } from '../_shared/client.ts';
import { hashToken, randomToken } from '../_shared/engagements.ts';
import { parseJson } from '../_shared/guard.ts';
import { badRequest, json } from '../_shared/http.ts';

type Payload = {
  email?: string;
};

Deno.serve(async (req) => {
  const body = await parseJson<Payload>(req);
  if (body instanceof Response) return body;
  if (!body.email) return badRequest('Missing email', 'missing_email');

  const token = randomToken();
  const tokenHash = await hashToken(token);
  const service = createServiceClient();
  const { data, error } = await service
    .from('guest_checkout_sessions')
    .insert({
      email: body.email,
      verification_token_hash: tokenHash,
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    })
    .select('id, email, expires_at')
    .single();

  if (error) return json(500, { error: error.message, code: 'guest_checkout_create_failed' });

  return json(200, {
    data: {
      ...data,
      verificationToken: token
    }
  });
});

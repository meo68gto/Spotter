import { createServiceClient } from '../_shared/client.ts';
import { getRuntimeEnv } from '../_shared/env.ts';
import { parseJson, requireUser } from '../_shared/guard.ts';
import { badRequest, json } from '../_shared/http.ts';
import { trackServerEvent } from '../_shared/telemetry.ts';

type Payload = {
  accepted: boolean;
  locale?: string;
};

Deno.serve(async (req) => {
  const auth = await requireUser(req);
  if (auth instanceof Response) return auth;

  const body = await parseJson<Payload>(req);
  if (body instanceof Response) return body;

  if (!body.accepted) {
    return badRequest('Consent acceptance is required', 'consent_required');
  }

  const service = createServiceClient();
  const env = getRuntimeEnv();

  const { data, error } = await service
    .from('user_legal_consents')
    .insert({
      user_id: auth.user.id,
      tos_version: env.legalTosVersion,
      privacy_version: env.legalPrivacyVersion,
      cookie_version: env.legalCookieVersion,
      locale: body.locale ?? req.headers.get('accept-language')?.split(',')[0] ?? null
    })
    .select('id, accepted_at, tos_version, privacy_version, cookie_version, locale')
    .single();

  if (error) {
    return json(500, { error: error.message, code: 'legal_consent_create_failed' });
  }

  await trackServerEvent('legal_consent_accepted', auth.user.id, {
    tos_version: env.legalTosVersion,
    privacy_version: env.legalPrivacyVersion,
    cookie_version: env.legalCookieVersion
  });

  return json(200, { data });
});

import { createServiceClient } from '../_shared/client.ts';
import { getRuntimeEnv } from '../_shared/env.ts';
import { requireUser } from '../_shared/guard.ts';
import { json } from '../_shared/http.ts';

Deno.serve(async (req) => {
  const auth = await requireUser(req);
  if (auth instanceof Response) return auth;

  const service = createServiceClient();
  const env = getRuntimeEnv();

  const { data, error } = await service
    .from('user_legal_consents')
    .select('tos_version, privacy_version, cookie_version, accepted_at')
    .eq('user_id', auth.user.id)
    .order('accepted_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    return json(500, { error: error.message, code: 'legal_status_query_failed' });
  }

  const requiredVersions = {
    tos: env.legalTosVersion,
    privacy: env.legalPrivacyVersion,
    cookie: env.legalCookieVersion
  };

  const accepted =
    data?.tos_version === requiredVersions.tos &&
    data?.privacy_version === requiredVersions.privacy &&
    data?.cookie_version === requiredVersions.cookie;

  return json(200, {
    data: {
      accepted,
      requiredVersions,
      acceptedVersions: data
        ? {
            tos: data.tos_version,
            privacy: data.privacy_version,
            cookie: data.cookie_version
          }
        : null,
      acceptedAt: data?.accepted_at ?? null,
      urls: {
        tos: env.legalTosUrl,
        privacy: env.legalPrivacyUrl,
        cookie: env.legalCookieUrl
      }
    }
  });
});

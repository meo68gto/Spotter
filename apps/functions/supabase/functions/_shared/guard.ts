import { createAuthedClient, createServiceClient } from './client.ts';
import { getRuntimeEnv } from './env.ts';
import { badRequest, unauthorized } from './http.ts';

export type AuthUser = {
  id: string;
  email?: string | null;
};

export const parseJson = async <T>(req: Request): Promise<T | Response> => {
  try {
    return (await req.json()) as T;
  } catch {
    return badRequest('Invalid JSON body', 'invalid_json_body');
  }
};

export const requireUser = async (req: Request): Promise<{ user: AuthUser; authHeader: string } | Response> => {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return unauthorized('Missing Authorization header', 'missing_auth_header');
  }

  const authed = createAuthedClient(authHeader);
  const { data, error } = await authed.auth.getUser();
  if (error || !data.user) {
    return unauthorized();
  }

  return {
    authHeader,
    user: {
      id: data.user.id,
      email: data.user.email
    }
  };
};

export const requireLegalConsent = async (userId: string): Promise<Response | null> => {
  const service = createServiceClient();
  const env = getRuntimeEnv();
  const { data, error } = await service
    .from('user_legal_consents')
    .select('tos_version, privacy_version, cookie_version')
    .eq('user_id', userId)
    .order('accepted_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    return badRequest('Legal consent is required', 'legal_consent_required');
  }

  const accepted =
    data.tos_version === env.legalTosVersion &&
    data.privacy_version === env.legalPrivacyVersion &&
    data.cookie_version === env.legalCookieVersion;

  if (!accepted) {
    return badRequest('Legal consent is required', 'legal_consent_required');
  }
  return null;
};

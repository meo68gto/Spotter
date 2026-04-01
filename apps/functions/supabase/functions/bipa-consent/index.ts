import { createServiceClient } from '../_shared/client.ts';
import { getRuntimeEnv } from '../_shared/env.ts';
import { parseJson, requireUser } from '../_shared/guard.ts';
import { badRequest, json } from '../_shared/http.ts';
import { trackServerEvent } from '../_shared/telemetry.ts';

/**
 * POST /bipa-consent
 *
 * Records BIPA (Illinois Biometric Information Privacy Act) consent.
 *
 * Body:
 *   bipa_accepted   boolean  — true = explicit opt-in, false = withheld
 *   is_illinois     boolean  — true = detected Illinois resident, false = not Illinois
 *   location_denied boolean  — true = location access denied; all users treated as Illinois
 *   bipa_version    string   — version of BIPA disclosure presented
 *
 * Even if the user declines, we record a row (consent_withheld = true)
 * so we have an audit trail and can distinguish "not asked" from "declined".
 */
type Payload = {
  bipa_accepted: boolean;
  is_illinois: boolean;
  location_denied: boolean;
  bipa_version: string;
};

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return json(405, { error: 'Method not allowed' });
  }

  const auth = await requireUser(req);
  if (auth instanceof Response) return auth;

  const body = await parseJson<Payload>(req);
  if (body instanceof Response) return body;

  const { bipa_accepted, is_illinois, location_denied, bipa_version } = body;

  if (typeof bipa_accepted !== 'boolean') {
    return badRequest('bipa_accepted (boolean) is required', 'invalid_payload');
  }
  if (typeof is_illinois !== 'boolean') {
    return badRequest('is_illinois (boolean) is required', 'invalid_payload');
  }
  if (typeof location_denied !== 'boolean') {
    return badRequest('location_denied (boolean) is required', 'invalid_payload');
  }
  if (!bipa_version || typeof bipa_version !== 'string') {
    return badRequest('bipa_version (string) is required', 'invalid_payload');
  }

  const service = createServiceClient();

  const { data, error } = await service
    .from('user_legal_consents')
    .insert({
      user_id: auth.user.id,
      bipa_version,
      bipa_accepted,
      is_illinois,
      location_denied,
      consent_withheld: !bipa_accepted,
    })
    .select('id, bipa_version, bipa_accepted, is_illinois, location_denied, consent_withheld, accepted_at')
    .single();

  if (error) {
    return json(500, { error: error.message, code: 'bipa_consent_create_failed' });
  }

  await trackServerEvent('bipa_consent_recorded', auth.user.id, {
    bipa_version,
    bipa_accepted,
    is_illinois,
    location_denied,
  });

  return json(200, { data });
});

import { createServiceClient } from '../_shared/client.ts';
import { requireUser } from '../_shared/guard.ts';
import { json } from '../_shared/http.ts';

/**
 * GET /bipa-status
 *
 * Checks whether the authenticated user has provided BIPA consent for the
 * current BIPA_VERSION. Returns the most recent BIPA consent record.
 *
 * Response:
 *   bipa_required  boolean  — whether BIPA consent is required (Illinois or location denied)
 *   bipa_accepted  boolean  — whether the user has consented
 *   is_illinois    boolean  — detected Illinois resident flag from consent record
 *   location_denied boolean  — location access was denied flag from consent record
 *   bipa_version   string   — version the user consented to (null if never asked)
 */
Deno.serve(async (req) => {
  if (req.method !== 'GET') {
    return json(405, { error: 'Method not allowed' });
  }

  const auth = await requireUser(req);
  if (auth instanceof Response) return auth;

  const service = createServiceClient();

  // Fetch the most recent BIPA consent record for this user
  const { data, error } = await service
    .from('user_legal_consents')
    .select(
      'bipa_version, bipa_accepted, is_illinois, location_denied, consent_withheld, accepted_at'
    )
    .eq('user_id', auth.user.id)
    .not('bipa_version', 'is', null)
    .order('accepted_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    return json(500, { error: error.message, code: 'bipa_status_query_failed' });
  }

  // User has a BIPA consent record for the current version
  const bipa_required = data?.bipa_version != null;

  return json(200, {
    data: {
      bipa_required,
      bipa_accepted: data?.bipa_accepted ?? false,
      is_illinois: data?.is_illinois ?? false,
      location_denied: data?.location_denied ?? false,
      bipa_version: data?.bipa_version ?? null,
      consented_at: data?.accepted_at ?? null,
    },
  });
});

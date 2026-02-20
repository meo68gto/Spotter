import { createServiceClient } from '../_shared/client.ts';
import { parseJson, requireLegalConsent, requireUser } from '../_shared/guard.ts';
import { badRequest, json, unauthorized } from '../_shared/http.ts';

type Payload = { engagementRequestId?: string; publicOptIn?: boolean };

Deno.serve(async (req) => {
  const auth = await requireUser(req);
  if (auth instanceof Response) return auth;
  const body = await parseJson<Payload>(req);
  if (body instanceof Response) return body;
  if (!body.engagementRequestId) return badRequest('Missing engagementRequestId', 'missing_engagement_request_id');
  const legal = await requireLegalConsent(auth.user.id);
  if (legal) return legal;

  const service = createServiceClient();
  const { data: coach } = await service.from('coaches').select('id').eq('user_id', auth.user.id).maybeSingle();
  if (!coach) return unauthorized('Only coaches can toggle public answers', 'coach_required');

  const { data, error } = await service
    .from('engagement_requests')
    .update({
      public_opt_in: Boolean(body.publicOptIn),
      moderation_status: body.publicOptIn ? 'pending' : 'rejected'
    })
    .eq('id', body.engagementRequestId)
    .eq('coach_id', coach.id)
    .select('id, public_opt_in, moderation_status')
    .single();

  if (error) return json(500, { error: error.message, code: 'public_toggle_failed' });
  return json(200, { data });
});

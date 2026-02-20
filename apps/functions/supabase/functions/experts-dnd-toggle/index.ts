import { createServiceClient } from '../_shared/client.ts';
import { ensureCoachForUser } from '../_shared/engagements.ts';
import { parseJson, requireUser } from '../_shared/guard.ts';
import { badRequest, json, unauthorized } from '../_shared/http.ts';

type Payload = { enabled?: boolean };

Deno.serve(async (req) => {
  const auth = await requireUser(req);
  if (auth instanceof Response) return auth;
  const body = await parseJson<Payload>(req);
  if (body instanceof Response) return body;
  if (typeof body.enabled !== 'boolean') return badRequest('Missing enabled', 'missing_enabled');

  const coach = await ensureCoachForUser(auth.user.id);
  if (!coach) return unauthorized('Only coaches can toggle DND', 'coach_required');

  const service = createServiceClient();
  const { data, error } = await service
    .from('expert_profiles')
    .upsert(
      {
        coach_id: coach.id,
        is_dnd: body.enabled,
        discoverable: !body.enabled
      },
      { onConflict: 'coach_id' }
    )
    .select('*')
    .single();

  if (error) return json(500, { error: error.message, code: 'expert_dnd_toggle_failed' });
  return json(200, { data });
});

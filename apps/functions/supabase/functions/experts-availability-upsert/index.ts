import { createServiceClient } from '../_shared/client.ts';
import { ensureCoachForUser } from '../_shared/engagements.ts';
import { parseJson, requireLegalConsent, requireUser } from '../_shared/guard.ts';
import { badRequest, json, unauthorized } from '../_shared/http.ts';

type Slot = {
  weekday: number;
  startMinute: number;
  endMinute: number;
  timezone?: string;
};

type Payload = {
  slots?: Slot[];
};

Deno.serve(async (req) => {
  const auth = await requireUser(req);
  if (auth instanceof Response) return auth;
  const body = await parseJson<Payload>(req);
  if (body instanceof Response) return body;
  if (!body.slots) return badRequest('Missing slots', 'missing_slots');
  const legal = await requireLegalConsent(auth.user.id);
  if (legal) return legal;

  const coach = await ensureCoachForUser(auth.user.id);
  if (!coach) return unauthorized('Only coaches can update availability', 'coach_required');

  const service = createServiceClient();
  await service.from('availability_slots').delete().eq('user_id', auth.user.id).is('activity_id', null);

  const { data, error } = await service
    .from('availability_slots')
    .insert(
      body.slots.map((slot) => ({
        user_id: auth.user.id,
        activity_id: null,
        weekday: slot.weekday,
        start_minute: slot.startMinute,
        end_minute: slot.endMinute,
        timezone: slot.timezone ?? 'UTC'
      }))
    )
    .select('*');

  if (error) return json(500, { error: error.message, code: 'expert_availability_upsert_failed' });
  return json(200, { data });
});

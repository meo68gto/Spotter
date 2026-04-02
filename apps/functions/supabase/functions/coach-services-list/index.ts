import { createServiceClient } from '../_shared/client.ts';
import { parseJson, requireUser } from '../_shared/guard.ts';
import { badRequest, json } from '../_shared/http.ts';

type Payload = {
  coachId?: string;
};

Deno.serve(async (req) => {
  const auth = await requireUser(req);
  if (auth instanceof Response) return auth;

  const body = req.method === 'GET' ? ({ coachId: new URL(req.url).searchParams.get('coachId') ?? undefined } satisfies Payload) : await parseJson<Payload>(req);
  if (body instanceof Response) return body;

  if (!body.coachId) return badRequest('Missing coachId', 'missing_coach_id');

  const service = createServiceClient();
  const { data, error } = await service
    .from('coach_services')
    .select('id, coach_id, service_type, title, description, price_cents, currency, turnaround_hours, duration_minutes, requires_video, requires_schedule, active, sort_order, metadata')
    .eq('coach_id', body.coachId)
    .eq('active', true)
    .order('sort_order', { ascending: true });

  if (error) return json(500, { error: error.message, code: 'coach_services_list_failed' });
  return json(200, { data: data ?? [] });
});

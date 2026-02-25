import { createServiceClient } from '../_shared/client.ts';
import { parseJson, requireLegalConsent, requireUser } from '../_shared/guard.ts';
import { json } from '../_shared/http.ts';

type Payload = {
  activityId?: string;
  city?: string;
  status?: 'published' | 'draft' | 'closed' | 'cancelled';
  limit?: number;
};

Deno.serve(async (req) => {
  const auth = await requireUser(req);
  if (auth instanceof Response) return auth;
  const legal = await requireLegalConsent(auth.user.id);
  if (legal) return legal;

  const body = req.method === 'GET' ? ({} as Payload) : await parseJson<Payload>(req);
  if (body instanceof Response) return body;

  const limit = body.limit && body.limit > 0 ? Math.min(body.limit, 50) : 25;
  const service = createServiceClient();

  let query = service
    .from('sponsored_events')
    .select('id, sponsor_id, activity_id, title, description, city, venue_name, start_time, end_time, status, max_participants, created_at')
    .order('start_time', { ascending: true })
    .limit(limit);

  if (body.activityId) query = query.eq('activity_id', body.activityId);
  if (body.city) query = query.ilike('city', `%${body.city}%`);
  if (body.status) query = query.eq('status', body.status);
  else query = query.eq('status', 'published');

  const { data: events, error } = await query;
  if (error) return json(500, { error: error.message, code: 'sponsored_event_list_failed' });

  const sponsorIds = [...new Set((events ?? []).map((event) => event.sponsor_id))];
  const { data: sponsors } = sponsorIds.length
    ? await service.from('sponsors').select('id, name').in('id', sponsorIds)
    : { data: [] as Array<{ id: string; name: string }> };
  const sponsorById = new Map((sponsors ?? []).map((sponsor) => [sponsor.id, sponsor.name]));

  const eventIds = (events ?? []).map((event) => event.id);
  const { data: counts } = eventIds.length
    ? await service
        .from('sponsored_event_registrations')
        .select('event_id')
        .in('event_id', eventIds)
        .in('status', ['registered', 'checked_in'])
    : { data: [] as Array<{ event_id: string }> };
  const countByEvent = new Map<string, number>();
  for (const row of counts ?? []) {
    countByEvent.set(row.event_id, (countByEvent.get(row.event_id) ?? 0) + 1);
  }

  const { data: myRegistrations } = eventIds.length
    ? await service
        .from('sponsored_event_registrations')
        .select('event_id, status')
        .eq('user_id', auth.user.id)
        .in('event_id', eventIds)
    : { data: [] as Array<{ event_id: string; status: string }> };
  const registrationByEvent = new Map((myRegistrations ?? []).map((row) => [row.event_id, row.status]));

  return json(200, {
    data: (events ?? []).map((event) => ({
      ...event,
      sponsor_name: sponsorById.get(event.sponsor_id) ?? 'Sponsor',
      registration_count: countByEvent.get(event.id) ?? 0,
      my_registration_status: registrationByEvent.get(event.id) ?? null
    }))
  });
});

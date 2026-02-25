import { createServiceClient } from '../_shared/client.ts';
import { parseJson, requireLegalConsent, requireUser } from '../_shared/guard.ts';
import { badRequest, json, unauthorized } from '../_shared/http.ts';

type Payload = {
  sponsorId?: string;
  sponsorName?: string;
  sponsorCity?: string;
  title?: string;
  description?: string;
  activityId?: string;
  city?: string;
  venueName?: string;
  latitude?: number;
  longitude?: number;
  startTime?: string;
  endTime?: string;
  maxParticipants?: number;
};

const isAdminMember = async (service: ReturnType<typeof createServiceClient>, sponsorId: string, userId: string) => {
  const { data } = await service
    .from('sponsor_memberships')
    .select('id, role')
    .eq('sponsor_id', sponsorId)
    .eq('user_id', userId)
    .in('role', ['owner', 'admin'])
    .maybeSingle();
  return Boolean(data);
};

Deno.serve(async (req) => {
  const auth = await requireUser(req);
  if (auth instanceof Response) return auth;
  const legal = await requireLegalConsent(auth.user.id);
  if (legal) return legal;

  const body = await parseJson<Payload>(req);
  if (body instanceof Response) return body;

  if (!body.title || !body.activityId || !body.startTime || !body.endTime) {
    return badRequest('Missing required fields', 'missing_required_fields');
  }

  const service = createServiceClient();
  let sponsorId = body.sponsorId ?? null;

  if (!sponsorId) {
    if (!body.sponsorName?.trim()) return badRequest('Missing sponsorName', 'missing_sponsor_name');
    const { data: sponsor, error: sponsorError } = await service
      .from('sponsors')
      .insert({
        name: body.sponsorName.trim(),
        city: body.sponsorCity ?? body.city ?? null,
        created_by_user_id: auth.user.id
      })
      .select('id')
      .single();

    if (sponsorError || !sponsor) {
      return json(500, { error: sponsorError?.message ?? 'Sponsor create failed', code: 'sponsor_create_failed' });
    }
    sponsorId = sponsor.id;

    await service.from('sponsor_memberships').insert({
      sponsor_id: sponsorId,
      user_id: auth.user.id,
      role: 'owner'
    });
  }

  const admin = await isAdminMember(service, sponsorId, auth.user.id);
  if (!admin) return unauthorized('Sponsor admin role required', 'sponsor_admin_required');

  const venueWkt =
    typeof body.latitude === 'number' && typeof body.longitude === 'number'
      ? `SRID=4326;POINT(${body.longitude} ${body.latitude})`
      : null;

  const { data, error } = await service
    .from('sponsored_events')
    .insert({
      sponsor_id: sponsorId,
      created_by_user_id: auth.user.id,
      activity_id: body.activityId,
      title: body.title,
      description: body.description ?? null,
      city: body.city ?? null,
      venue_name: body.venueName ?? null,
      venue_location: venueWkt,
      start_time: body.startTime,
      end_time: body.endTime,
      max_participants: body.maxParticipants ?? 32,
      status: 'published'
    })
    .select('*')
    .single();

  if (error) {
    return json(500, {
      error: error.message,
      code: 'sponsored_event_create_failed'
    });
  }

  return json(200, { data });
});

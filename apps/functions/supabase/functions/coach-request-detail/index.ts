import { createServiceClient } from '../_shared/client.ts';
import { ensureCoachForUser } from '../_shared/engagements.ts';
import { parseJson, requireUser } from '../_shared/guard.ts';
import { badRequest, json, unauthorized } from '../_shared/http.ts';

type Payload = { engagementRequestId?: string };

Deno.serve(async (req) => {
  const auth = await requireUser(req);
  if (auth instanceof Response) return auth;
  const body = req.method === 'GET' ? ({ engagementRequestId: new URL(req.url).searchParams.get('engagementRequestId') ?? undefined } satisfies Payload) : await parseJson<Payload>(req);
  if (body instanceof Response) return body;
  if (!body.engagementRequestId) return badRequest('Missing engagementRequestId', 'missing_engagement_request_id');

  const coach = await ensureCoachForUser(auth.user.id);
  if (!coach) return unauthorized('Only coaches can view request detail', 'coach_required');

  const service = createServiceClient();
  const { data: engagement, error } = await service
    .from('engagement_requests')
    .select('*')
    .eq('id', body.engagementRequestId)
    .eq('coach_id', coach.id)
    .single();

  if (error || !engagement) return json(404, { error: 'Request not found', code: 'coach_request_not_found' });

  const [{ data: coachService }, { data: requester }, { data: reviewOrder }, { data: engagementAssets }, { data: engagementResponses }, { data: engagementStatusEvents }] =
    await Promise.all([
      engagement.coach_service_id
        ? service.from('coach_services').select('*').eq('id', engagement.coach_service_id).maybeSingle()
        : Promise.resolve({ data: null }),
      engagement.requester_user_id
        ? service.from('profiles').select('id, display_name, avatar_url, bio').eq('id', engagement.requester_user_id).maybeSingle()
        : Promise.resolve({ data: null }),
      engagement.review_order_id
        ? service
            .from('review_orders')
            .select('id, status, amount_cents, currency, payout_status, refund_reason, paid_at, refunded_at')
            .eq('id', engagement.review_order_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      service.from('engagement_assets').select('*').eq('engagement_request_id', engagement.id).order('sort_order', { ascending: true }),
      service.from('engagement_responses').select('*').eq('engagement_request_id', engagement.id).order('created_at', { ascending: false }),
      service.from('engagement_status_events').select('*').eq('engagement_request_id', engagement.id).order('created_at', { ascending: true })
    ]);

  return json(200, {
    data: {
      ...engagement,
      coach_service: coachService,
      requester,
      review_order: reviewOrder,
      engagement_assets: engagementAssets ?? [],
      engagement_responses: engagementResponses ?? [],
      engagement_status_events: engagementStatusEvents ?? []
    }
  });
});

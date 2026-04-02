import { createServiceClient } from '../_shared/client.ts';
import { parseJson, requireUser } from '../_shared/guard.ts';
import { badRequest, json } from '../_shared/http.ts';

type Payload = { engagementRequestId?: string };

Deno.serve(async (req) => {
  const auth = await requireUser(req);
  if (auth instanceof Response) return auth;
  const body = req.method === 'GET' ? ({ engagementRequestId: new URL(req.url).searchParams.get('engagementRequestId') ?? undefined } satisfies Payload) : await parseJson<Payload>(req);
  if (body instanceof Response) return body;
  if (!body.engagementRequestId) return badRequest('Missing engagementRequestId', 'missing_engagement_request_id');

  const service = createServiceClient();
  const { data: engagement, error } = await service
    .from('engagement_requests')
    .select('id, requester_user_id, coach_service_id, coach_id, status, delivered_at, question_text, paid_at, accepted_at')
    .eq('id', body.engagementRequestId)
    .eq('requester_user_id', auth.user.id)
    .single();

  if (error || !engagement) return json(404, { error: 'Feedback package not found', code: 'feedback_not_found' });

  const [{ data: coachService }, { data: coach }, { data: engagementAssets }, { data: engagementResponses }, { data: engagementStatusEvents }] = await Promise.all([
    engagement.coach_service_id
      ? service.from('coach_services').select('id, title, service_type').eq('id', engagement.coach_service_id).maybeSingle()
      : Promise.resolve({ data: null }),
    service.from('coaches').select('id, user_id').eq('id', engagement.coach_id).maybeSingle(),
    service.from('engagement_assets').select('*').eq('engagement_request_id', engagement.id).order('sort_order', { ascending: true }),
    service.from('engagement_responses').select('*').eq('engagement_request_id', engagement.id).order('created_at', { ascending: false }),
    service.from('engagement_status_events').select('*').eq('engagement_request_id', engagement.id).order('created_at', { ascending: true })
  ]);

  return json(200, {
    data: {
      ...engagement,
      coach_service: coachService,
      coach,
      engagement_assets: engagementAssets ?? [],
      engagement_responses: engagementResponses ?? [],
      engagement_status_events: engagementStatusEvents ?? []
    }
  });
});

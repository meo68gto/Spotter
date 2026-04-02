import { createServiceClient } from '../_shared/client.ts';
import { transitionEngagementStatus } from '../_shared/coach-commerce.ts';
import { parseJson, requireLegalConsent, requireUser } from '../_shared/guard.ts';
import { badRequest, json, unauthorized } from '../_shared/http.ts';
import { trackServerEvent } from '../_shared/telemetry.ts';

type Payload = { engagementRequestId?: string };

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
  if (!coach) return unauthorized('Only coaches can accept engagements', 'coach_required');

  const { data: engagement, error } = await service
    .from('engagement_requests')
    .select('id, coach_id, status, review_order_id, engagement_mode, scheduled_time')
    .eq('id', body.engagementRequestId)
    .eq('coach_id', coach.id)
    .maybeSingle();

  if (error || !engagement) return badRequest('Engagement not found', 'engagement_not_found');
  if (!['queued', 'paid', 'awaiting_expert'].includes(engagement.status)) {
    return badRequest('Engagement not in accept state', 'invalid_status');
  }

  const now = new Date();
  const deliveryDeadline = new Date(now.getTime() + 48 * 60 * 60 * 1000).toISOString();
  const accepted = await transitionEngagementStatus({
    engagementRequestId: engagement.id,
    toStatus: engagement.engagement_mode === 'video_call' && engagement.scheduled_time ? 'scheduled' : 'accepted',
    actorUserId: auth.user.id,
    payload: { eventType: 'coach_accepted' },
    extraFields: {
      accepted_at: now.toISOString(),
      delivery_deadline_at: deliveryDeadline
    }
  });

  if (engagement.review_order_id) {
    await service
      .from('review_orders')
      .update({ payout_status: 'held' })
      .eq('id', engagement.review_order_id);
  }

  await trackServerEvent('engagement_accepted', auth.user.id, { engagement_request_id: engagement.id });

  return json(200, { data: { id: accepted.id, status: accepted.status } });
});

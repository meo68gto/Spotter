import { createServiceClient } from '../_shared/client.ts';
import { refundOrderWithTransferReversal, transitionEngagementStatus } from '../_shared/coach-commerce.ts';
import { ensureCoachForUser } from '../_shared/engagements.ts';
import { parseJson, requireUser } from '../_shared/guard.ts';
import { badRequest, json, unauthorized } from '../_shared/http.ts';

type Payload = {
  engagementRequestId?: string;
  action?: 'accept' | 'decline' | 'start_review' | 'mark_scheduled' | 'mark_in_call';
  scheduledTime?: string;
};

Deno.serve(async (req) => {
  const auth = await requireUser(req);
  if (auth instanceof Response) return auth;
  const body = await parseJson<Payload>(req);
  if (body instanceof Response) return body;
  if (!body.engagementRequestId || !body.action) return badRequest('Missing required fields', 'missing_required_fields');

  const coach = await ensureCoachForUser(auth.user.id);
  if (!coach) return unauthorized('Only coaches can transition requests', 'coach_required');

  const service = createServiceClient();
  const { data: engagement } = await service
    .from('engagement_requests')
    .select('id, coach_id, status, review_order_id')
    .eq('id', body.engagementRequestId)
    .eq('coach_id', coach.id)
    .single();

  if (!engagement) return badRequest('Engagement request not found', 'engagement_not_found');

  if (body.action === 'decline' && engagement.review_order_id) {
    await transitionEngagementStatus({
      engagementRequestId: engagement.id,
      toStatus: 'refund_pending',
      actorUserId: auth.user.id,
      payload: { eventType: 'coach_declined' }
    });
    await refundOrderWithTransferReversal({
      reviewOrderId: engagement.review_order_id,
      reason: 'coach_declined',
      requestStatus: 'refunded'
    });
    return json(200, { data: { id: engagement.id, status: 'refunded' } });
  }

  const nextStatus =
    body.action === 'accept'
      ? 'accepted'
      : body.action === 'start_review'
        ? 'in_review'
        : body.action === 'mark_scheduled'
          ? 'scheduled'
          : body.action === 'mark_in_call'
            ? 'in_call'
            : 'declined';

  const data = await transitionEngagementStatus({
    engagementRequestId: engagement.id,
    toStatus: nextStatus,
    actorUserId: auth.user.id,
    payload: { eventType: `coach_${body.action}` },
    extraFields: body.action === 'mark_scheduled' && body.scheduledTime ? { scheduled_time: body.scheduledTime } : {}
  });

  return json(200, { data: { id: data.id, status: data.status } });
});

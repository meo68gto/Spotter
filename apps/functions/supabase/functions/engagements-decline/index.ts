import { createServiceClient } from '../_shared/client.ts';
import { refundOrderWithTransferReversal, transitionEngagementStatus } from '../_shared/coach-commerce.ts';
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
  if (!coach) return unauthorized('Only coaches can decline engagements', 'coach_required');

  const { data: engagement, error } = await service
    .from('engagement_requests')
    .select('id, coach_id, status, review_order_id')
    .eq('id', body.engagementRequestId)
    .eq('coach_id', coach.id)
    .maybeSingle();

  if (error || !engagement) return badRequest('Engagement not found', 'engagement_not_found');

  await transitionEngagementStatus({
    engagementRequestId: engagement.id,
    toStatus: engagement.review_order_id ? 'refund_pending' : 'declined',
    actorUserId: auth.user.id,
    payload: { eventType: 'coach_declined' },
    extraFields: { closed_reason: 'coach_declined' }
  });

  if (engagement.review_order_id) {
    await refundOrderWithTransferReversal({
      reviewOrderId: engagement.review_order_id,
      reason: 'coach_declined',
      requestStatus: 'refunded'
    });
  }

  await trackServerEvent('engagement_declined', auth.user.id, { engagement_request_id: engagement.id });
  return json(200, { data: { id: engagement.id, status: 'declined' } });
});

import { createServiceClient } from '../_shared/client.ts';
import { parseJson, requireLegalConsent, requireUser } from '../_shared/guard.ts';
import { badRequest, json } from '../_shared/http.ts';

type Payload = { engagementRequestId?: string };

Deno.serve(async (req) => {
  const auth = await requireUser(req);
  if (auth instanceof Response) return auth;

  const legal = await requireLegalConsent(auth.user.id);
  if (legal) return legal;

  const body = await parseJson<Payload>(req);
  if (body instanceof Response) return body;
  if (!body.engagementRequestId) return badRequest('Missing engagementRequestId', 'missing_engagement_request_id');

  const service = createServiceClient();

  const { data: engagement, error: engagementError } = await service
    .from('engagement_requests')
    .select('id, requester_user_id, status, review_order_id')
    .eq('id', body.engagementRequestId)
    .eq('requester_user_id', auth.user.id)
    .maybeSingle();

  if (engagementError || !engagement) return badRequest('Engagement not found', 'engagement_not_found');

  if (engagement.review_order_id) {
    const { data: order } = await service
      .from('review_orders')
      .select('id, status, buyer_user_id')
      .eq('id', engagement.review_order_id)
      .eq('buyer_user_id', auth.user.id)
      .maybeSingle();

    if (!order) return badRequest('Order not found', 'order_not_found');
    if (!['paid', 'processing'].includes(order.status)) {
      return badRequest('Order is not paid yet', 'order_not_paid');
    }
  }

  const nextStatus = engagement.status === 'created' ? 'awaiting_expert' : engagement.status;
  const { data, error } = await service
    .from('engagement_requests')
    .update({ status: nextStatus })
    .eq('id', engagement.id)
    .select('id, status')
    .single();

  if (error) return json(500, { error: error.message, code: 'engagement_publish_failed' });
  return json(200, { data });
});

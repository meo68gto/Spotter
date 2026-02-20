import { createServiceClient } from '../_shared/client.ts';
import { parseJson, requireUser } from '../_shared/guard.ts';
import { badRequest, json } from '../_shared/http.ts';

type Payload = {
  rescheduleRequestId?: string;
  accepted?: boolean;
  declinedReason?: string;
};

Deno.serve(async (req) => {
  const auth = await requireUser(req);
  if (auth instanceof Response) return auth;
  const body = await parseJson<Payload>(req);
  if (body instanceof Response) return body;

  if (!body.rescheduleRequestId || typeof body.accepted !== 'boolean') {
    return badRequest('Missing required fields', 'missing_required_fields');
  }

  const service = createServiceClient();
  const { data: rr } = await service
    .from('reschedule_requests')
    .select('id, engagement_request_id, proposed_time, requested_by_user_id, status')
    .eq('id', body.rescheduleRequestId)
    .maybeSingle();

  if (!rr) return badRequest('Reschedule request not found', 'reschedule_not_found');
  if (rr.status !== 'pending') return badRequest('Reschedule already resolved', 'reschedule_already_resolved');

  const { data: engagement } = await service
    .from('engagement_requests')
    .select('id, requester_user_id, coach_id')
    .eq('id', rr.engagement_request_id)
    .maybeSingle();
  if (!engagement) return badRequest('Engagement not found', 'engagement_not_found');

  const { data: coach } = await service.from('coaches').select('user_id').eq('id', engagement.coach_id).maybeSingle();
  const counterparts = [engagement.requester_user_id, coach?.user_id].filter(Boolean);
  if (!counterparts.includes(auth.user.id) || auth.user.id === rr.requested_by_user_id) {
    return badRequest('Only counterpart can respond', 'counterpart_required');
  }

  if (body.accepted) {
    await service
      .from('engagement_requests')
      .update({ scheduled_time: rr.proposed_time })
      .eq('id', engagement.id);

    await service
      .from('reschedule_requests')
      .update({ status: 'accepted' })
      .eq('id', rr.id);

    return json(200, { data: { id: rr.id, status: 'accepted' } });
  }

  await service
    .from('reschedule_requests')
    .update({ status: 'declined', declined_reason: body.declinedReason ?? null })
    .eq('id', rr.id);

  await service
    .from('engagement_requests')
    .update({ status: 'cancelled' })
    .eq('id', engagement.id);

  const { data: order } = await service
    .from('review_orders')
    .select('id')
    .eq('engagement_request_id', engagement.id)
    .maybeSingle();
  if (order) {
    await service
      .from('review_orders')
      .update({ status: 'refunded', refunded_at: new Date().toISOString() })
      .eq('id', order.id);
  }

  return json(200, { data: { id: rr.id, status: 'declined' } });
});

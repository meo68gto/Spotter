import { createServiceClient } from '../_shared/client.ts';
import { cancelPaymentIntent } from '../_shared/engagements.ts';
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

  await service.from('engagement_requests').update({ status: 'declined' }).eq('id', engagement.id);

  if (engagement.review_order_id) {
    const { data: order } = await service
      .from('review_orders')
      .select('id, stripe_payment_intent_id')
      .eq('id', engagement.review_order_id)
      .maybeSingle();

    if (order?.stripe_payment_intent_id) {
      try {
        await cancelPaymentIntent(order.stripe_payment_intent_id);
      } catch {
        // no-op
      }
      await service
        .from('review_orders')
        .update({ status: 'cancelled', authorization_released_at: new Date().toISOString() })
        .eq('id', order.id);
    }
  }

  await trackServerEvent('engagement_declined', auth.user.id, { engagement_request_id: engagement.id });
  return json(200, { data: { id: engagement.id, status: 'declined' } });
});

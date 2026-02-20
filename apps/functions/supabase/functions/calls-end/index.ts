import { createServiceClient } from '../_shared/client.ts';
import { billableMinutesFromSeconds, capturePaymentIntent } from '../_shared/engagements.ts';
import { parseJson, requireLegalConsent, requireUser } from '../_shared/guard.ts';
import { badRequest, json } from '../_shared/http.ts';
import { trackServerEvent } from '../_shared/telemetry.ts';

type Payload = { engagementRequestId?: string; durationSeconds?: number };

Deno.serve(async (req) => {
  const auth = await requireUser(req);
  if (auth instanceof Response) return auth;

  const body = await parseJson<Payload>(req);
  if (body instanceof Response) return body;
  if (!body.engagementRequestId) return badRequest('Missing engagementRequestId', 'missing_engagement_request_id');
  const legal = await requireLegalConsent(auth.user.id);
  if (legal) return legal;

  const service = createServiceClient();
  const { data: engagement, error: engagementError } = await service
    .from('engagement_requests')
    .select('id, review_order_id')
    .eq('id', body.engagementRequestId)
    .maybeSingle();

  if (engagementError || !engagement) return badRequest('Engagement not found', 'engagement_not_found');

  const { data: callSession, error } = await service
    .from('video_call_sessions')
    .select('id, started_at')
    .eq('engagement_request_id', body.engagementRequestId)
    .single();

  if (error || !callSession) return badRequest('Call session not found', 'call_session_not_found');

  const durationSeconds = body.durationSeconds ?? Math.max(0, Math.floor((Date.now() - new Date(callSession.started_at ?? new Date().toISOString()).getTime()) / 1000));
  const billableMinutes = billableMinutesFromSeconds(durationSeconds);

  await service
    .from('video_call_sessions')
    .update({ ended_at: new Date().toISOString(), duration_seconds: durationSeconds, billable_minutes: billableMinutes })
    .eq('id', callSession.id);

  await service
    .from('engagement_requests')
    .update({ status: 'completed', completed_at: new Date().toISOString() })
    .eq('id', engagement.id);

  if (engagement.review_order_id) {
    const { data: order } = await service.from('review_orders').select('id, stripe_payment_intent_id').eq('id', engagement.review_order_id).maybeSingle();
    if (order?.stripe_payment_intent_id) {
      try {
        await capturePaymentIntent(order.stripe_payment_intent_id);
        await service.from('review_orders').update({ status: 'paid', paid_at: new Date().toISOString() }).eq('id', order.id);
      } catch {
        await service.from('review_orders').update({ status: 'failed' }).eq('id', order.id);
      }
    }
  }

  await trackServerEvent('video_call_ended', auth.user.id, {
    engagement_request_id: body.engagementRequestId,
    duration_seconds: durationSeconds,
    billable_minutes: billableMinutes
  });
  await trackServerEvent('video_call_billed', auth.user.id, {
    engagement_request_id: body.engagementRequestId,
    billable_minutes: billableMinutes
  });

  return json(200, { data: { durationSeconds, billableMinutes } });
});

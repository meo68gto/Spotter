import { createServiceClient } from '../_shared/client.ts';
import { addEngagementStatusEvent, createServiceBackedOrder } from '../_shared/coach-commerce.ts';
import { createPaymentAuthorization, mapStripeIntentToOrderStatus } from '../_shared/engagements.ts';
import { parseJson, requireLegalConsent, requireUser } from '../_shared/guard.ts';
import { badRequest, json } from '../_shared/http.ts';
import { getRuntimeEnv } from '../_shared/env.ts';

type Payload = {
  coachId?: string;
  coachServiceId?: string;
  questionText?: string;
  buyerNote?: string;
  requestDetails?: Record<string, unknown>;
  scheduledTime?: string;
  sourceSurface?: string;
  sourceMatchId?: string;
  sourceIntroRequestId?: string;
  sourceConnectionUserId?: string;
};

Deno.serve(async (req) => {
  const auth = await requireUser(req);
  if (auth instanceof Response) return auth;
  const legal = await requireLegalConsent(auth.user.id);
  if (legal) return legal;

  const body = await parseJson<Payload>(req);
  if (body instanceof Response) return body;
  if (!body.coachId || !body.coachServiceId || !body.questionText?.trim()) {
    return badRequest('Missing required fields', 'missing_required_fields');
  }

  const service = createServiceClient();
  const env = getRuntimeEnv();

  const { data: coachService, error: serviceError } = await service
    .from('coach_services')
    .select('id, coach_id, service_type, price_cents, currency, requires_schedule, turnaround_hours')
    .eq('id', body.coachServiceId)
    .eq('coach_id', body.coachId)
    .eq('active', true)
    .single();

  if (serviceError || !coachService) return badRequest('Coach service not found', 'coach_service_not_found');
  if (coachService.requires_schedule && !body.scheduledTime) {
    return badRequest('Scheduled time is required', 'scheduled_time_required');
  }

  const engagementMode =
    coachService.service_type === 'live_video_call'
      ? 'video_call'
      : coachService.service_type === 'text_qna'
        ? 'text_answer'
        : 'video_answer';

  const order = await createServiceBackedOrder({
    buyerUserId: auth.user.id,
    coachId: body.coachId,
    coachServiceId: coachService.id,
    amountCents: coachService.price_cents,
    currency: coachService.currency,
    sourceSurface: body.sourceSurface,
    feeBps: env.stripePlatformFeeBps
  });

  const acceptedDeadlineAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const deliveryDeadlineAt = coachService.turnaround_hours
    ? new Date(Date.now() + coachService.turnaround_hours * 60 * 60 * 1000).toISOString()
    : null;

  const { data, error } = await service
    .from('engagement_requests')
    .insert({
      requester_user_id: auth.user.id,
      coach_id: body.coachId,
      coach_service_id: coachService.id,
      engagement_mode: engagementMode,
      question_text: body.questionText.trim(),
      scheduled_time: body.scheduledTime ?? null,
      status: 'draft',
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      review_order_id: order.id,
      buyer_note: body.buyerNote ?? null,
      request_details: body.requestDetails ?? {},
      source_surface: body.sourceSurface ?? 'direct',
      source_match_id: body.sourceMatchId ?? null,
      source_intro_request_id: body.sourceIntroRequestId ?? null,
      source_connection_user_id: body.sourceConnectionUserId ?? null,
      accepted_deadline_at: acceptedDeadlineAt,
      delivery_deadline_at: deliveryDeadlineAt
    })
    .select('*')
    .single();

  if (error || !data) return json(500, { error: error?.message ?? 'Request creation failed', code: 'coach_request_create_failed' });

  await service
    .from('review_orders')
    .update({ engagement_request_id: data.id })
    .eq('id', order.id);

  await addEngagementStatusEvent({
    engagementRequestId: data.id,
    eventType: 'draft_created',
    actorUserId: auth.user.id,
    toStatus: 'draft',
    payload: { coachServiceId: coachService.id, sourceSurface: body.sourceSurface ?? 'direct' }
  });

  const { data: coach } = await service
    .from('coaches')
    .select('stripe_account_id')
    .eq('id', body.coachId)
    .maybeSingle();

  let clientSecret: string | null = null;
  try {
    const intent = await createPaymentAuthorization({
      amountCents: order.amount_cents,
      currency: order.currency,
      customerEmail: auth.user.email ?? undefined,
      orderId: order.id,
      coachStripeAccountId: coach?.stripe_account_id ?? undefined,
      applicationFeeCents: order.platform_fee_cents,
      onBehalfOf: coach?.stripe_account_id ?? undefined
    });
    clientSecret = intent.client_secret;
    await service
      .from('review_orders')
      .update({ stripe_payment_intent_id: intent.id, status: mapStripeIntentToOrderStatus(intent.status) })
      .eq('id', order.id);
  } catch (paymentError) {
    await service.from('review_orders').update({ status: 'failed' }).eq('id', order.id);
    return json(500, {
      error: paymentError instanceof Error ? paymentError.message : 'Unable to create payment authorization',
      code: 'coach_request_payment_create_failed'
    });
  }

  return json(200, { data: { request: data, order, clientSecret } });
});

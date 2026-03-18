import { createServiceClient } from '../_shared/client.ts';
import { createPaymentAuthorization, hashToken, mapStripeIntentToOrderStatus, randomToken } from '../_shared/engagements.ts';
import { parseJson, requireLegalConsent, requireUser } from '../_shared/guard.ts';
import { badRequest, json } from '../_shared/http.ts';
import { stripeRequest } from '../_shared/payments.ts';

type Payload = {
  coachId?: string;
  engagementMode?: 'text_answer' | 'video_answer' | 'video_call';
  questionText?: string;
  attachmentUrls?: string[];
  scheduledTime?: string;
  guestEmail?: string;
  publishAfterPayment?: boolean;
  /**
   * Optional idempotency key. If provided, will return existing engagement if already created.
   * Should be unique per booking attempt (e.g., coachId-timestamp).
   */
  idempotencyKey?: string;
};

Deno.serve(async (req) => {
  const body = await parseJson<Payload>(req);
  if (body instanceof Response) return body;

  if (!body.coachId || !body.engagementMode || !body.questionText?.trim()) {
    return badRequest('Missing required fields', 'missing_required_fields');
  }

  const service = createServiceClient();

  // Idempotency check: if idempotencyKey provided, check for existing engagement
  if (body.idempotencyKey) {
    const { data: existing } = await service
      .from('engagement_requests')
      .select('id, status, review_order_id')
      .eq('coach_id', body.coachId)
      .ilike('question_text', body.questionText.trim()) // approximate match
      .gte('created_at', new Date(Date.now() - 5 * 60 * 1000).toISOString()) // within 5 min
      .maybeSingle();

    if (existing) {
      // Check if order exists
      const { data: order } = existing.review_order_id
        ? await service
            .from('review_orders')
            .select('id, status, stripe_payment_intent_id, stripe_payment_intent_id')
            .eq('id', existing.review_order_id)
            .single()
        : null;

      // Re-create client secret if needed
      let clientSecret: string | null = null;
      if (order && order.stripe_payment_intent_id) {
        // Fetch fresh client secret from Stripe
        try {
          const intent = await stripeRequest<{ client_secret: string }>(
            `/payment_intents/${order.stripe_payment_intent_id}`,
            'GET'
          );
          clientSecret = intent.client_secret;
        } catch {
          // Intent may be old/expired, proceed without it
        }
      }

      return json(200, {
        data: {
          request: existing,
          order: order ? { id: order.id, status: order.status } : undefined,
          clientSecret,
          isExisting: true
        }
      });
    }
  }

  const { data: coach, error: coachError } = await service
    .from('coaches')
    .select('id, user_id, stripe_account_id')
    .eq('id', body.coachId)
    .maybeSingle();

  if (coachError || !coach) return badRequest('Coach not found', 'coach_not_found');

  const { data: pricing } = await service
    .from('expert_pricing')
    .select('price_cents, currency, per_minute_rate_cents')
    .eq('coach_id', coach.id)
    .eq('engagement_mode', body.engagementMode)
    .eq('active', true)
    .maybeSingle();

  if (!pricing) return badRequest('Pricing unavailable', 'pricing_unavailable');

  const auth = await requireUser(req);

  let requesterUserId: string | null = null;
  let guestSessionId: string | null = null;
  let buyerEmail: string | undefined;

  if (auth instanceof Response) {
    if (!body.guestEmail) return auth;

    const token = randomToken();
    const tokenHash = await hashToken(token);
    const { data: guestSession, error: guestError } = await service
      .from('guest_checkout_sessions')
      .insert({
        email: body.guestEmail,
        verification_token_hash: tokenHash,
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
      })
      .select('id, email')
      .single();

    if (guestError || !guestSession) {
      return json(500, { error: guestError?.message ?? 'Guest checkout failed', code: 'guest_checkout_create_failed' });
    }
    guestSessionId = guestSession.id;
    buyerEmail = guestSession.email;

    const { data: reqRow, error: reqErr } = await service
      .from('engagement_requests')
      .insert({
        guest_checkout_session_id: guestSessionId,
        coach_id: coach.id,
        engagement_mode: body.engagementMode,
        question_text: body.questionText.trim(),
        attachment_urls: body.attachmentUrls ?? [],
        scheduled_time: body.scheduledTime ?? null,
        status: 'awaiting_expert',
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        moderation_status: 'pending'
      })
      .select('*')
      .single();

    if (reqErr || !reqRow) return json(500, { error: reqErr?.message ?? 'Create failed', code: 'engagement_create_failed' });

    return json(200, {
      data: {
        ...reqRow,
        guestVerificationToken: token
      }
    });
  } else {
    requesterUserId = auth.user.id;
    buyerEmail = auth.user.email ?? undefined;
    const legal = await requireLegalConsent(requesterUserId);
    if (legal) return legal;
  }

  const { data: order, error: orderError } = await service
    .from('review_orders')
    .insert({
      buyer_user_id: requesterUserId,
      coach_id: coach.id,
      video_submission_id: null,
      amount_cents: pricing.price_cents,
      currency: pricing.currency,
      platform_fee_bps: 2000,
      platform_fee_cents: Math.floor(pricing.price_cents * 0.2),
      coach_payout_cents: Math.ceil(pricing.price_cents * 0.8),
      status: 'created',
      authorization_expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    })
    .select('*')
    .single();

  if (orderError || !order) return json(500, { error: orderError?.message ?? 'Order create failed', code: 'order_create_failed' });

  const { data: request, error: requestError } = await service
    .from('engagement_requests')
    .insert({
      requester_user_id: requesterUserId,
      coach_id: coach.id,
      engagement_mode: body.engagementMode,
      question_text: body.questionText.trim(),
      attachment_urls: body.attachmentUrls ?? [],
      scheduled_time: body.scheduledTime ?? null,
      status: body.publishAfterPayment ? 'created' : 'awaiting_expert',
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      moderation_status: 'pending',
      review_order_id: order.id
    })
    .select('*')
    .single();

  if (requestError || !request) return json(500, { error: requestError?.message ?? 'Create failed', code: 'engagement_create_failed' });

  const { data: updatedOrder } = await service
    .from('review_orders')
    .update({ engagement_request_id: request.id })
    .eq('id', order.id)
    .select('id')
    .single();

  let clientSecret: string | null = null;
  try {
    const intent = await createPaymentAuthorization({
      amountCents: order.amount_cents,
      currency: order.currency,
      customerEmail: buyerEmail,
      orderId: order.id,
      coachStripeAccountId: coach.stripe_account_id ?? undefined,
      applicationFeeCents: order.platform_fee_cents
    });
    clientSecret = intent.client_secret;
    await service
      .from('review_orders')
      .update({ stripe_payment_intent_id: intent.id, status: mapStripeIntentToOrderStatus(intent.status) })
      .eq('id', order.id);
  } catch (error) {
    await service.from('review_orders').update({ status: 'failed' }).eq('id', order.id);
    return json(500, { error: error instanceof Error ? error.message : 'Authorization failed', code: 'payment_auth_failed' });
  }

  return json(200, { data: { request, order: updatedOrder, clientSecret } });
});

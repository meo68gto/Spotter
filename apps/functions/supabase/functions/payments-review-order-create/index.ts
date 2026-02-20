import { createServiceClient } from '../_shared/client.ts';
import { getRuntimeEnv } from '../_shared/env.ts';
import { parseJson, requireUser } from '../_shared/guard.ts';
import { badRequest, json } from '../_shared/http.ts';
import { computeFees, ensureLiveKeyForProd, stripeRequest } from '../_shared/payments.ts';

type Payload = {
  coachId?: string;
  coachReviewProductId?: string;
  videoSubmissionId?: string;
};

interface StripePaymentIntent {
  id: string;
  status: string;
  client_secret: string;
}

Deno.serve(async (req) => {
  const auth = await requireUser(req);
  if (auth instanceof Response) return auth;

  const body = await parseJson<Payload>(req);
  if (body instanceof Response) return body;

  if (!body.coachId || !body.coachReviewProductId || !body.videoSubmissionId) {
    return badRequest('Missing required fields', 'missing_required_fields');
  }

  ensureLiveKeyForProd();
  const env = getRuntimeEnv();
  const service = createServiceClient();

  const { data: product, error: productErr } = await service
    .from('coach_review_products')
    .select('id, coach_id, price_cents, currency, active')
    .eq('id', body.coachReviewProductId)
    .eq('coach_id', body.coachId)
    .eq('active', true)
    .single();

  if (productErr || !product) {
    return badRequest('Coach review product not found', 'product_not_found');
  }

  const { data: coach, error: coachErr } = await service
    .from('coaches')
    .select('id, stripe_account_id, onboarding_status')
    .eq('id', body.coachId)
    .single();

  if (coachErr || !coach?.stripe_account_id) {
    return badRequest('Coach payout account is not ready', 'coach_payout_not_ready');
  }

  const { data: submission, error: submissionErr } = await service
    .from('video_submissions')
    .select('id, user_id')
    .eq('id', body.videoSubmissionId)
    .eq('user_id', auth.user.id)
    .single();

  if (submissionErr || !submission) {
    return badRequest('Video submission not found', 'video_submission_not_found');
  }

  const { platformFeeCents, coachPayoutCents } = computeFees(product.price_cents, env.stripePlatformFeeBps);

  const { data: createdOrder, error: orderErr } = await service
    .from('review_orders')
    .insert({
      buyer_user_id: auth.user.id,
      coach_id: body.coachId,
      coach_review_product_id: product.id,
      video_submission_id: body.videoSubmissionId,
      amount_cents: product.price_cents,
      currency: product.currency,
      platform_fee_bps: env.stripePlatformFeeBps,
      platform_fee_cents: platformFeeCents,
      coach_payout_cents: coachPayoutCents,
      status: 'created'
    })
    .select('id')
    .single();

  if (orderErr || !createdOrder) {
    return json(500, { error: orderErr?.message ?? 'Order create failed', code: 'review_order_create_failed' });
  }

  try {
    const intent = await stripeRequest<StripePaymentIntent>('/payment_intents', 'POST', {
      amount: product.price_cents,
      currency: product.currency,
      'automatic_payment_methods[enabled]': true,
      application_fee_amount: platformFeeCents,
      'transfer_data[destination]': coach.stripe_account_id,
      'metadata[order_id]': createdOrder.id,
      'metadata[video_submission_id]': body.videoSubmissionId
    });

    const mappedStatus =
      intent.status === 'succeeded'
        ? 'paid'
        : intent.status === 'processing'
          ? 'processing'
          : intent.status === 'requires_payment_method'
            ? 'requires_payment_method'
            : 'created';

    const { data: orderUpdate, error: updateErr } = await service
      .from('review_orders')
      .update({
        stripe_payment_intent_id: intent.id,
        status: mappedStatus,
        paid_at: mappedStatus === 'paid' ? new Date().toISOString() : null
      })
      .eq('id', createdOrder.id)
      .select(
        'id, status, amount_cents, currency, platform_fee_cents, coach_payout_cents, stripe_payment_intent_id, paid_at'
      )
      .single();

    if (updateErr || !orderUpdate) {
      return json(500, { error: updateErr?.message ?? 'Order update failed', code: 'review_order_update_failed' });
    }

    return json(200, {
      data: {
        ...orderUpdate,
        clientSecret: intent.client_secret
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Payment intent creation failed';
    await service.from('review_orders').update({ status: 'failed' }).eq('id', createdOrder.id);
    return json(500, { error: message, code: 'payment_intent_create_failed' });
  }
});

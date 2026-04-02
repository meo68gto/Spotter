import { createServiceClient } from './client.ts';
import { computeFees, stripeRequest } from './payments.ts';

export const addEngagementStatusEvent = async (params: {
  engagementRequestId: string;
  eventType: string;
  fromStatus?: string | null;
  toStatus?: string | null;
  actorUserId?: string | null;
  payload?: Record<string, unknown>;
}) => {
  const service = createServiceClient();
  await service.from('engagement_status_events').insert({
    engagement_request_id: params.engagementRequestId,
    event_type: params.eventType,
    from_status: params.fromStatus ?? null,
    to_status: params.toStatus ?? null,
    actor_user_id: params.actorUserId ?? null,
    payload: params.payload ?? {}
  });
};

export const transitionEngagementStatus = async (params: {
  engagementRequestId: string;
  toStatus: string;
  actorUserId?: string | null;
  payload?: Record<string, unknown>;
  extraFields?: Record<string, unknown>;
}) => {
  const service = createServiceClient();
  const { data: current } = await service
    .from('engagement_requests')
    .select('id, status')
    .eq('id', params.engagementRequestId)
    .single();

  if (!current) {
    throw new Error('Engagement request not found');
  }

  const updates: Record<string, unknown> = {
    status: params.toStatus,
    updated_at: new Date().toISOString(),
    ...(params.extraFields ?? {})
  };

  if (params.toStatus === 'delivered' && !updates.delivered_at) {
    updates.delivered_at = new Date().toISOString();
  }

  const { data, error } = await service
    .from('engagement_requests')
    .update(updates)
    .eq('id', params.engagementRequestId)
    .select('*')
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? 'Failed to update engagement request');
  }

  await addEngagementStatusEvent({
    engagementRequestId: params.engagementRequestId,
    eventType: params.payload?.eventType as string | undefined ?? 'status_changed',
    fromStatus: current.status,
    toStatus: params.toStatus,
    actorUserId: params.actorUserId ?? null,
    payload: params.payload
  });

  return data;
};

export const refundOrderWithTransferReversal = async (params: {
  reviewOrderId: string;
  reason?: string;
  requestStatus?: string;
}) => {
  const service = createServiceClient();
  const { data: order } = await service
    .from('review_orders')
    .select('id, engagement_request_id, stripe_payment_intent_id, status')
    .eq('id', params.reviewOrderId)
    .single();

  if (!order) {
    throw new Error('Review order not found');
  }

  const resolvedAt = new Date().toISOString();

  if (order.stripe_payment_intent_id && !order.stripe_payment_intent_id.startsWith('pi_local_')) {
    await stripeRequest('/refunds', 'POST', {
      payment_intent: order.stripe_payment_intent_id,
      reason: 'requested_by_customer',
      reverse_transfer: true,
      refund_application_fee: true
    });
  }

  await service
    .from('review_orders')
    .update({
      status: 'refunded',
      refunded_at: resolvedAt,
      refund_reason: params.reason ?? null,
      payout_status: 'reversed'
    })
    .eq('id', order.id);

  if (order.engagement_request_id && params.requestStatus) {
    await transitionEngagementStatus({
      engagementRequestId: order.engagement_request_id,
      toStatus: params.requestStatus,
      payload: { reason: params.reason ?? null, eventType: 'refund_processed' },
      extraFields: { closed_reason: params.reason ?? 'refunded' }
    });
  }

  return { id: order.id, refundedAt: resolvedAt };
};

export const createServiceBackedOrder = async (params: {
  buyerUserId: string;
  coachId: string;
  coachServiceId?: string | null;
  amountCents: number;
  currency: string;
  sourceSurface?: string;
  feeBps: number;
}) => {
  const service = createServiceClient();
  const { platformFeeCents, coachPayoutCents } = computeFees(params.amountCents, params.feeBps);
  const { data, error } = await service
    .from('review_orders')
    .insert({
      buyer_user_id: params.buyerUserId,
      coach_id: params.coachId,
      coach_service_id: params.coachServiceId ?? null,
      video_submission_id: null,
      amount_cents: params.amountCents,
      currency: params.currency,
      platform_fee_bps: params.feeBps,
      platform_fee_cents: platformFeeCents,
      coach_payout_cents: coachPayoutCents,
      source_surface: params.sourceSurface ?? null,
      status: 'created',
      payout_status: 'pending'
    })
    .select('*')
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? 'Failed to create review order');
  }

  return data;
};

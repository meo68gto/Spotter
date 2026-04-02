import { createServiceClient } from './client.ts';
import { billableMinutesFromSeconds, mapStripeIntentToOrderStatus } from './engagement-utils.ts';
import { getRuntimeEnv } from './env.ts';
import { stripeRequest } from './payments.ts';

export const hashToken = async (value: string) => {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
};

export const randomToken = () => crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');

export { mapStripeIntentToOrderStatus, billableMinutesFromSeconds };

export const ensureCoachForUser = async (userId: string) => {
  const service = createServiceClient();
  const { data, error } = await service.from('coaches').select('id, user_id').eq('user_id', userId).maybeSingle();
  if (error) throw new Error(error.message);
  return data;
};

export const createPaymentAuthorization = async (params: {
  amountCents: number;
  currency: string;
  customerEmail?: string;
  orderId: string;
  coachStripeAccountId?: string;
  applicationFeeCents: number;
  onBehalfOf?: string;
}) => {
  const env = getRuntimeEnv();
  if (!env.stripeSecretKey) {
    return {
      id: `pi_local_${crypto.randomUUID().replace(/-/g, '')}`,
      client_secret: `pi_local_secret_${crypto.randomUUID().replace(/-/g, '')}`,
      status: 'requires_payment_method'
    };
  }

  const intent = await stripeRequest<{ id: string; client_secret: string; status: string }>(
    '/payment_intents',
    'POST',
    {
      amount: params.amountCents,
      currency: params.currency,
      confirmation_method: 'automatic',
      'automatic_payment_methods[enabled]': true,
      receipt_email: params.customerEmail,
      application_fee_amount: params.applicationFeeCents,
      'transfer_data[destination]': params.coachStripeAccountId,
      on_behalf_of: params.onBehalfOf ?? params.coachStripeAccountId,
      'metadata[order_id]': params.orderId,
      'metadata[source]': 'engagements',
      'metadata[env]': env.flagEnvironment
    }
  );

  return intent;
};

export const capturePaymentIntent = async (paymentIntentId: string) => {
  const env = getRuntimeEnv();
  if (!env.stripeSecretKey || paymentIntentId.startsWith('pi_local_')) {
    return { id: paymentIntentId, status: 'succeeded' };
  }
  return await stripeRequest<{ id: string; status: string }>(`/payment_intents/${paymentIntentId}/capture`, 'POST', {});
};

export const cancelPaymentIntent = async (paymentIntentId: string) => {
  const env = getRuntimeEnv();
  if (!env.stripeSecretKey || paymentIntentId.startsWith('pi_local_')) {
    return { id: paymentIntentId, status: 'canceled' };
  }
  return await stripeRequest<{ id: string; status: string }>(`/payment_intents/${paymentIntentId}/cancel`, 'POST', {});
};

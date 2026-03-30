/**
 * Stripe Mock Utilities for API Tests
 * 
 * Replicates verifyStripeWebhookSignature() from _shared/payments.ts
 * so that webhook tests can run without accessing the Deno edge function source.
 */

/**
 * Verify a Stripe webhook signature using the same algorithm as the edge function.
 * 
 * Stripe signature header format: t=<timestamp>,v1=<signature>[,v0=<legacy>]
 * 
 * @param rawBody  - Raw request body string
 * @param signatureHeader - Value of the Stripe-Signature header
 * @param webhookSecret   - Webhook signing secret (whsec_...)
 * @returns true if signature is valid and timestamp is within tolerance
 */
export async function verifyStripeWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
  webhookSecret: string
): Promise<boolean> {
  if (!signatureHeader || !webhookSecret) return false;

  const pairs = signatureHeader.split(',').map((item) => item.split('='));
  const timestamp = pairs.find(([key]) => key === 't')?.[1];
  const signatures = pairs.filter(([key]) => key === 'v1').map(([, value]) => value);

  if (!timestamp || signatures.length === 0) return false;

  // Reject webhooks with timestamps older than 5 minutes (replay protection)
  const ageSeconds = Math.floor(Date.now() / 1000) - parseInt(timestamp, 10);
  if (isNaN(ageSeconds) || ageSeconds > 300 || ageSeconds < -5) return false;

  const payload = `${timestamp}.${rawBody}`;

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(webhookSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const digest = await crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(payload));
  const expected = Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');

  return signatures.includes(expected);
}

/**
 * Build a valid Stripe signature header for testing purposes.
 * 
 * @param payload   - JSON string body
 * @param secret    - Webhook signing secret
 * @param timestamp - Unix timestamp (defaults to now)
 */
export async function buildStripeSignatureHeader(
  payload: string,
  secret: string,
  timestamp: number = Math.floor(Date.now() / 1000)
): Promise<string> {
  const sigPayload = `${timestamp}.${payload}`;

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const digest = await crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(sigPayload));
  const signature = Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');

  return `t=${timestamp},v1=${signature}`;
}

/**
 * Mock Stripe event builder for testing webhook handlers.
 */
export interface MockStripeEvent {
  id: string;
  type: string;
  created: number;
  data: {
    object: Record<string, unknown>;
  };
}

export function buildMockCheckoutSessionCompleted(params: {
  sessionId?: string;
  customerId?: string;
  subscriptionId?: string;
  userId?: string;
  tierSlug?: string;
}): MockStripeEvent {
  return {
    id: `evt_mock_${Date.now()}`,
    type: 'checkout.session.completed',
    created: Math.floor(Date.now() / 1000),
    data: {
      object: {
        id: params.sessionId ?? 'cs_mock_123',
        customer: params.customerId ?? 'cus_mock_123',
        subscription: params.subscriptionId ?? 'sub_mock_123',
        payment_status: 'paid',
        status: 'complete',
        metadata: {
          userId: params.userId ?? '00000000-0000-0000-0000-000000000001',
          tierSlug: params.tierSlug ?? 'select',
          type: 'tier_upgrade',
        },
      },
    },
  };
}

export function buildMockInvoicePaymentSucceeded(params: {
  invoiceId?: string;
  customerId?: string;
  subscriptionId?: string;
  userId?: string;
  tierSlug?: string;
}): MockStripeEvent {
  return {
    id: `evt_mock_${Date.now()}`,
    type: 'invoice.payment_succeeded',
    created: Math.floor(Date.now() / 1000),
    data: {
      object: {
        id: params.invoiceId ?? 'in_mock_123',
        customer: params.customerId ?? 'cus_mock_123',
        subscription: params.subscriptionId ?? 'sub_mock_123',
        status: 'paid',
        amount_paid: 9900,
        currency: 'usd',
        metadata: {
          userId: params.userId ?? '00000000-0000-0000-0000-000000000001',
          tierSlug: params.tierSlug ?? 'select',
          type: 'tier_upgrade',
        },
      },
    },
  };
}

export function buildMockInvoicePaymentFailed(params: {
  invoiceId?: string;
  customerId?: string;
  subscriptionId?: string;
  userId?: string;
}): MockStripeEvent {
  return {
    id: `evt_mock_${Date.now()}`,
    type: 'invoice.payment_failed',
    created: Math.floor(Date.now() / 1000),
    data: {
      object: {
        id: params.invoiceId ?? 'in_mock_fail_123',
        customer: params.customerId ?? 'cus_mock_123',
        subscription: params.subscriptionId ?? 'sub_mock_123',
        status: 'payment_failed',
        metadata: {
          userId: params.userId ?? '00000000-0000-0000-0000-000000000001',
        },
      },
    },
  };
}

export function buildMockSubscriptionDeleted(params: {
  subscriptionId?: string;
  customerId?: string;
  userId?: string;
}): MockStripeEvent {
  return {
    id: `evt_mock_${Date.now()}`,
    type: 'customer.subscription.deleted',
    created: Math.floor(Date.now() / 1000),
    data: {
      object: {
        id: params.subscriptionId ?? 'sub_mock_deleted',
        customer: params.customerId ?? 'cus_mock_123',
        status: 'canceled',
        metadata: {
          userId: params.userId ?? '00000000-0000-0000-0000-000000000001',
        },
      },
    },
  };
}

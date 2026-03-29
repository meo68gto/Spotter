import { describe, expect, it } from 'vitest';
import { verifyStripeWebhookSignature } from '../supabase/functions/_shared/payments';

const signPayload = async (secret: string, payload: string) => {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const digest = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
};

describe('verifyStripeWebhookSignature', () => {
  it('accepts a valid Stripe-style signature header', async () => {
    const secret = 'whsec_test_secret';
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const rawBody = JSON.stringify({ id: 'evt_123', type: 'payment_intent.succeeded' });
    const signedPayload = `${timestamp}.${rawBody}`;
    const signature = await signPayload(secret, signedPayload);
    const header = `t=${timestamp},v1=${signature}`;

    const valid = await verifyStripeWebhookSignature(rawBody, header, secret);
    expect(valid).toBe(true);
  });

  it('rejects tampered payload', async () => {
    const secret = 'whsec_test_secret';
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const rawBody = JSON.stringify({ id: 'evt_123', type: 'payment_intent.succeeded' });
    const signedPayload = `${timestamp}.${rawBody}`;
    const signature = await signPayload(secret, signedPayload);
    const header = `t=${timestamp},v1=${signature}`;

    const tamperedBody = JSON.stringify({ id: 'evt_123', type: 'payment_intent.payment_failed' });
    const valid = await verifyStripeWebhookSignature(tamperedBody, header, secret);
    expect(valid).toBe(false);
  });

  it('rejects missing signature or secret', async () => {
    const rawBody = JSON.stringify({ id: 'evt_123' });
    await expect(verifyStripeWebhookSignature(rawBody, null, 'whsec_test_secret')).resolves.toBe(false);
    await expect(verifyStripeWebhookSignature(rawBody, 't=1,v1=abc', '')).resolves.toBe(false);
  });
});

/**
 * Payments Tests
 * Tests payment utility functions from _shared/payments.ts
 */

import { describe, it, expect, vi } from 'vitest';

// Mock env to avoid Deno runtime
vi.mock('../supabase/functions/_shared/env', () => ({
  getRuntimeEnv: () => ({
    supabaseUrl: 'https://test.supabase.co',
    supabaseAnonKey: 'test-anon',
    serviceRoleKey: 'test-service',
    stripeSecretKey: 'sk_test_123',
    flagEnvironment: 'development',
  }),
}));

// Mock the Supabase client module
vi.mock('../supabase/functions/_shared/client', () => ({
  createClient: vi.fn(),
  createAuthedClient: vi.fn(),
  createServiceClient: vi.fn(),
}));

import {
  computeFees,
  verifyStripeWebhookSignature,
} from '../supabase/functions/_shared/payments';

describe('computeFees', () => {
  it('calculates correct platform fee at 20% (2000 bps)', () => {
    // $25 order: 20% platform fee = $5
    const result = computeFees(2500, 2000);
    expect(result.platformFeeCents).toBe(500);
    expect(result.coachPayoutCents).toBe(2000);
  });

  it('handles 0 amount', () => {
    const result = computeFees(0, 2000);
    expect(result.platformFeeCents).toBe(0);
    expect(result.coachPayoutCents).toBe(0);
  });

  it('handles fractional cents by flooring platform fee', () => {
    // $10.01 = 1001 cents at 15% = 150.15 → floor to 150
    const result = computeFees(1001, 1500);
    expect(result.platformFeeCents).toBe(150);
    expect(result.coachPayoutCents).toBe(851);
  });

  it('ensures coach payout is never negative', () => {
    const result = computeFees(100, 10000);
    expect(result.platformFeeCents).toBe(100);
    expect(result.coachPayoutCents).toBe(0);
  });

  it('handles 0 bps (no platform fee)', () => {
    const result = computeFees(5000, 0);
    expect(result.platformFeeCents).toBe(0);
    expect(result.coachPayoutCents).toBe(5000);
  });

  it('handles 100% bps (all to platform)', () => {
    const result = computeFees(5000, 10000);
    expect(result.platformFeeCents).toBe(5000);
    expect(result.coachPayoutCents).toBe(0);
  });

  it('totals equal original amount', () => {
    const amount = 10000;
    const bps = 2000;
    const { platformFeeCents, coachPayoutCents } = computeFees(amount, bps);
    expect(platformFeeCents + coachPayoutCents).toBe(amount);
  });
});

describe('verifyStripeWebhookSignature', () => {
  // Helper to create a valid Stripe-style signature
  const signPayload = async (secret: string, payload: string, timestamp?: number) => {
    const ts = timestamp ?? Math.floor(Date.now() / 1000);
    const data = `${ts}.${payload}`;
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    const digest = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
    const signature = Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    return { ts: String(ts), signature };
  };

  it('accepts a valid Stripe-style signature header', async () => {
    const secret = 'whsec_test_secret';
    const body = JSON.stringify({ id: 'evt_123', type: 'payment_intent.succeeded' });
    const { ts, signature } = await signPayload(secret, body);
    const header = `t=${ts},v1=${signature}`;

    const valid = await verifyStripeWebhookSignature(body, header, secret);
    expect(valid).toBe(true);
  });

  it('rejects tampered payload', async () => {
    const secret = 'whsec_test_secret';
    const original = JSON.stringify({ id: 'evt_123', type: 'payment_intent.succeeded' });
    const { ts, signature } = await signPayload(secret, original);
    const header = `t=${ts},v1=${signature}`;

    const tampered = JSON.stringify({ id: 'evt_123', type: 'payment_intent.payment_failed' });
    const valid = await verifyStripeWebhookSignature(tampered, header, secret);
    expect(valid).toBe(false);
  });

  it('rejects wrong secret', async () => {
    const body = JSON.stringify({ id: 'evt_123' });
    const { ts, signature } = await signPayload('correct_secret', body);
    const header = `t=${ts},v1=${signature}`;

    const valid = await verifyStripeWebhookSignature(body, header, 'wrong_secret');
    expect(valid).toBe(false);
  });

  it('rejects missing signature header', async () => {
    const body = JSON.stringify({ id: 'evt_123' });
    const valid = await verifyStripeWebhookSignature(body, null, 'whsec_test_secret');
    expect(valid).toBe(false);
  });

  it('rejects empty secret', async () => {
    const body = JSON.stringify({ id: 'evt_123' });
    const valid = await verifyStripeWebhookSignature(body, 't=1,v1=abc', '');
    expect(valid).toBe(false);
  });

  it('rejects expired timestamp (> 5 minutes old)', async () => {
    const secret = 'whsec_test_secret';
    const body = JSON.stringify({ id: 'evt_123' });
    const oldTimestamp = Math.floor(Date.now() / 1000) - 400; // 400 seconds ago
    const { ts, signature } = await signPayload(secret, body, oldTimestamp);
    const header = `t=${ts},v1=${signature}`;

    const valid = await verifyStripeWebhookSignature(body, header, secret);
    expect(valid).toBe(false);
  });

  it('rejects malformed signature header', async () => {
    const body = JSON.stringify({ id: 'evt_123' });
    // Missing v1 signature
    const valid = await verifyStripeWebhookSignature(body, 't=12345', 'whsec_secret');
    expect(valid).toBe(false);
  });

  it('rejects header with no timestamp', async () => {
    const secret = 'whsec_test_secret';
    const body = JSON.stringify({ id: 'evt_123' });
    const { signature } = await signPayload(secret, body);
    // No t= part
    const header = `v1=${signature}`;

    const valid = await verifyStripeWebhookSignature(body, header, secret);
    expect(valid).toBe(false);
  });
});

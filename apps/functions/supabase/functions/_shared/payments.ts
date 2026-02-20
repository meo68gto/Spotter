import { getRuntimeEnv } from './env.ts';

const STRIPE_API_BASE = 'https://api.stripe.com/v1';

export const requireStripeSecret = (): string => {
  const key = getRuntimeEnv().stripeSecretKey;
  if (!key) {
    throw new Error('Missing STRIPE_SECRET_KEY');
  }
  return key;
};

export const ensureLiveKeyForProd = () => {
  const env = getRuntimeEnv();
  if (env.flagEnvironment === 'production' && !env.stripeSecretKey.startsWith('sk_live_')) {
    throw new Error('Production requires a Stripe live secret key');
  }
};

const encodeForm = (data: Record<string, string | number | boolean | undefined>) => {
  const body = new URLSearchParams();
  for (const [key, value] of Object.entries(data)) {
    if (value === undefined) continue;
    body.append(key, String(value));
  }
  return body;
};

export const stripeRequest = async <T>(
  path: string,
  method: 'GET' | 'POST',
  formData?: Record<string, string | number | boolean | undefined>
): Promise<T> => {
  const secret = requireStripeSecret();
  const response = await fetch(`${STRIPE_API_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${secret}`,
      ...(method === 'POST' ? { 'content-type': 'application/x-www-form-urlencoded' } : {})
    },
    body: method === 'POST' ? encodeForm(formData ?? {}) : undefined
  });

  const payload = await response.json();
  if (!response.ok) {
    const message = (payload?.error?.message as string | undefined) ?? `Stripe request failed: ${path}`;
    throw new Error(message);
  }
  return payload as T;
};

export const computeFees = (amountCents: number, feeBps: number) => {
  const platformFeeCents = Math.floor((amountCents * feeBps) / 10000);
  const coachPayoutCents = Math.max(amountCents - platformFeeCents, 0);
  return { platformFeeCents, coachPayoutCents };
};

export const verifyStripeWebhookSignature = async (
  rawBody: string,
  signatureHeader: string | null,
  webhookSecret: string
): Promise<boolean> => {
  if (!signatureHeader || !webhookSecret) return false;
  const pairs = signatureHeader.split(',').map((item) => item.split('='));
  const timestamp = pairs.find(([key]) => key === 't')?.[1];
  const signatures = pairs.filter(([key]) => key === 'v1').map(([, value]) => value);
  if (!timestamp || signatures.length === 0) return false;

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
};


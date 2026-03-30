const ADMIN_SESSION_COOKIE = 'admin_session';
const ADMIN_SESSION_TTL_SECONDS = 60 * 60 * 8;

type AdminSessionPayload = {
  email: string;
  exp: number;
  nonce: string;
};

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function getSessionSecret(): string | null {
  return process.env.ADMIN_SESSION_SECRET ?? process.env.ADMIN_DELETION_TOKEN ?? null;
}

function getExpectedAdminEmail(): string | null {
  return process.env.ADMIN_EMAIL ?? null;
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function fromBase64Url(value: string): Uint8Array {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function importSigningKey(secret: string) {
  return crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}

async function signValue(value: string, secret: string): Promise<string> {
  const key = await importSigningKey(secret);
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(value));
  return toBase64Url(new Uint8Array(signature));
}

export function getAdminSessionCookieName(): string {
  return ADMIN_SESSION_COOKIE;
}

export function getAdminSessionMaxAge(): number {
  return ADMIN_SESSION_TTL_SECONDS;
}

export async function createAdminSessionToken(email: string): Promise<string | null> {
  const secret = getSessionSecret();
  if (!secret) return null;

  const payload: AdminSessionPayload = {
    email,
    exp: Math.floor(Date.now() / 1000) + ADMIN_SESSION_TTL_SECONDS,
    nonce: crypto.randomUUID(),
  };

  const encodedPayload = toBase64Url(encoder.encode(JSON.stringify(payload)));
  const signature = await signValue(encodedPayload, secret);
  return `${encodedPayload}.${signature}`;
}

export async function verifyAdminSessionToken(token: string | null | undefined): Promise<boolean> {
  const secret = getSessionSecret();
  const expectedEmail = getExpectedAdminEmail();
  if (!token || !secret || !expectedEmail) return false;

  const [encodedPayload, signature] = token.split('.');
  if (!encodedPayload || !signature) return false;

  const expectedSignature = await signValue(encodedPayload, secret);
  if (signature !== expectedSignature) return false;

  try {
    const payload = JSON.parse(decoder.decode(fromBase64Url(encodedPayload))) as AdminSessionPayload;
    if (payload.email !== expectedEmail) return false;
    return payload.exp > Math.floor(Date.now() / 1000);
  } catch {
    return false;
  }
}

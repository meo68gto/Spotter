import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import {
  createAdminSessionToken,
  getAdminSessionCookieName,
  getAdminSessionMaxAge,
} from '../../../admin-session';

const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const ADMIN_SESSION_SECRET = process.env.ADMIN_SESSION_SECRET ?? process.env.ADMIN_DELETION_TOKEN;
const loginAttempts = new Map<string, { count: number; windowStartedAt: number }>();
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const MAX_LOGIN_ATTEMPTS = 5;

/** Server startup validation: crash the worker if required env vars are absent */
function validateConfig(): void {
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD || !ADMIN_SESSION_SECRET) {
    // In Next.js, throwing in module scope only crashes the specific worker on first request.
    // Log loudly so operators notice in production.
    console.error(
      '[Spotter Admin] FATAL: ADMIN_EMAIL, ADMIN_PASSWORD, or ADMIN_SESSION_SECRET ' +
      'is not set. Admin login is disabled. Set these env vars to enable the admin portal.'
    );
  }
}
validateConfig();

function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0]?.trim() || 'unknown';
  return request.headers.get('x-real-ip') ?? 'unknown';
}

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const record = loginAttempts.get(ip);
  if (!record || now - record.windowStartedAt > LOGIN_WINDOW_MS) {
    loginAttempts.set(ip, { count: 0, windowStartedAt: now });
    return false;
  }
  return record.count >= MAX_LOGIN_ATTEMPTS;
}

function recordFailure(ip: string): void {
  const now = Date.now();
  const record = loginAttempts.get(ip);
  if (!record || now - record.windowStartedAt > LOGIN_WINDOW_MS) {
    loginAttempts.set(ip, { count: 1, windowStartedAt: now });
    return;
  }
  loginAttempts.set(ip, { count: record.count + 1, windowStartedAt: record.windowStartedAt });
}

function clearFailures(ip: string): void {
  loginAttempts.delete(ip);
}

export async function POST(request: NextRequest) {
  try {
    const clientIp = getClientIp(request);
    if (isRateLimited(clientIp)) {
      return NextResponse.json(
        { error: 'Too many failed attempts. Please wait before trying again.' },
        { status: 429 },
      );
    }

    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password required' }, { status: 400 });
    }

    // If env vars are missing entirely, surface a clear server-misconfiguration error
    // rather than silently failing every login attempt as "invalid credentials".
    if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
      console.error('[Spotter Admin] Login attempted but ADMIN_EMAIL or ADMIN_PASSWORD is not configured');
      return NextResponse.json(
        { error: 'Server misconfiguration: admin credentials not set. Contact system administrator.' },
        { status: 500 }
      );
    }

    if (!ADMIN_SESSION_SECRET) {
      return NextResponse.json(
        { error: 'Server misconfiguration: admin session token not configured. Contact system administrator.' },
        { status: 500 }
      );
    }

    if (email !== ADMIN_EMAIL || password !== ADMIN_PASSWORD) {
      recordFailure(clientIp);
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    const sessionToken = await createAdminSessionToken(email);
    if (!sessionToken) {
      return NextResponse.json(
        { error: 'Server misconfiguration: admin session secret not configured. Contact system administrator.' },
        { status: 500 },
      );
    }

    clearFailures(clientIp);

    // Set secure session cookies
    const cookieStore = await cookies();
    cookieStore.delete('admin_token');
    cookieStore.set(getAdminSessionCookieName(), sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: getAdminSessionMaxAge(),
      path: '/',
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Admin login error:', error);
    return NextResponse.json({ error: 'Login failed' }, { status: 500 });
  }
}

export async function DELETE() {
  const cookieStore = await cookies();
  cookieStore.delete(getAdminSessionCookieName());
  cookieStore.delete('admin_token');
  return NextResponse.json({ success: true });
}

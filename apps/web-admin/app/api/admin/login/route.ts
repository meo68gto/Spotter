import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const ADMIN_DELETION_TOKEN = process.env.ADMIN_DELETION_TOKEN;

/** Server startup validation: crash the worker if required env vars are absent */
function validateConfig(): void {
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD || !ADMIN_DELETION_TOKEN) {
    // In Next.js, throwing in module scope only crashes the specific worker on first request.
    // Log loudly so operators notice in production.
    console.error(
      '[Spotter Admin] FATAL: ADMIN_EMAIL, ADMIN_PASSWORD, or ADMIN_DELETION_TOKEN ' +
      'is not set. Admin login is disabled. Set these env vars to enable the admin portal.'
    );
  }
}
validateConfig();

export async function POST(request: NextRequest) {
  try {
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

    if (email !== ADMIN_EMAIL || password !== ADMIN_PASSWORD) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    if (!ADMIN_DELETION_TOKEN) {
      return NextResponse.json(
        { error: 'Server misconfiguration: admin session token not configured. Contact system administrator.' },
        { status: 500 }
      );
    }

    // Set secure session cookies
    const cookieStore = await cookies();
    cookieStore.set('admin_session', 'active', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 60 * 60 * 8, // 8 hours
      path: '/',
    });
    cookieStore.set('admin_token', ADMIN_DELETION_TOKEN, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 60 * 60 * 8,
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
  cookieStore.delete('admin_session');
  cookieStore.delete('admin_token');
  return NextResponse.json({ success: true });
}

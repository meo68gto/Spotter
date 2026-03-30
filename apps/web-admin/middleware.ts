import { NextRequest, NextResponse } from 'next/server';
import { getAdminSessionCookieName, verifyAdminSessionToken } from './app/admin-session';

// These are constant per server worker — read once, use everywhere.
const ADMIN_SESSION_SECRET = process.env.ADMIN_SESSION_SECRET ?? process.env.ADMIN_DELETION_TOKEN;

const PROTECTED_PATHS = ['/moderation', '/disputes', '/payments', '/api/admin', '/api/db'];
const PUBLIC_PATHS = ['/', '/api/health'];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_PATHS.includes(pathname)) {
    return NextResponse.next();
  }

  const isProtected = PROTECTED_PATHS.some(
    (path) => pathname === path || pathname.startsWith(path + '/')
  );

  if (!isProtected) {
    return NextResponse.next();
  }

  // Guard: ADMIN_SESSION_SECRET must be configured. If missing, all admin paths are 503.
  // This is intentional — a misconfigured server should not silently degrade to open access.
  if (!ADMIN_SESSION_SECRET) {
    console.error('[Spotter Admin] ADMIN_SESSION_SECRET is not set — admin routes blocked');
    return NextResponse.json(
      { error: 'Admin not configured. Set ADMIN_SESSION_SECRET env var.' },
      { status: 503 }
    );
  }

  const adminSession = request.cookies.get(getAdminSessionCookieName())?.value;
  if (!(await verifyAdminSessionToken(adminSession))) {
    const response = NextResponse.redirect(new URL('/', request.url));
    response.cookies.delete(getAdminSessionCookieName());
    response.cookies.delete('admin_token');
    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|public/).*)',
  ],
};

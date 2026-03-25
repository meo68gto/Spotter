import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

// These are constant per server worker — read once, use everywhere.
const ADMIN_DELETION_TOKEN = process.env.ADMIN_DELETION_TOKEN;

const PROTECTED_PATHS = ['/moderation', '/disputes', '/payments', '/api/admin', '/api/db'];
const PUBLIC_PATHS = ['/', '/api/health'];

export function middleware(request: NextRequest) {
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

  // Guard: ADMIN_DELETION_TOKEN must be configured. If missing, all admin paths are 503.
  // This is intentional — a misconfigured server should not silently degrade to open access.
  if (!ADMIN_DELETION_TOKEN) {
    console.error('[Spotter Admin] ADMIN_DELETION_TOKEN is not set — admin routes blocked');
    return NextResponse.json(
      { error: 'Admin not configured. Set ADMIN_DELETION_TOKEN env var.' },
      { status: 503 }
    );
  }

  // Validate admin session cookies
  const adminSession = request.cookies.get('admin_session');
  const adminToken = request.cookies.get('admin_token');

  if (!adminSession || !adminToken) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  if (adminToken.value !== ADMIN_DELETION_TOKEN) {
    const response = NextResponse.redirect(new URL('/', request.url));
    response.cookies.delete('admin_session');
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

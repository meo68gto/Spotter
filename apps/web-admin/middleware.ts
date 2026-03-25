import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

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

  // Validate admin session cookie
  const adminSession = request.cookies.get('admin_session');
  const adminToken = request.cookies.get('admin_token');

  if (!adminSession || !adminToken) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  const expectedToken = process.env.ADMIN_DELETION_TOKEN;
  if (!expectedToken) {
    console.error('ADMIN_DELETION_TOKEN not configured');
    return NextResponse.redirect(new URL('/', request.url));
  }

  if (adminToken.value !== expectedToken) {
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

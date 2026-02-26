import { NextRequest, NextResponse } from 'next/server';

export function middleware(req: NextRequest) {
  // Check for admin authentication via cookie or header
  const token = req.cookies.get('admin_token')?.value
    ?? req.headers.get('x-admin-token');

  const secret = process.env.ADMIN_PANEL_SECRET;

  if (!secret) {
    console.error('ADMIN_PANEL_SECRET is not configured');
    return new NextResponse('Server misconfigured', { status: 500 });
  }

  if (token !== secret) {
    // Return 401 with basic auth challenge
    return new NextResponse('Unauthorized', {
      status: 401,
      headers: {
        'WWW-Authenticate': 'Basic realm="Spotter Admin"',
      },
    });
  }

  return NextResponse.next();
}

export const config = {
  matcher: '/((?!_next/static|_next/image|favicon.ico).*)',
};

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Operator routes that require authentication + operator role
const OPERATOR_ROUTES = ['/dashboard', '/tournaments', '/sponsors', '/members', '/analytics', '/settings']

export function middleware(request: NextRequest) {
  const pathname = new URL(request.url).pathname

  // Check if this is an operator route
  const isOperatorRoute = OPERATOR_ROUTES.some(route => pathname.startsWith(route))

  if (isOperatorRoute) {
    // Read the auth cookie
    const supabaseSessionCookie = request.cookies.get('sb-access-token')?.value
    const supabaseUserCookie = request.cookies.get('supabase-auth-token')?.value

    // If no session cookie at all, redirect to login
    if (!supabaseSessionCookie && !supabaseUserCookie) {
      const loginUrl = new URL('/login', request.url)
      loginUrl.searchParams.set('redirect', pathname)
      return NextResponse.redirect(loginUrl)
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/tournaments/:path*',
    '/sponsors/:path*',
    '/members/:path*',
    '/analytics/:path*',
    '/settings/:path*',
  ],
}

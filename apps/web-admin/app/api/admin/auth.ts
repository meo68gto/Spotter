import { NextRequest, NextResponse } from 'next/server';
import { getAdminSessionCookieName, verifyAdminSessionToken } from '../../admin-session';

/**
 * Validates the admin session from cookies.
 * Returns 401 if not authenticated.
 */
export async function validateAdmin(request: NextRequest): Promise<NextResponse | null> {
  const adminSession = request.cookies.get(getAdminSessionCookieName())?.value;
  if (!(await verifyAdminSessionToken(adminSession))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return null;
}

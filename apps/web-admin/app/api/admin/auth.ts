import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

/**
 * Validates the admin session from cookies.
 * Returns 401 if not authenticated.
 */
export async function validateAdmin(request: NextRequest): Promise<NextResponse | null> {
  const adminToken = request.cookies.get('admin_token')?.value;
  const expectedToken = process.env.ADMIN_DELETION_TOKEN;

  if (!adminToken || !expectedToken || adminToken !== expectedToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return null;
}

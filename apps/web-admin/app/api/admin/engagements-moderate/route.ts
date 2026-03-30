import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import { getAdminSessionCookieName, verifyAdminSessionToken } from '../../../admin-session';

const pool = new Pool({
  host: process.env.PGHOST ?? '127.0.0.1',
  port: parseInt(process.env.PGPORT ?? '54322', 10),
  database: process.env.PGDATABASE ?? 'spotter_local_dev',
  user: process.env.PGUSER ?? 'postgres',
  password: process.env.PGPASSWORD ?? 'postgres',
});

async function adminGuard(request: NextRequest): Promise<NextResponse | null> {
  const adminSession = request.cookies.get(getAdminSessionCookieName())?.value;
  if (!(await verifyAdminSessionToken(adminSession))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return null;
}

export async function POST(request: NextRequest) {
  const denied = await adminGuard(request);
  if (denied) return denied;

  try {
    const { engagementRequestId, moderationStatus } = await request.json();

    if (!engagementRequestId || !['approved', 'rejected'].includes(moderationStatus)) {
      return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 });
    }

    const client = await pool.connect();
    try {
      await client.query(
        'UPDATE engagement_requests SET moderation_status = $1, updated_at = NOW() WHERE id = $2',
        [moderationStatus, engagementRequestId]
      );

      // Audit log: record the moderation action for compliance tracking
      console.info(
        JSON.stringify({
          type: 'admin_moderation',
          action: 'engagement_moderate',
          engagement_request_id: engagementRequestId,
          status: moderationStatus,
          timestamp: new Date().toISOString(),
          remote_ip: request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip') ?? 'unknown',
        })
      );

      return NextResponse.json({ success: true });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Moderation error:', error);
    return NextResponse.json({ error: 'Update failed' }, { status: 500 });
  }
}

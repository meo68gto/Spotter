import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';

const pool = new Pool({
  host: process.env.PGHOST ?? '127.0.0.1',
  port: parseInt(process.env.PGPORT ?? '54322', 10),
  database: process.env.PGDATABASE ?? 'spotter_local_dev',
  user: process.env.PGUSER ?? 'postgres',
  password: process.env.PGPASSWORD ?? 'postgres',
});

/** Auth guard: rejects if the admin token cookie doesn't match env */
function adminGuard(request: NextRequest): NextResponse | null {
  const adminToken = request.cookies.get('admin_token')?.value;
  const expected = process.env.ADMIN_DELETION_TOKEN;
  if (!adminToken || !expected || adminToken !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return null;
}

export async function POST(request: NextRequest) {
  const denied = adminGuard(request);
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
      return NextResponse.json({ success: true });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Moderation error:', error);
    return NextResponse.json({ error: 'Update failed' }, { status: 500 });
  }
}

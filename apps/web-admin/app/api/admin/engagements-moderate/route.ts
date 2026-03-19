import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';

const pool = new Pool({
  host: '127.0.0.1',
  port: 54322,
  database: 'spotter_local_dev',
  user: 'postgres',
  password: 'postgres',
});

export async function POST(request: NextRequest) {
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

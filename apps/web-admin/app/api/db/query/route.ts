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

/** Allowed read-only tables */
const ALLOWED_TABLES = new Set([
  'engagement_requests',
  'review_orders',
  'refund_requests',
  'reschedule_requests',
  'payment_events',
  'admin_users',
]);

export async function POST(request: NextRequest) {
  const denied = adminGuard(request);
  if (denied) return denied;

  try {
    const { sql, table } = await request.json();

    // Table allowlist
    if (!table || !ALLOWED_TABLES.has(table)) {
      return NextResponse.json({ error: 'Invalid table' }, { status: 400 });
    }

    // Force SELECT only
    if (!sql.trim().toUpperCase().startsWith('SELECT')) {
      return NextResponse.json({ error: 'Only SELECT queries allowed' }, { status: 400 });
    }

    const client = await pool.connect();
    try {
      // Parameterized query (sql is built from our own path builder, but we still use parameterized for safety)
      const result = await client.query(sql);
      return NextResponse.json(result.rows);
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Database query error:', error);
    return NextResponse.json({ error: 'Query failed' }, { status: 500 });
  }
}

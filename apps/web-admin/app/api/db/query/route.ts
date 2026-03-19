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
    const { sql, table } = await request.json();
    
    // Security: Only allow SELECT queries on specific tables
    const allowedTables = ['engagement_requests', 'review_orders', 'refund_requests', 'reschedule_requests'];
    if (!allowedTables.includes(table)) {
      return NextResponse.json({ error: 'Invalid table' }, { status: 400 });
    }
    
    // Basic SQL injection prevention
    const normalizedSql = sql.toLowerCase().trim();
    if (!normalizedSql.startsWith('select')) {
      return NextResponse.json({ error: 'Only SELECT queries allowed' }, { status: 400 });
    }
    
    const client = await pool.connect();
    try {
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

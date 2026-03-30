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

type AllowedTable = 'engagement_requests' | 'review_orders' | 'refund_requests' | 'reschedule_requests' | 'payment_events' | 'admin_users';

type TableConfig = {
  selectableColumns: Set<string>;
  filterableColumns: Set<string>;
  orderableColumns: Set<string>;
  defaultOrder: string;
};

const TABLE_CONFIG: Record<AllowedTable, TableConfig> = {
  engagement_requests: {
    selectableColumns: new Set(['id', 'question_text', 'engagement_mode', 'moderation_status', 'public_opt_in', 'created_at']),
    filterableColumns: new Set(['question_text', 'engagement_mode', 'moderation_status', 'public_opt_in']),
    orderableColumns: new Set(['created_at', 'engagement_mode', 'moderation_status']),
    defaultOrder: 'created_at DESC',
  },
  review_orders: {
    selectableColumns: new Set(['id', 'status', 'amount_cents', 'currency', 'authorization_expires_at', 'stripe_payment_intent_id', 'created_at']),
    filterableColumns: new Set(['status']),
    orderableColumns: new Set(['created_at', 'status', 'amount_cents']),
    defaultOrder: 'created_at DESC',
  },
  refund_requests: {
    selectableColumns: new Set(['id', 'review_order_id', 'requester_user_id', 'reason', 'status', 'created_at']),
    filterableColumns: new Set(['status', 'review_order_id', 'requester_user_id']),
    orderableColumns: new Set(['created_at', 'status']),
    defaultOrder: 'created_at DESC',
  },
  reschedule_requests: {
    selectableColumns: new Set(['id', 'engagement_request_id', 'status', 'declined_reason', 'created_at']),
    filterableColumns: new Set(['status', 'engagement_request_id']),
    orderableColumns: new Set(['created_at', 'status']),
    defaultOrder: 'created_at DESC',
  },
  payment_events: {
    selectableColumns: new Set(['id', 'provider', 'provider_event_id', 'event_type', 'status', 'created_at']),
    filterableColumns: new Set(['provider', 'event_type', 'status']),
    orderableColumns: new Set(['created_at', 'status', 'event_type']),
    defaultOrder: 'created_at DESC',
  },
  admin_users: {
    selectableColumns: new Set(['id', 'user_id', 'role', 'is_active', 'created_at']),
    filterableColumns: new Set(['role', 'is_active', 'user_id']),
    orderableColumns: new Set(['created_at', 'role']),
    defaultOrder: 'created_at DESC',
  },
};

async function adminGuard(request: NextRequest): Promise<NextResponse | null> {
  const adminSession = request.cookies.get(getAdminSessionCookieName())?.value;
  if (!(await verifyAdminSessionToken(adminSession))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return null;
}

function quoteIdentifier(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

function parseRequestPath(rawPath: string): { table: AllowedTable; params: URLSearchParams } | null {
  const [tableName, queryString] = rawPath.split('?');
  if (!tableName || !(tableName in TABLE_CONFIG)) return null;
  return {
    table: tableName as AllowedTable,
    params: new URLSearchParams(queryString ?? ''),
  };
}

function buildSelectQuery(path: string): { table: AllowedTable; text: string; values: unknown[] } | null {
  const parsed = parseRequestPath(path);
  if (!parsed) return null;

  const config = TABLE_CONFIG[parsed.table];
  const params = parsed.params;
  const requestedSelect = (params.get('select') ?? '').split(',').map((value) => value.trim()).filter(Boolean);
  const selectedColumns = requestedSelect.length > 0 ? requestedSelect : Array.from(config.selectableColumns);
  if (selectedColumns.some((column) => !config.selectableColumns.has(column))) return null;

  const values: unknown[] = [];
  const whereClauses: string[] = [];

  for (const [key, rawValue] of params.entries()) {
    if (['select', 'limit', 'offset', 'order'].includes(key)) continue;
    if (!config.filterableColumns.has(key)) return null;

    if (rawValue.startsWith('eq.')) {
      values.push(rawValue.slice(3));
      whereClauses.push(`${quoteIdentifier(key)} = $${values.length}`);
      continue;
    }

    if (rawValue.startsWith('ilike.')) {
      values.push(rawValue.slice(6).replace(/\*/g, '%'));
      whereClauses.push(`${quoteIdentifier(key)} ILIKE $${values.length}`);
      continue;
    }

    return null;
  }

  const rawLimit = Number.parseInt(params.get('limit') ?? '100', 10);
  const rawOffset = Number.parseInt(params.get('offset') ?? '0', 10);
  const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(rawLimit, 1), 200) : 100;
  const offset = Number.isFinite(rawOffset) ? Math.max(rawOffset, 0) : 0;

  let orderClause = config.defaultOrder;
  const requestedOrder = params.get('order');
  if (requestedOrder) {
    const [column, direction] = requestedOrder.split('.');
    const normalizedDirection = direction?.toLowerCase() === 'asc' ? 'ASC' : 'DESC';
    if (!column || !config.orderableColumns.has(column)) return null;
    orderClause = `${quoteIdentifier(column)} ${normalizedDirection}`;
  }

  const selectClause = selectedColumns.map(quoteIdentifier).join(', ');
  const whereClause = whereClauses.length > 0 ? ` WHERE ${whereClauses.join(' AND ')}` : '';

  values.push(limit);
  const limitPlaceholder = `$${values.length}`;
  values.push(offset);
  const offsetPlaceholder = `$${values.length}`;

  return {
    table: parsed.table,
    text: `SELECT ${selectClause} FROM public.${quoteIdentifier(parsed.table)}${whereClause} ORDER BY ${orderClause} LIMIT ${limitPlaceholder} OFFSET ${offsetPlaceholder}`,
    values,
  };
}

export async function POST(request: NextRequest) {
  const denied = await adminGuard(request);
  if (denied) return denied;

  try {
    const { path } = await request.json();
    if (typeof path !== 'string' || path.trim() === '') {
      return NextResponse.json({ error: 'Invalid query path' }, { status: 400 });
    }

    const builtQuery = buildSelectQuery(path);
    if (!builtQuery) {
      return NextResponse.json({ error: 'Query contains unsupported table, columns, or filters' }, { status: 400 });
    }

    const client = await pool.connect();
    try {
      const result = await client.query(builtQuery.text, builtQuery.values);

      // Audit log: record every DB query for compliance
      console.info(
        JSON.stringify({
          type: 'admin_db_query',
          action: 'db_select',
          table: builtQuery.table,
          row_count: result.rowCount ?? 0,
          timestamp: new Date().toISOString(),
          remote_ip: request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip') ?? 'unknown',
        })
      );

      return NextResponse.json(result.rows);
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Database query error:', error);
    return NextResponse.json({ error: 'Query failed' }, { status: 500 });
  }
}

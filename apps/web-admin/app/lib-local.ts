// Local PostgreSQL client for development
// Matches Supabase REST API structure for easy migration

const LOCAL_DB_URL = process.env.LOCAL_DATABASE_URL || 'postgresql://postgres:postgres@127.0.0.1:54322/spotter_local_dev';

interface QueryResult<T> {
  rows: T[];
}

// Simple PostgreSQL query via fetch to a local API endpoint
// We'll create a simple API route for this
export const restFetchLocal = async <T>(table: string, query: string): Promise<T[]> => {
  const params = new URLSearchParams(query);
  const select = params.get('select') || '*';
  const limit = params.get('limit') || '100';
  const offset = params.get('offset') || '0';
  const order = params.get('order') || 'created_at.desc';
  
  // Build WHERE clauses from query params
  const filters: string[] = [];
  for (const [key, value] of params.entries()) {
    if (!['select', 'limit', 'offset', 'order'].includes(key)) {
      if (value.startsWith('eq.')) {
        filters.push(`${key} = '${value.slice(3)}'`);
      } else if (value.startsWith('ilike.')) {
        filters.push(`${key} ILIKE '${value.slice(6).replace(/\*/g, '%')}'`);
      }
    }
  }
  
  const whereClause = filters.length > 0 ? `WHERE ${filters.join(' AND ')}` : '';
  const orderBy = order.includes('.') ? `ORDER BY ${order.replace('.', ' ')}` : '';
  
  const sql = `
    SELECT ${select} 
    FROM ${table} 
    ${whereClause}
    ${orderBy}
    LIMIT ${limit} OFFSET ${offset}
  `;
  
  // Call local API endpoint
  const response = await fetch(`http://localhost:3000/api/db/query`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ sql, table })
  });
  
  if (!response.ok) {
    throw new Error(`Database query failed: ${table}`);
  }
  
  return (await response.json()) as T[];
};

export const invokeAdminFunctionLocal = async (name: string, body: Record<string, unknown>): Promise<unknown> => {
  const response = await fetch(`http://localhost:3000/api/admin/${name}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body)
  });
  
  if (!response.ok) {
    throw new Error(`Admin function failed: ${name}`);
  }
  
  return await response.json();
};

const required = (key: string) => {
  const value = process.env[key];
  if (!value) throw new Error(`Missing env: ${key}`);
  return value;
};

export const getAdminEnv = () => ({
  supabaseUrl: required('SUPABASE_URL'),
  serviceRoleKey: required('SUPABASE_SERVICE_ROLE_KEY'),
  functionsBaseUrl: process.env.SUPABASE_FUNCTIONS_URL ?? `${required('SUPABASE_URL')}/functions/v1`,
  adminToken: required('ADMIN_DELETION_TOKEN')
});

// Check if we should use local PostgreSQL
const useLocalDb = process.env.USE_LOCAL_DB === 'true' || !process.env.SUPABASE_URL;

export const restFetch = async <T>(path: string) => {
  if (useLocalDb) {
    // Use local API endpoint
    const response = await fetch(`http://localhost:3000/api/db/query`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ sql: buildSqlFromPath(path), table: extractTableFromPath(path) }),
      cache: 'no-store'
    });
    if (!response.ok) {
      throw new Error(`Local DB fetch failed: ${path}`);
    }
    return (await response.json()) as T;
  }

  const env = getAdminEnv();
  const response = await fetch(`${env.supabaseUrl}/rest/v1/${path}`, {
    headers: {
      apikey: env.serviceRoleKey,
      Authorization: `Bearer ${env.serviceRoleKey}`,
      'content-type': 'application/json'
    },
    cache: 'no-store'
  });
  if (!response.ok) {
    throw new Error(`REST fetch failed: ${path}`);
  }
  return (await response.json()) as T;
};

export const invokeAdminFunction = async (name: string, body: Record<string, unknown>) => {
  if (useLocalDb) {
    // Use local API endpoint
    const response = await fetch(`http://localhost:3000/api/admin/${name}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (!response.ok) {
      throw new Error(`Local admin function failed: ${name}`);
    }
    return await response.json();
  }

  const env = getAdminEnv();
  const response = await fetch(`${env.functionsBaseUrl}/${name}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-admin-token': env.adminToken
    },
    body: JSON.stringify(body)
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error ?? `${name} failed`);
  }
  return await response.json();
};

// Helper to convert Supabase REST path to SQL
function buildSqlFromPath(path: string): string {
  const [table, queryString] = path.split('?');
  const params = new URLSearchParams(queryString || '');
  
  const select = params.get('select') || '*';
  const limit = params.get('limit') || '100';
  const offset = params.get('offset') || '0';
  const order = params.get('order') || 'created_at.desc';
  
  const filters: string[] = [];
  for (const [key, value] of params.entries()) {
    if (!['select', 'limit', 'offset', 'order'].includes(key)) {
      if (value.startsWith('eq.')) {
        const val = value.slice(3);
        // Handle boolean values
        if (val === 'true' || val === 'false') {
          filters.push(`${key} = ${val}`);
        } else {
          filters.push(`${key} = '${val}'`);
        }
      } else if (value.startsWith('ilike.')) {
        filters.push(`${key} ILIKE '${value.slice(6).replace(/\*/g, '%')}'`);
      }
    }
  }
  
  const whereClause = filters.length > 0 ? `WHERE ${filters.join(' AND ')}` : '';
  const orderBy = order.includes('.') ? `ORDER BY ${order.replace('.', ' ')}` : '';
  
  return `SELECT ${select} FROM ${table} ${whereClause} ${orderBy} LIMIT ${limit} OFFSET ${offset}`;
}

function extractTableFromPath(path: string): string {
  return path.split('?')[0];
}

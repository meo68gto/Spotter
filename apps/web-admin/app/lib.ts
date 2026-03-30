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
      body: JSON.stringify({ path }),
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

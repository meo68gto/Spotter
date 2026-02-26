function required(key: string): string {
  const v = process.env[key];
  if (!v) throw new Error(`Missing required env var: ${key}`);
  return v;
}

// Validated once at module load — server refuses to start if missing
export const adminEnv = {
  supabaseUrl: required('SUPABASE_URL'),
  serviceRoleKey: required('SUPABASE_SERVICE_ROLE_KEY'),
  functionsBaseUrl: process.env.SUPABASE_FUNCTIONS_URL ?? `${required('SUPABASE_URL')}/functions/v1`,
  adminToken: required('ADMIN_DELETION_TOKEN'),
  adminHmacSecret: required('ADMIN_HMAC_SECRET'),
} as const;

// HMAC signing for admin function calls
async function signAdminRequest(body: string): Promise<{ nonce: string; sig: string }> {
  const nonce = crypto.randomUUID();
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(adminEnv.adminHmacSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(nonce + body));
  const sig = Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  return { nonce, sig };
}

export async function restFetch<T>(path: string): Promise<T> {
  const url = `${adminEnv.supabaseUrl}/rest/v1/${path}`;
  const res = await fetch(url, {
    headers: {
      apikey: adminEnv.serviceRoleKey,
      Authorization: `Bearer ${adminEnv.serviceRoleKey}`,
      'Content-Type': 'application/json',
    },
    next: { revalidate: 0 },
  });
  if (!res.ok) throw new Error(`REST ${res.status}: ${await res.text()}`);
  return res.json();
}

export async function invokeAdminFunction(name: string, body: Record<string, unknown> = {}) {
  const bodyStr = JSON.stringify(body);
  const { nonce, sig } = await signAdminRequest(bodyStr);
  const url = `${adminEnv.functionsBaseUrl}/${name}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminEnv.serviceRoleKey}`,
      'x-admin-token': adminEnv.adminToken,
      'x-admin-nonce': nonce,
      'x-admin-sig': sig,
    },
    body: bodyStr,
  });
  if (!res.ok) throw new Error(`Function ${name} ${res.status}: ${await res.text()}`);
  return res.json();
}

// _shared/guard.ts
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { getEnv } from './env.ts';

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'HttpError';
  }
}

/** Typed auth context returned by requireAuth */
export interface AuthContext {
  userId: string;
  email: string;
  role: string;
  client: any; // SupabaseClient with service role
}

function createServiceRoleClient(): SupabaseClient {
  const env = getEnv();
  return createClient(env.supabaseUrl, env.serviceRoleKey, {
    auth: { persistSession: false },
  });
}

function createUserClient(token: string): SupabaseClient {
  const env = getEnv();
  return createClient(env.supabaseUrl, env.supabaseAnonKey, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
}

/** Verify JWT and return typed auth context */
export async function requireAuth(req: Request): Promise<AuthContext & { userClient: SupabaseClient }> {
  const authHeader = req.headers.get('Authorization');
  const token = authHeader?.replace('Bearer ', '');
  if (!token) throw new HttpError(401, 'Missing authorization token');

  const client = createServiceRoleClient();
  const { data: { user }, error } = await client.auth.getUser(token);
  if (error || !user) throw new HttpError(401, 'Invalid or expired token');

  return {
    userId: user.id,
    email: user.email ?? '',
    role: (user.app_metadata?.role as string) ?? 'user',
    client,
    userClient: createUserClient(token),
  };
}

/** Verify admin token header */
export function requireAdminToken(req: Request): void {
  const token = req.headers.get('x-admin-token');
  const expected = Deno.env.get('ADMIN_DELETION_TOKEN');
  if (!token || token !== expected) {
    throw new HttpError(403, 'Missing or invalid admin token');
  }
}

/** Verify admin HMAC signature for admin-callable functions */
export async function requireAdminHmac(req: Request): Promise<void> {
  const nonce = req.headers.get('x-admin-nonce');
  const sig = req.headers.get('x-admin-sig');
  const adminToken = req.headers.get('x-admin-token');
  const secret = Deno.env.get('ADMIN_HMAC_SECRET');
  const expectedToken = Deno.env.get('ADMIN_DELETION_TOKEN');

  if (!adminToken || adminToken !== expectedToken) {
    throw new HttpError(403, 'Missing or invalid admin token');
  }

  if (!secret || !nonce || !sig) {
    throw new HttpError(403, 'Missing admin HMAC credentials');
  }

  const encoder = new TextEncoder();
  const body = await req.clone().text();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(nonce + body));
  const expected = Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  if (expected !== sig) {
    throw new HttpError(403, 'Invalid admin HMAC signature');
  }
}

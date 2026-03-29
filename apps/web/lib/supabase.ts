import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

// Only create client if env vars are present; otherwise returns null (mock mode)
export const supabase: SupabaseClient | null =
  supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null;

// Server-side client with service role (for API routes)
export function createServerClient(): SupabaseClient | null {
  if (!supabaseUrl || !supabaseAnonKey) return null;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
  if (!serviceKey) return null;
  return createClient(supabaseUrl, serviceKey);
}

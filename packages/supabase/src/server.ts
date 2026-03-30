import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

/**
 * Server-side Supabase client with service role key.
 * Bypasses RLS — use only in trusted server contexts (API routes, etc).
 */
export function createServerClient() {
  return createClient(supabaseUrl, supabaseServiceKey);
}

/**
 * Browser client for use in Server Components (RSC).
 * Uses anon key but avoids cookie dependency.
 */
export function createServerBrowserClient() {
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(supabaseUrl, supabaseAnonKey);
}

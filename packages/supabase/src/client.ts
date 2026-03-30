import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * Browser Supabase client for client-side usage.
 * Uses the anonymous key and relies on cookie-based auth.
 */
export function createBrowserClient() {
  return createClient(supabaseUrl, supabaseAnonKey);
}

// Backward-compatible alias
export const createSupabaseBrowserClient = createBrowserClient;

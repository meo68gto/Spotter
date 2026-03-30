/**
 * Web auth utilities — cookie-based session management for Next.js.
 *
 * Consumed by:
 *   - apps/web/lib/auth.ts  (re-exports)
 *   - apps/web/lib/operator/auth.ts (imports getSessionFromCookie)
 *
 * Uses server-side Supabase client with SUPABASE_SERVICE_ROLE_KEY
 * to bypass RLS for server-side session lookups.
 */
import { createClient } from '@supabase/supabase-js';
import type { OperatorSession } from './types.js';

// ---------------------------------------------------------------------------
// Server client factory
// ---------------------------------------------------------------------------

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

/**
 * Create a service-role Supabase client for server-side operations.
 * Bypasses RLS so we can query users table directly.
 */
function createServerClient() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
}

// ---------------------------------------------------------------------------
// Session retrieval
// ---------------------------------------------------------------------------

/**
 * Internal — fetches user + profile from the auth cookie session.
 * This is the canonical session lookup for the web app.
 *
 * Flow:
 *   1. Get user from Supabase auth (validates JWT in cookie)
 *   2. Fetch profile from users table
 *   3. Fetch active organizer membership from organizer_members table
 *   4. Return OperatorSession
 */
export async function getSessionFromCookie(): Promise<OperatorSession | null> {
  const supabase = createServerClient();

  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;

  const { data: profile } = await supabase
    .from('users')
    .select('id, display_name, email, user_role')
    .eq('id', user.id)
    .single();

  if (!profile) return null;

  const { data: member } = await supabase
    .from('organizer_members')
    .select('organizer_id, role')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .maybeSingle();

  return {
    userId: profile.id,
    displayName: profile.display_name ?? profile.email?.split('@')[0] ?? 'User',
    email: profile.email,
    role: (profile.user_role as 'golfer' | 'operator' | 'admin') ?? 'golfer',
    organizerId: member?.organizer_id,
    memberRole: member?.role as 'owner' | 'admin' | 'manager' | 'viewer' | undefined,
  };
}

/**
 * Get the current user session from cookies (server-side).
 * Returns null if not authenticated.
 */
export async function getSession(): Promise<OperatorSession | null> {
  return getSessionFromCookie();
}

// ---------------------------------------------------------------------------
// Role checks
// ---------------------------------------------------------------------------

/**
 * Check if a session represents an operator or admin.
 */
export function isOperatorOrAdmin(session: OperatorSession | null): boolean {
  if (!session) return false;
  return session.role === 'operator' || session.role === 'admin';
}

/**
 * Check if a session has an active organizer membership.
 */
export function hasOrganizerMembership(session: OperatorSession | null): boolean {
  if (!session) return false;
  return !!session.organizerId;
}

// ---------------------------------------------------------------------------
// Re-export types for convenience
// ---------------------------------------------------------------------------
export type { OperatorSession } from './types.js';

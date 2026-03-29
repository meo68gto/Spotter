/**
 * Operator auth middleware — verifies the requesting user is an operator/admin
 * and that they have an active organizer_account.
 *
 * Pattern: call withOperatorAuth(req, async (session) => { ... })
 */
import { NextRequest } from 'next/server';
import { createServerClient } from '../supabase';
import type { OperatorSession } from '@spotter/types';

export interface OperatorAuthContext {
  session: OperatorSession;
  organizerId: string;
}

export async function withOperatorAuth(
  request: NextRequest,
  handler: (ctx: OperatorAuthContext) => Promise<Response>,
): Promise<Response> {
  // 1. Get session from cookie
  const session = await getSessionFromRequest(request);
  if (!session) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (session.role !== 'operator' && session.role !== 'admin') {
    return new Response(JSON.stringify({ error: 'Forbidden — operator role required' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // 2. Verify they have an active organizer membership
  const supabase = createServerClient();
  if (!supabase) {
    // Mock/dev mode — use a placeholder organizer ID
    return handler({ session, organizerId: 'mock-organizer-id' });
  }

  const { data: member } = await supabase
    .from('organizer_members')
    .select('organizer_id')
    .eq('user_id', session.userId)
    .eq('is_active', true)
    .maybeSingle();

  if (!member) {
    return new Response(JSON.stringify({ error: 'Forbidden — no organizer account' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return handler({ session, organizerId: member.organizer_id });
}

async function getSessionFromRequest(request: NextRequest): Promise<OperatorSession | null> {
  // Try Supabase auth cookie first
  const supabase = createServerClient();
  if (!supabase) return null;

  // getUser from cookie-based auth
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;

  // Fetch role + profile from public.users
  const { data: profile } = await supabase
    .from('users')
    .select('display_name, role')
    .eq('id', user.id)
    .maybeSingle();

  return {
    userId: user.id,
    email: user.email ?? '',
    displayName: profile?.display_name ?? user.email ?? 'Unknown',
    role: (profile?.role as OperatorSession['role']) ?? 'golfer',
  };
}

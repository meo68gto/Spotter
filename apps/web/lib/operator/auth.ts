/**
 * Operator auth middleware — verifies the requesting user is an operator/admin
 * and that they have an active organizer_account.
 *
 * Pattern: call withOperatorAuth(req, async (session) => { ... })
 */
import { NextRequest } from 'next/server';
import { getSessionFromCookie } from '../auth';
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
  // 1. Get session from cookie (reuses lib/auth.ts logic — same query pattern)
  const session = await getSessionFromCookie();
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

  // 2. Verify active organizer membership (service role bypasses RLS so direct DB check is required)
  const supabase = createServerClient();
  if (!supabase) {
    // Dev mode — use a placeholder organizer ID
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

import { useState, useEffect, useCallback } from 'react';
import type { SupabaseClient, Session, User } from '@supabase/supabase-js';
import type { OperatorSession } from '@spotter/auth/web';

/**
 * Shared session management hook.
 * Works with any Supabase client that implements getSession() / auth.onAuthStateChange().
 */
export function useSession(supabase: SupabaseClient) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setUser(data.session?.user ?? null);
      setLoading(false);
    });

    // Subscribe to auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, [supabase]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, [supabase]);

  return {
    session,
    user,
    loading,
    isSignedIn: !!session,
    signOut,
  };
}

/**
 * Lightweight session check that only returns whether a session exists.
 */
export function useSessionCheck(supabase: SupabaseClient): boolean {
  const [hasSession, setHasSession] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setHasSession(!!data.session);
    });
  }, [supabase]);

  return hasSession;
}

/**
 * Session info for operator/admin contexts.
 */
export interface OperatorSessionInfo {
  userId: string;
  email: string;
  organizerId: string;
  role: 'operator' | 'admin';
}

export function useOperatorSession(
  getOperatorSession: () => Promise<{ data: OperatorSession | null }>,
) {
  const [operatorSession, setOperatorSession] = useState<OperatorSession | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getOperatorSession().then(({ data }) => {
      setOperatorSession(data);
      setLoading(false);
    });
  }, [getOperatorSession]);

  const isOperator = operatorSession?.role === 'operator' || operatorSession?.role === 'admin';

  return { operatorSession, loading, isOperator };
}

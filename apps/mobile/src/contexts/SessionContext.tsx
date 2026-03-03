/**
 * Spotter — SessionContext
 *
 * Provides auth session state to the entire app via React Context,
 * eliminating prop-drilling through navigator hierarchies.
 *
 * Usage in any screen or component:
 *
 *   import { useSession } from '../contexts/SessionContext';
 *
 *   function MyScreen() {
 *     const { session, onSignOut } = useSession();
 *     // session is the Supabase Session object
 *     // onSignOut() triggers the auth sign-out flow
 *   }
 */

import React, {
  createContext,
  useContext,
  useMemo,
  type ReactNode,
} from 'react';
import { Session } from '@supabase/supabase-js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SessionContextValue {
  /** The authenticated Supabase session */
  session: Session;
  /** Call to trigger sign-out in the parent auth flow */
  onSignOut: () => void;
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const SessionContext = createContext<SessionContextValue | null>(null);
SessionContext.displayName = 'SessionContext';

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

interface SessionProviderProps {
  session: Session;
  onSignOut: () => void;
  children: ReactNode;
}

export function SessionProvider({
  session,
  onSignOut,
  children,
}: SessionProviderProps): React.ReactElement {
  const value = useMemo<SessionContextValue>(
    () => ({ session, onSignOut }),
    [session, onSignOut]
  );

  return (
    <SessionContext.Provider value={value}>
      {children}
    </SessionContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

/**
 * Access the current session and sign-out handler from any screen or component.
 *
 * Throws if called outside of a <SessionProvider>.
 *
 * @example
 *   const { session, onSignOut } = useSession();
 *   return <Text>Hello, {session.user.email}</Text>;
 */
export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (ctx === null) {
    throw new Error(
      'useSession must be called inside a <SessionProvider>. ' +
      'Make sure <SessionProvider> wraps your navigator tree in App.tsx.'
    );
  }
  return ctx;
}

/**
 * Like useSession, but returns null instead of throwing when used outside
 * a provider. Useful for components that can render in both auth and
 * unauth contexts (e.g., shared UI primitives).
 */
export function useSessionOptional(): SessionContextValue | null {
  return useContext(SessionContext);
}

export default SessionContext;

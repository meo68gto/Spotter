import { useMemo } from 'react';
import { Session } from '@supabase/supabase-js';

export function useVideoPipeline(session: Session) {
  return useMemo(
    () => ({
      userId: session.user.id,
      userEmail: session.user.email ?? 'unknown'
    }),
    [session.user.email, session.user.id]
  );
}

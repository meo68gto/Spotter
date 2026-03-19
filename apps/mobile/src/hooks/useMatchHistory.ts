import { useCallback, useEffect, useState } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

export type MatchHistoryRow = {
  id: string;
  status: string;
  created_at: string;
  activity_id: string;
};

export function useMatchHistory(session: Session) {
  const [loading, setLoading] = useState(false);
  const [matches, setMatches] = useState<MatchHistoryRow[]>([]);

  const refresh = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('matches')
      .select('id, status, created_at, activity_id')
      .or(`requester_user_id.eq.${session.user.id},candidate_user_id.eq.${session.user.id}`)
      .order('created_at', { ascending: false })
      .limit(100);
    setMatches((data ?? []) as MatchHistoryRow[]);
    setLoading(false);
  }, [session.user.id]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { loading, matches, refresh };
}

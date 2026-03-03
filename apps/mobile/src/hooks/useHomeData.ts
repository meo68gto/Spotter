import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { useSession } from '../../contexts/SessionContext';
import type { RealtimeChannel } from '@supabase/supabase-js';

export type SessionRecord = {
  id: string;
  match_id: string;
  proposer_user_id: string;
  partner_user_id: string;
  activity_id: string;
  proposed_start_time: string;
  confirmed_time: string | null;
  status: string;
};

export type MatchRecord = {
  id: string;
  requester_user_id: string;
  candidate_user_id: string;
  activity_id: string;
  status: string;
  created_at: string;
};

export type WeeklyStats = {
  sessionsPlayed: number;
  partnersMet: number;
  videosUploaded: number;
};

export type HomeData = {
  todaySessions: SessionRecord[];
  pendingMatches: MatchRecord[];
  weeklyStats: WeeklyStats;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
};

export function useHomeData(): HomeData {
  const { session } = useSession();
  const userId = session?.user?.id ?? null;

  const [todaySessions, setTodaySessions] = useState<SessionRecord[]>([]);
  const [pendingMatches, setPendingMatches] = useState<MatchRecord[]>([]);
  const [weeklyStats, setWeeklyStats] = useState<WeeklyStats>({
    sessionsPlayed: 0,
    partnersMet: 0,
    videosUploaded: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const channelsRef = useRef<RealtimeChannel[]>([]);

  const fetchTodaySessions = useCallback(async (uid: string): Promise<SessionRecord[]> => {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    const { data, error: err } = await supabase
      .from('sessions')
      .select('*')
      .or(`proposer_user_id.eq.${uid},partner_user_id.eq.${uid}`)
      .gte('proposed_start_time', startOfDay.toISOString())
      .lte('proposed_start_time', endOfDay.toISOString())
      .in('status', ['proposed', 'confirmed'])
      .order('proposed_start_time', { ascending: true });

    if (err) throw new Error(err.message);
    return (data as SessionRecord[]) ?? [];
  }, []);

  const fetchPendingMatches = useCallback(async (uid: string): Promise<MatchRecord[]> => {
    const { data, error: err } = await supabase
      .from('matches')
      .select('*')
      .eq('candidate_user_id', uid)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(3);

    if (err) throw new Error(err.message);
    return (data as MatchRecord[]) ?? [];
  }, []);

  const fetchWeeklyStats = useCallback(async (uid: string): Promise<WeeklyStats> => {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    const { data: sessionData, error: sessionErr } = await supabase
      .from('sessions')
      .select('id')
      .or(`proposer_user_id.eq.${uid},partner_user_id.eq.${uid}`)
      .gte('proposed_start_time', sevenDaysAgo.toISOString())
      .in('status', ['confirmed', 'completed']);

    if (sessionErr) throw new Error(sessionErr.message);

    const { data: matchData, error: matchErr } = await supabase
      .from('matches')
      .select('id')
      .or(`requester_user_id.eq.${uid},candidate_user_id.eq.${uid}`)
      .eq('status', 'accepted')
      .gte('created_at', sevenDaysAgo.toISOString());

    if (matchErr) throw new Error(matchErr.message);

    return {
      sessionsPlayed: sessionData?.length ?? 0,
      partnersMet: matchData?.length ?? 0,
      videosUploaded: 0,
    };
  }, []);

  const fetchAll = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const [sessions, matches, stats] = await Promise.all([
        fetchTodaySessions(userId),
        fetchPendingMatches(userId),
        fetchWeeklyStats(userId),
      ]);

      setTodaySessions(sessions);
      setPendingMatches(matches);
      setWeeklyStats(stats);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load home data';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [userId, fetchTodaySessions, fetchPendingMatches, fetchWeeklyStats]);

  useEffect(() => {
    if (!userId) return;

    channelsRef.current.forEach((ch) => supabase.removeChannel(ch));
    channelsRef.current = [];

    const sessionsChannel = supabase
      .channel(`home-sessions-${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sessions', filter: `proposer_user_id=eq.${userId}` }, () => { void fetchAll(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sessions', filter: `partner_user_id=eq.${userId}` }, () => { void fetchAll(); })
      .subscribe();

    const matchesChannel = supabase
      .channel(`home-matches-${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'matches', filter: `candidate_user_id=eq.${userId}` }, () => { void fetchAll(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'matches', filter: `requester_user_id=eq.${userId}` }, () => { void fetchAll(); })
      .subscribe();

    channelsRef.current = [sessionsChannel, matchesChannel];

    return () => {
      channelsRef.current.forEach((ch) => supabase.removeChannel(ch));
      channelsRef.current = [];
    };
  }, [userId, fetchAll]);

  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  return {
    todaySessions,
    pendingMatches,
    weeklyStats,
    loading,
    error,
    refresh: fetchAll,
  };
}

import { useCallback, useEffect, useState } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { invokeFunction } from '../lib/api';

export type ActiveCoachingSession = {
  id: string;
  status: string;
  proposed_start_time: string;
  confirmed_time: string | null;
  proposer_user_id: string;
  partner_user_id: string;
};

export type ActiveVideoCallEngagement = {
  id: string;
  status: string;
  scheduled_time: string | null;
};

export function useSessionLifecycle(session: Session) {
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<ActiveCoachingSession[]>([]);
  const [engagements, setEngagements] = useState<ActiveVideoCallEngagement[]>([]);

  const refresh = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('sessions')
      .select('id, status, proposed_start_time, confirmed_time, proposer_user_id, partner_user_id')
      .or(`proposer_user_id.eq.${session.user.id},partner_user_id.eq.${session.user.id}`)
      .in('status', ['confirmed', 'proposed'])
      .order('proposed_start_time', { ascending: true })
      .limit(20);
    setRows((data ?? []) as ActiveCoachingSession[]);

    const { data: coach } = await supabase.from('coaches').select('id').eq('user_id', session.user.id).maybeSingle();
    const requesterQuery = supabase
      .from('engagement_requests')
      .select('id, status, scheduled_time')
      .eq('requester_user_id', session.user.id)
      .eq('engagement_mode', 'video_call')
      .in('status', ['accepted', 'in_progress'])
      .order('created_at', { ascending: false })
      .limit(20);
    const coachQuery = coach?.id
      ? supabase
          .from('engagement_requests')
          .select('id, status, scheduled_time')
          .eq('coach_id', coach.id)
          .eq('engagement_mode', 'video_call')
          .in('status', ['accepted', 'in_progress'])
          .order('created_at', { ascending: false })
          .limit(20)
      : Promise.resolve({ data: [] as Record<string, unknown>[] });
    const [rq, cq] = await Promise.all([requesterQuery, coachQuery]);
    const merged = [...(rq.data ?? []), ...(cq.data ?? [])].filter((row, idx, arr) => arr.findIndex((x) => x.id === row.id) === idx);
    setEngagements(merged as ActiveVideoCallEngagement[]);
    setLoading(false);
  }, [session.user.id]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const endCall = async (engagementRequestId: string) => {
    return invokeFunction<{ durationSeconds: number; billableMinutes: number }>('calls-end', {
      method: 'POST',
      body: { engagementRequestId }
    });
  };

  return {
    loading,
    rows,
    engagements,
    refresh,
    endCall
  };
}

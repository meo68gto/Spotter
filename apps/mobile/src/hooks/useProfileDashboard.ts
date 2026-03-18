import { useCallback, useEffect, useState } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { env } from '../types/env';

type FeedbackSummary = {
  userId: string;
  totalFeedback: number;
  thumbsUpCount: number;
  thumbsDownCount: number;
  positiveRatio: number;
  topTags: string[];
};

export function useProfileDashboard(session: Session) {
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState<{ display_name: string | null; bio: string | null; timezone: string | null; avatar_url: string | null } | null>(null);
  const [feedback, setFeedback] = useState<FeedbackSummary | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    const [{ data: me }, { data: tokenData }] = await Promise.all([
      supabase.from('users').select('display_name, bio, timezone, avatar_url').eq('id', session.user.id).maybeSingle(),
      supabase.auth.getSession()
    ]);

    setProfile((me as any) ?? null);

    const token = tokenData.session?.access_token;
    if (token) {
      const response = await fetch(`${env.apiBaseUrl}/functions/v1/profiles-feedback-summary`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ userIds: [session.user.id] })
      });
      const payload = await response.json();
      if (response.ok) setFeedback((payload.data?.[0] as FeedbackSummary | undefined) ?? null);
    }

    setLoading(false);
  }, [session.user.id]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { loading, profile, feedback, refresh };
}

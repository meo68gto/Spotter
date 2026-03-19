import { useCallback, useEffect, useState } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

export type RadarPoint = {
  key: string;
  label: string;
  value: number;
  maxValue: number;
};

export function useSkillRadarData(session: Session) {
  const [loading, setLoading] = useState(false);
  const [activityId, setActivityId] = useState<string>('');
  const [activities, setActivities] = useState<Array<{ id: string; name: string }>>([]);
  const [points, setPoints] = useState<RadarPoint[]>([]);

  const refresh = useCallback(async () => {
    setLoading(true);

    const { data: allActivities } = await supabase.from('activities').select('id, name').order('name', { ascending: true }).limit(30);
    setActivities((allActivities ?? []) as Array<{ id: string; name: string }>);

    const selected = activityId || (allActivities?.[0]?.id ?? '');
    if (!activityId && selected) setActivityId(selected);

    if (!selected) {
      setPoints([]);
      setLoading(false);
      return;
    }

    const { data } = await supabase
      .from('skill_profiles')
      .select('dimensions')
      .eq('user_id', session.user.id)
      .eq('activity_id', selected)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const dims = (data?.dimensions as Array<{ key: string; label: string; score: number; maxScore?: number }> | undefined) ?? [];
    setPoints(
      dims.map((dim) => ({
        key: dim.key,
        label: dim.label,
        value: dim.score,
        maxValue: dim.maxScore ?? 100
      }))
    );
    setLoading(false);
  }, [activityId, session.user.id]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { loading, activityId, setActivityId, activities, points, refresh };
}

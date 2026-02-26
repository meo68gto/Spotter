import { Session } from '@supabase/supabase-js';
import { useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { invokeFunction } from '../../lib/api'; // M-1
import { supabase } from '../../lib/supabase';

type Snapshot = {
  id: string;
  trend_summary: string;
  snapshot_date: string;
  metrics: Array<{ key: string; label?: string; value: number; delta?: number; baseline_value?: number }>;
};

type ProgressSummary = {
  count: number;
  latestSnapshotDate: string | null;
  latestTrendSummary: string | null;
  latestMetrics: Array<{ key: string; label: string; value: number; delta: number }>;
};

type ProgressResponse = {
  data: Snapshot[];
  summary: ProgressSummary | null;
};

export function ProgressScreen({ session }: { session: Session }) {
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [activityId, setActivityId] = useState<string>('');
  const [summary, setSummary] = useState<ProgressSummary | null>(null);

  const loadSnapshots = async (nextActivityId?: string) => {
    const target = nextActivityId ?? activityId;
    if (!target) return;

    try {
      // M-1: Use invokeFunction with GET + query params
      const result = await invokeFunction<ProgressResponse>('progress-snapshots', {
        method: 'GET',
        query: { activityId: target, limit: 30 }
      });
      setSnapshots(result.data ?? []);
      setSummary(result.summary ?? null);
    } catch (error) {
      Alert.alert('Unable to load snapshots', error instanceof Error ? error.message : 'Unknown error');
    }
  };

  const generateSnapshot = async () => {
    if (!activityId) return;

    try {
      // M-1: Use invokeFunction
      await invokeFunction('progress-generate', {
        method: 'POST',
        body: { activityId }
      });
      await loadSnapshots();
    } catch (error) {
      Alert.alert('Generate failed', error instanceof Error ? error.message : 'Unknown error');
    }
  };

  // m-10: async function defined inside useEffect
  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('skill_profiles')
        .select('activity_id')
        .eq('user_id', session.user.id)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!data?.activity_id) return;
      setActivityId(data.activity_id);
      await loadSnapshots(data.activity_id);
    };
    load();
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Improvement Arc</Text>
      <Text style={styles.subtitle}>AI + coach trendline across submissions.</Text>
      <Button title="Generate Snapshot" onPress={generateSnapshot} disabled={!activityId} />

      {summary?.latestTrendSummary ? (
        <Card>
          <Text style={styles.metric}>Latest Trend</Text>
          <Text style={styles.values}>{summary.latestTrendSummary}</Text>
          <Text style={styles.subtle}>
            Snapshot {summary.latestSnapshotDate ?? 'n/a'} • total {summary.count}
          </Text>
          {summary.latestMetrics.map((metric) => (
            <Text key={metric.key} style={styles.metricLine}>
              {metric.label}: {metric.value}
              {metric.delta >= 0 ? ` (+${metric.delta})` : ` (${metric.delta})`}
            </Text>
          ))}
        </Card>
      ) : null}

      {snapshots.length === 0 ? <Text style={styles.empty}>No snapshots yet.</Text> : null}

      {snapshots.map((snapshot) => (
        <Card key={snapshot.id}>
          <Text style={styles.metric}>{snapshot.snapshot_date}</Text>
          <Text style={styles.values}>{snapshot.trend_summary}</Text>
          {snapshot.metrics.slice(0, 3).map((metric) => (
            <Text key={`${snapshot.id}-${metric.key}`} style={styles.metricLine}>
              {metric.label ?? metric.key}: {metric.value}
              {typeof metric.delta === 'number' ? (metric.delta >= 0 ? ` (+${metric.delta})` : ` (${metric.delta})`) : ''}
            </Text>
          ))}
        </Card>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f6f9fc',
    padding: 16
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#102a43'
  },
  subtitle: {
    color: '#627d98',
    marginBottom: 14
  },
  empty: {
    marginTop: 14,
    color: '#829ab1'
  },
  metric: {
    fontSize: 16,
    fontWeight: '700',
    color: '#102a43'
  },
  values: {
    marginTop: 6,
    color: '#334e68'
  },
  subtle: {
    marginTop: 6,
    color: '#627d98',
    fontSize: 12
  },
  metricLine: {
    marginTop: 4,
    color: '#1f5f8b'
  }
});

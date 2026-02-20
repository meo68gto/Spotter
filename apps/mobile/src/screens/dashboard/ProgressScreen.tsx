import { Session } from '@supabase/supabase-js';
import { useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { supabase } from '../../lib/supabase';
import { env } from '../../types/env';

type Snapshot = {
  id: string;
  trend_summary: string;
  snapshot_date: string;
  metrics: Array<{ key: string; label?: string; value: number }>;
};

export function ProgressScreen({ session }: { session: Session }) {
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [activityId, setActivityId] = useState<string>('');

  const loadSnapshots = async (nextActivityId?: string) => {
    const target = nextActivityId ?? activityId;
    if (!target) return;

    const token = (await supabase.auth.getSession()).data.session?.access_token;
    if (!token) return;

    const res = await fetch(`${env.apiBaseUrl}/functions/v1/progress-snapshots?activityId=${target}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const payload = await res.json();
    if (!res.ok) {
      Alert.alert('Unable to load snapshots', payload.error ?? 'Unknown error');
      return;
    }
    setSnapshots(payload.data ?? []);
  };

  const generateSnapshot = async () => {
    if (!activityId) return;
    const token = (await supabase.auth.getSession()).data.session?.access_token;
    if (!token) return;

    const res = await fetch(`${env.apiBaseUrl}/functions/v1/progress-generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ activityId })
    });

    const payload = await res.json();
    if (!res.ok) {
      Alert.alert('Generate failed', payload.error ?? 'Unknown error');
      return;
    }

    await loadSnapshots();
  };

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

      {snapshots.length === 0 ? <Text style={styles.empty}>No snapshots yet.</Text> : null}

      {snapshots.map((snapshot) => (
        <Card key={snapshot.id}>
          <Text style={styles.metric}>{snapshot.snapshot_date}</Text>
          <Text style={styles.values}>{snapshot.trend_summary}</Text>
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
  }
});

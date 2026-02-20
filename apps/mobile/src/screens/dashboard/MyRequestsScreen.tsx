import { Session } from '@supabase/supabase-js';
import { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text } from 'react-native';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { supabase } from '../../lib/supabase';

type RequestRow = {
  id: string;
  engagement_mode: string;
  question_text: string;
  status: string;
  public_opt_in: boolean;
  moderation_status: 'pending' | 'approved' | 'rejected';
  created_at: string;
};

export function MyRequestsScreen({ session }: { session: Session }) {
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('engagement_requests')
      .select('id, engagement_mode, question_text, status, public_opt_in, moderation_status, created_at')
      .eq('requester_user_id', session.user.id)
      .order('created_at', { ascending: false })
      .limit(30);
    setLoading(false);

    if (error) {
      Alert.alert('Load failed', error.message);
      return;
    }
    setRequests((data ?? []) as RequestRow[]);
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>My Requests</Text>
      <Text style={styles.subtitle}>Track status across text/video/call engagements.</Text>
      <Button title={loading ? 'Refreshing...' : 'Refresh'} onPress={load} disabled={loading} />

      {requests.map((row) => (
        <Card key={row.id}>
          <Text style={styles.question}>{row.question_text}</Text>
          <Text style={styles.meta}>Mode: {row.engagement_mode}</Text>
          <Text style={styles.meta}>Status: {row.status}</Text>
          <Text style={styles.meta}>
            Public: {row.public_opt_in ? 'yes' : 'no'} ({row.moderation_status})
          </Text>
        </Card>
      ))}

      {!loading && requests.length === 0 ? <Text style={styles.empty}>No requests yet.</Text> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f6f9fc' },
  content: { padding: 16 },
  title: { fontSize: 24, fontWeight: '800', color: '#102a43' },
  subtitle: { color: '#486581', marginTop: 4, marginBottom: 12 },
  question: { color: '#102a43', fontWeight: '700' },
  meta: { color: '#486581', marginTop: 4 },
  empty: { color: '#627d98', marginTop: 12 }
});

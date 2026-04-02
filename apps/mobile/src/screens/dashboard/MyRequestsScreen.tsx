import { useEffect, useMemo, useState } from 'react';
import { Alert, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Session } from '@supabase/supabase-js';
import { Card } from '../../components/Card';
import { supabase } from '../../lib/supabase';

type RequestRow = {
  id: string;
  question_text: string;
  status: string;
  paid_at?: string | null;
  accepted_at?: string | null;
  delivered_at?: string | null;
  created_at: string;
  coach_service?: { title?: string | null } | null;
};

export function MyRequestsScreen({ session }: { session: Session }) {
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('engagement_requests')
      .select('id, question_text, status, paid_at, accepted_at, delivered_at, created_at, coach_service:coach_services!engagement_requests_coach_service_id_fkey(title)')
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

  const grouped = useMemo(() => ({
    needsAction: requests.filter((row) => ['payment_pending', 'queued', 'paid'].includes(row.status)),
    inProgress: requests.filter((row) => ['accepted', 'scheduled', 'in_review', 'in_call'].includes(row.status)),
    completed: requests.filter((row) => ['delivered', 'refunded', 'declined', 'expired', 'cancelled'].includes(row.status))
  }), [requests]);

  const renderSection = (title: string, rows: RequestRow[]) => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {rows.length === 0 ? <Text style={styles.empty}>No requests in this section.</Text> : null}
      {rows.map((row) => (
        <Card key={row.id}>
          <Text style={styles.service}>{row.coach_service?.title ?? 'Coach service'}</Text>
          <Text style={styles.question}>{row.question_text}</Text>
          <Text style={styles.meta}>Status: {row.status}</Text>
          <Text style={styles.meta}>Created: {new Date(row.created_at).toLocaleString()}</Text>
          {row.delivered_at ? <Text style={styles.meta}>Delivered: {new Date(row.delivered_at).toLocaleString()}</Text> : null}
        </Card>
      ))}
    </View>
  );

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
    >
      <Text style={styles.title}>My Requests</Text>
      <Text style={styles.subtitle}>Track every paid request from checkout to delivered feedback.</Text>
      {renderSection('Needs Action', grouped.needsAction)}
      {renderSection('In Progress', grouped.inProgress)}
      {renderSection('Completed', grouped.completed)}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f6f9fc' },
  content: { padding: 16, gap: 16 },
  title: { fontSize: 24, fontWeight: '800', color: '#102a43' },
  subtitle: { color: '#486581', marginTop: 4 },
  section: { gap: 8 },
  sectionTitle: { color: '#102a43', fontWeight: '800', fontSize: 18 },
  service: { color: '#0b3a53', fontWeight: '700' },
  question: { color: '#102a43', fontWeight: '700' },
  meta: { color: '#486581', marginTop: 4 },
  empty: { color: '#627d98' }
});

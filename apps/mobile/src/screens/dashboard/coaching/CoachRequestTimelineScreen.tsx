import { useEffect, useState } from 'react';
import { Alert, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button } from '../../../components/Button';
import { invokeFunction } from '../../../lib/api';

type RequestDetail = {
  id: string;
  status: string;
  paid_at?: string | null;
  accepted_at?: string | null;
  delivered_at?: string | null;
  question_text: string;
  coach_service?: { title?: string; service_type?: string } | null;
  engagement_status_events?: Array<{ id: string; event_type: string; to_status?: string | null; created_at: string }>;
  engagement_responses?: Array<{ id: string; summary_text?: string | null }>;
};

type Props = {
  engagementRequestId: string;
  onBack: () => void;
  onOpenFeedback: () => void;
};

export function CoachRequestTimelineScreen({ engagementRequestId, onBack, onOpenFeedback }: Props) {
  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState<RequestDetail | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const data = await invokeFunction<RequestDetail>('coach-feedback-get', {
        body: { engagementRequestId }
      });
      setDetail(data);
    } catch (error) {
      Alert.alert('Unable to load request', error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [engagementRequestId]);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
    >
      <Text style={styles.title}>Request Timeline</Text>
      <Text style={styles.subtitle}>{detail?.coach_service?.title ?? 'Coach request'}</Text>

      <View style={styles.card}>
        <Text style={styles.status}>{detail?.status ?? 'Loading...'}</Text>
        <Text style={styles.question}>{detail?.question_text ?? ''}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Timeline</Text>
        {(detail?.engagement_status_events ?? []).map((event) => (
          <View key={event.id} style={styles.timelineRow}>
            <Text style={styles.timelineEvent}>{event.event_type}</Text>
            <Text style={styles.timelineMeta}>{new Date(event.created_at).toLocaleString()}</Text>
          </View>
        ))}
      </View>

      <View style={styles.actions}>
        <Button title="Back" onPress={onBack} tone="secondary" />
        <Button title="Open Feedback" onPress={onOpenFeedback} disabled={detail?.status !== 'delivered'} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f6f9fc' },
  content: { padding: 16, gap: 12 },
  title: { color: '#102a43', fontSize: 24, fontWeight: '800' },
  subtitle: { color: '#486581' },
  card: { backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#d9e2ec', padding: 16, gap: 8 },
  status: { color: '#0b3a53', fontWeight: '800', textTransform: 'uppercase' },
  question: { color: '#334e68' },
  cardTitle: { color: '#102a43', fontWeight: '700', fontSize: 16 },
  timelineRow: { borderTopWidth: 1, borderTopColor: '#eef2f6', paddingTop: 10, marginTop: 6 },
  timelineEvent: { color: '#102a43', fontWeight: '600' },
  timelineMeta: { color: '#627d98', fontSize: 12, marginTop: 2 },
  actions: { gap: 10, paddingBottom: 24 }
});

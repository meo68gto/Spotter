import { Session } from '@supabase/supabase-js';
import { RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSessionLifecycle } from '../../../hooks/useSessionLifecycle';

type Props = {
  session: Session;
  onOpenSessionChat: (sessionId: string) => void;
  onOpenVideoCall: (engagementRequestId: string) => void;
  onOpenReview: (sessionId: string) => void;
};

export function ActiveSessionScreen({ session, onOpenSessionChat, onOpenVideoCall, onOpenReview }: Props) {
  const lifecycle = useSessionLifecycle(session);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={lifecycle.loading} onRefresh={lifecycle.refresh} />}
    >
      <Text style={styles.title}>Active Coaching</Text>
      <Text style={styles.subtitle}>Confirmed sessions and live-call engagements.</Text>

      {lifecycle.rows.map((row) => (
        <View key={row.id} style={styles.card}>
          <Text style={styles.cardTitle}>Session {row.id.slice(0, 8)}</Text>
          <Text style={styles.meta}>Status: {row.status}</Text>
          <Text style={styles.meta}>Starts: {new Date(row.confirmed_time ?? row.proposed_start_time).toLocaleString()}</Text>
          <View style={styles.actions}>
            <TouchableOpacity style={styles.primaryBtn} onPress={() => onOpenSessionChat(row.id)}>
              <Text style={styles.primaryText}>Open Chat</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryBtn} onPress={() => onOpenReview(row.id)}>
              <Text style={styles.secondaryText}>Review</Text>
            </TouchableOpacity>
          </View>
        </View>
      ))}

      {lifecycle.engagements.map((row) => (
        <View key={row.id} style={styles.card}>
          <Text style={styles.cardTitle}>Call Request {row.id.slice(0, 8)}</Text>
          <Text style={styles.meta}>Status: {row.status}</Text>
          <Text style={styles.meta}>Scheduled: {row.scheduled_time ? new Date(row.scheduled_time).toLocaleString() : 'ASAP'}</Text>
          <View style={styles.actions}>
            <TouchableOpacity style={styles.primaryBtn} onPress={() => onOpenVideoCall(row.id)}>
              <Text style={styles.primaryText}>Join Call</Text>
            </TouchableOpacity>
          </View>
        </View>
      ))}

      {!lifecycle.loading && lifecycle.rows.length === 0 && lifecycle.engagements.length === 0 ? (
        <Text style={styles.empty}>No active coaching sessions right now.</Text>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f6f9fc' },
  content: { padding: 16 },
  title: { color: '#102a43', fontSize: 26, fontWeight: '800' },
  subtitle: { color: '#486581', marginBottom: 10 },
  card: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#d9e2ec', borderRadius: 12, padding: 12, marginTop: 10 },
  cardTitle: { color: '#102a43', fontWeight: '800' },
  meta: { color: '#486581', marginTop: 4 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 10 },
  primaryBtn: { backgroundColor: '#0b3a53', paddingVertical: 9, paddingHorizontal: 12, borderRadius: 10 },
  primaryText: { color: '#fff', fontWeight: '700' },
  secondaryBtn: { borderWidth: 1, borderColor: '#d9e2ec', backgroundColor: '#fff', paddingVertical: 9, paddingHorizontal: 12, borderRadius: 10 },
  secondaryText: { color: '#102a43', fontWeight: '700' },
  empty: { color: '#829ab1', marginTop: 12 }
});

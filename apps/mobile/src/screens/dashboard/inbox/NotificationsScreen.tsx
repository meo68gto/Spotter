import { Session } from '@supabase/supabase-js';
import { useEffect, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Button } from '../../../components/Button';
import { supabase } from '../../../lib/supabase';

type NotificationEvent = {
  id: string;
  event_type: string;
  channel: string;
  status: string;
  payload: Record<string, unknown>;
  created_at: string;
};

export function NotificationsScreen({ session, onBack }: { session: Session; onBack: () => void }) {
  const [rows, setRows] = useState<NotificationEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('');

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('notification_events')
      .select('id, event_type, channel, status, payload, created_at')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false })
      .limit(100);
    setRows((data ?? []) as NotificationEvent[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    if (!filter.trim()) return rows;
    const q = filter.trim().toLowerCase();
    return rows.filter((row) => row.event_type.toLowerCase().includes(q) || row.status.toLowerCase().includes(q));
  }, [filter, rows]);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
    >
      <Button title="Back" onPress={onBack} tone="secondary" />
      <Text style={styles.title}>Notifications</Text>

      <TextInput value={filter} onChangeText={setFilter} placeholder="Filter events" style={styles.input} />

      {filtered.map((row) => (
        <View key={row.id} style={styles.card}>
          <Text style={styles.type}>{row.event_type}</Text>
          <Text style={styles.meta}>{row.channel} • {row.status}</Text>
          <Text style={styles.time}>{new Date(row.created_at).toLocaleString()}</Text>
        </View>
      ))}

      {!loading && filtered.length === 0 ? <Text style={styles.empty}>No notifications</Text> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f6f9fc' },
  content: { padding: 16 },
  title: { color: '#102a43', fontSize: 24, fontWeight: '800', marginTop: 8 },
  input: {
    marginTop: 10,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#d9e2ec',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8
  },
  card: { marginTop: 10, backgroundColor: '#fff', borderWidth: 1, borderColor: '#d9e2ec', borderRadius: 12, padding: 10 },
  type: { color: '#102a43', fontWeight: '700' },
  meta: { color: '#486581', marginTop: 3 },
  time: { color: '#829ab1', marginTop: 4, fontSize: 12 },
  empty: { color: '#829ab1', marginTop: 12 }
});

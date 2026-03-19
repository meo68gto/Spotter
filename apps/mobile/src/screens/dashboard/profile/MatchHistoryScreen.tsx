import { Session } from '@supabase/supabase-js';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button } from '../../../components/Button';
import { useMatchHistory } from '../../../hooks/useMatchHistory';

export function MatchHistoryScreen({ session, onBack }: { session: Session; onBack: () => void }) {
  const history = useMatchHistory(session);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={history.loading} onRefresh={history.refresh} />}
    >
      <Button title="Back" onPress={onBack} tone="secondary" />
      <Text style={styles.title}>Match History</Text>
      {history.matches.map((row) => (
        <View key={row.id} style={styles.card}>
          <Text style={styles.id}>Match {row.id.slice(0, 8)}</Text>
          <Text style={styles.meta}>Status: {row.status}</Text>
          <Text style={styles.meta}>Created: {new Date(row.created_at).toLocaleString()}</Text>
        </View>
      ))}
      {!history.loading && history.matches.length === 0 ? <Text style={styles.empty}>No history yet.</Text> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f6f9fc' },
  content: { padding: 16 },
  title: { color: '#102a43', fontSize: 24, fontWeight: '800', marginTop: 8 },
  card: { marginTop: 10, backgroundColor: '#fff', borderWidth: 1, borderColor: '#d9e2ec', borderRadius: 12, padding: 10 },
  id: { color: '#102a43', fontWeight: '700' },
  meta: { color: '#486581', marginTop: 3 },
  empty: { color: '#829ab1', marginTop: 10 }
});

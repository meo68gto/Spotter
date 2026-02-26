import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text } from 'react-native';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { invokeFunction } from '../../lib/api';
import { formatMode } from './ui-utils';

type FeedItem = {
  id: string;
  score: number;
  published_at: string;
  engagement_requests: {
    id: string;
    question_text: string;
    engagement_mode: string;
    engagement_responses: Array<{
      response_text: string | null;
      transcript: string | null;
    }>;
  } | null;
};

export function FeedScreen() {
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<FeedItem[]>([]);

  const load = async () => {
    setLoading(true);
    try {
      // S-5: Intentionally unauthenticated — feed-home is a public endpoint
      const data = await invokeFunction<FeedItem[]>('feed-home', {
        method: 'GET',
        query: { limit: 20 },
        requireAuth: false
      });
      setItems(data ?? []);
    } catch (error) {
      Alert.alert('Feed load failed', error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Feed</Text>
      <Text style={styles.subtitle}>Public approved Coacher posts.</Text>
      <Button title={loading ? 'Refreshing...' : 'Refresh Feed'} onPress={load} disabled={loading} />
      {loading ? <ActivityIndicator style={styles.loader} /> : null}

      {items.map((item) => (
        <Card key={item.id}>
          <Text style={styles.question}>{item.engagement_requests?.question_text ?? 'Unknown question'}</Text>
          <Text style={styles.meta}>Mode: {formatMode(item.engagement_requests?.engagement_mode ?? '')}</Text>
          <Text style={styles.answer}>
            {item.engagement_requests?.engagement_responses?.[0]?.response_text ??
              item.engagement_requests?.engagement_responses?.[0]?.transcript ??
              'Response available as media'}
          </Text>
        </Card>
      ))}

      {!loading && items.length === 0 ? <Text style={styles.empty}>No public answers yet.</Text> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f6f9fc' },
  content: { padding: 16 },
  title: { fontSize: 24, fontWeight: '800', color: '#102a43' },
  subtitle: { color: '#486581', marginTop: 4, marginBottom: 12 },
  loader: { marginTop: 12 },
  question: { color: '#102a43', fontWeight: '700', fontSize: 16 },
  answer: { color: '#334e68', marginTop: 8 },
  meta: { color: '#627d98', marginTop: 4 },
  empty: { color: '#627d98', marginTop: 12 }
});

import { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button } from '../../../components/Button';
import { VideoPlayer } from '../../../components/VideoPlayer';
import { invokeFunction } from '../../../lib/api';

type FeedbackData = {
  id: string;
  status: string;
  engagement_responses?: Array<{
    id: string;
    summary_text?: string | null;
    response_text?: string | null;
    video_url?: string | null;
    audio_url?: string | null;
    structured_feedback?: Record<string, unknown>;
  }>;
};

type Props = {
  engagementRequestId: string;
  onBack: () => void;
};

export function CoachFeedbackScreen({ engagementRequestId, onBack }: Props) {
  const [data, setData] = useState<FeedbackData | null>(null);

  useEffect(() => {
    invokeFunction<FeedbackData>('coach-feedback-get', {
      body: { engagementRequestId }
    })
      .then(setData)
      .catch((error) => Alert.alert('Unable to load feedback', error instanceof Error ? error.message : 'Unknown error'));
  }, [engagementRequestId]);

  const response = data?.engagement_responses?.[0];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Coach Feedback</Text>
      <Text style={styles.subtitle}>Your delivered review package lives here.</Text>

      {response?.video_url ? <VideoPlayer videoUrl={response.video_url} /> : null}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Summary</Text>
        <Text style={styles.body}>{response?.summary_text || response?.response_text || 'Feedback will appear here once delivered.'}</Text>
      </View>

      {response?.structured_feedback ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Structured feedback</Text>
          <Text style={styles.body}>{JSON.stringify(response.structured_feedback, null, 2)}</Text>
        </View>
      ) : null}

      <View style={styles.actions}>
        <Button title="Back to Timeline" onPress={onBack} tone="secondary" />
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
  cardTitle: { color: '#102a43', fontWeight: '700', fontSize: 16 },
  body: { color: '#334e68', lineHeight: 20 },
  actions: { gap: 10, paddingBottom: 24 }
});

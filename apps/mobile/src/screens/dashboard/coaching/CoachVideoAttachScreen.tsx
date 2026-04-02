import { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button } from '../../../components/Button';
import { useVideoUpload } from '../../../hooks/useVideoUpload';
import { supabase } from '../../../lib/supabase';

type Props = {
  engagementRequestId: string;
  onBack: () => void;
  onContinue: (videoSubmissionId: string | null) => void;
};

export function CoachVideoAttachScreen({ engagementRequestId, onBack, onContinue }: Props) {
  const upload = useVideoUpload();
  const [activityId, setActivityId] = useState<string>('00000000-0000-0000-0000-000000000001');

  useEffect(() => {
    supabase
      .from('activities')
      .select('id')
      .eq('slug', 'golf')
      .maybeSingle()
      .then(({ data }) => {
        if (data?.id) setActivityId(data.id);
      });
  }, []);

  const pickAndUpload = async (source: 'library' | 'camera') => {
    const uri = source === 'library' ? await upload.pickVideo() : await upload.recordVideo();
    if (!uri) return;
    const ok = await upload.uploadVideo(uri, activityId, undefined, engagementRequestId);
    if (!ok) {
      Alert.alert('Upload failed', upload.error ?? 'Please try again.');
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Attach Video</Text>
      <Text style={styles.subtitle}>Upload the swing or clip you want the coach to review before checkout.</Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Upload status</Text>
        <Text style={styles.body}>State: {upload.status}</Text>
        <Text style={styles.body}>Progress: {Math.round(upload.progress * 100)}%</Text>
        {upload.videoSubmissionId ? <Text style={styles.meta}>Submission: {upload.videoSubmissionId.slice(0, 8)}</Text> : null}
        {upload.error ? <Text style={styles.error}>{upload.error}</Text> : null}
      </View>

      <View style={styles.actions}>
        <Button title="Choose from Library" onPress={() => pickAndUpload('library')} />
        <Button title="Record Video" onPress={() => pickAndUpload('camera')} tone="secondary" />
        <Button title="Back" onPress={onBack} tone="secondary" />
        <Button title="Continue to Checkout" onPress={() => onContinue(upload.videoSubmissionId)} disabled={!upload.videoSubmissionId} />
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
  body: { color: '#334e68' },
  meta: { color: '#486581', fontWeight: '600' },
  error: { color: '#c53030' },
  actions: { gap: 10, paddingBottom: 24 }
});

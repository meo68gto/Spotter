import { Session } from '@supabase/supabase-js';
import { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { invokeFunction } from '../../lib/api';
import { supabase } from '../../lib/supabase';

type CoachOption = {
  id: string;
  user_id: string;
};

type Mode = 'text_answer' | 'video_answer' | 'video_call';

export function AskScreen({ session }: { session: Session }) {
  const [coaches, setCoaches] = useState<CoachOption[]>([]);
  const [coachId, setCoachId] = useState('');
  const [mode, setMode] = useState<Mode>('text_answer');
  const [questionText, setQuestionText] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  const [loading, setLoading] = useState(false);

  const loadCoaches = async () => {
    const { data } = await supabase.from('coaches').select('id, user_id').order('created_at', { ascending: false }).limit(20);
    setCoaches((data ?? []) as CoachOption[]);
    if (!coachId && data?.[0]?.id) setCoachId(data[0].id);
  };

  useEffect(() => {
    loadCoaches();
  }, []);

  const submit = async () => {
    if (!coachId || !questionText.trim()) {
      Alert.alert('Missing fields', 'Coach and question are required.');
      return;
    }

    setLoading(true);
    try {
      const data = await invokeFunction<{ request: { id: string }; clientSecret?: string }>('engagements-create', {
        method: 'POST',
        body: {
          coachId,
          engagementMode: mode,
          questionText: questionText.trim(),
          scheduledTime: scheduledTime.trim() || undefined
        }
      });

      Alert.alert('Submitted', `Request created: ${data.request.id}`);
      setQuestionText('');
      setScheduledTime('');
    } catch (error) {
      Alert.alert('Submit failed', error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Ask</Text>
      <Text style={styles.subtitle}>Create text, video, or live call requests.</Text>

      <Card>
        <Text style={styles.label}>Coach</Text>
        {coaches.map((coach) => (
          <Button
            key={coach.id}
            title={`${coach.id.slice(0, 8)}${coachId === coach.id ? ' (Selected)' : ''}`}
            onPress={() => setCoachId(coach.id)}
          />
        ))}

        <Text style={styles.label}>Mode</Text>
        <View style={styles.modeRow}>
          <Button title={`Text${mode === 'text_answer' ? ' ✓' : ''}`} onPress={() => setMode('text_answer')} />
          <Button title={`Video${mode === 'video_answer' ? ' ✓' : ''}`} onPress={() => setMode('video_answer')} />
          <Button title={`Call${mode === 'video_call' ? ' ✓' : ''}`} onPress={() => setMode('video_call')} />
        </View>

        <Text style={styles.label}>Question</Text>
        <TextInput
          value={questionText}
          onChangeText={setQuestionText}
          placeholder="What should I improve next?"
          multiline
          style={styles.textarea}
        />

        <Text style={styles.label}>Scheduled time (optional ISO)</Text>
        <TextInput
          value={scheduledTime}
          onChangeText={setScheduledTime}
          placeholder="2026-02-25T17:00:00Z"
          style={styles.input}
          autoCapitalize="none"
        />

        <Button title={loading ? 'Submitting...' : 'Submit Request'} onPress={submit} disabled={loading} />
      </Card>

      <Text style={styles.me}>Signed in: {session.user.email}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f6f9fc' },
  content: { padding: 16 },
  title: { fontSize: 24, fontWeight: '800', color: '#102a43' },
  subtitle: { color: '#486581', marginTop: 4, marginBottom: 12 },
  label: { marginTop: 12, marginBottom: 6, color: '#334e68', fontWeight: '600' },
  modeRow: { gap: 8 },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#d9e2ec',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  textarea: {
    minHeight: 90,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#d9e2ec',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    textAlignVertical: 'top'
  },
  me: { color: '#9fb3c8', marginTop: 12, fontSize: 12 }
});

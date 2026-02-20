import { Session } from '@supabase/supabase-js';
import { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput } from 'react-native';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { invokeFunction } from '../../lib/api';
import { supabase } from '../../lib/supabase';

type QueueItem = {
  id: string;
  question_text: string;
  status: string;
  engagement_mode: 'text_answer' | 'video_answer' | 'video_call';
};

export function ExpertConsoleScreen({ session }: { session: Session }) {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [responseText, setResponseText] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [dnd, setDnd] = useState(false);

  const loadQueue = async () => {
    const { data: coach } = await supabase.from('coaches').select('id').eq('user_id', session.user.id).maybeSingle();
    if (!coach) {
      setQueue([]);
      return;
    }

    const { data } = await supabase
      .from('engagement_requests')
      .select('id, question_text, status, engagement_mode')
      .eq('coach_id', coach.id)
      .in('status', ['awaiting_expert', 'accepted', 'in_progress'])
      .order('created_at', { ascending: false })
      .limit(30);

    const next = (data ?? []) as QueueItem[];
    setQueue(next);
    if (!selectedId && next[0]?.id) setSelectedId(next[0].id);
  };

  useEffect(() => {
    loadQueue();
  }, []);

  const accept = async (id: string) => {
    await invokeFunction('engagements-accept', { method: 'POST', body: { engagementRequestId: id } });
    await loadQueue();
  };

  const decline = async (id: string) => {
    await invokeFunction('engagements-decline', { method: 'POST', body: { engagementRequestId: id } });
    await loadQueue();
  };

  const respond = async () => {
    if (!selectedId || !responseText.trim()) {
      Alert.alert('Missing fields', 'Select a request and enter response text.');
      return;
    }

    await invokeFunction('engagements-respond', {
      method: 'POST',
      body: {
        engagementRequestId: selectedId,
        responseText: responseText.trim()
      }
    });

    setResponseText('');
    await loadQueue();
  };

  const toggleDnd = async () => {
    const next = !dnd;
    await invokeFunction('experts-dnd-toggle', { method: 'POST', body: { enabled: next } });
    setDnd(next);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Expert Console</Text>
      <Text style={styles.subtitle}>Accept/decline/respond, then manage DND.</Text>

      <Button title={dnd ? 'Disable DND' : 'Enable DND'} onPress={toggleDnd} />
      <Button title="Refresh Queue" onPress={loadQueue} />

      {queue.map((item) => (
        <Card key={item.id}>
          <Text style={styles.question}>{item.question_text}</Text>
          <Text style={styles.meta}>Mode: {item.engagement_mode}</Text>
          <Text style={styles.meta}>Status: {item.status}</Text>
          <Button title={selectedId === item.id ? 'Selected' : 'Select'} onPress={() => setSelectedId(item.id)} />
          <Button title="Accept" onPress={() => accept(item.id)} />
          <Button title="Decline" onPress={() => decline(item.id)} />
        </Card>
      ))}

      <Card>
        <Text style={styles.label}>Response text</Text>
        <TextInput
          value={responseText}
          onChangeText={setResponseText}
          multiline
          placeholder="Provide coaching response"
          style={styles.textarea}
        />
        <Button title="Submit Response" onPress={respond} />
      </Card>
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
  label: { color: '#334e68', marginBottom: 8, fontWeight: '600' },
  textarea: {
    minHeight: 90,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#d9e2ec',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    textAlignVertical: 'top'
  }
});

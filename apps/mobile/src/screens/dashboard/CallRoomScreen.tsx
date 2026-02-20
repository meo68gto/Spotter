import { Session } from '@supabase/supabase-js';
import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput } from 'react-native';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { invokeFunction } from '../../lib/api';

export function CallRoomScreen({ session }: { session: Session }) {
  const [engagementRequestId, setEngagementRequestId] = useState('');
  const [roomUrl, setRoomUrl] = useState('');

  const createRoom = async () => {
    if (!engagementRequestId.trim()) return Alert.alert('Missing ID', 'Enter engagement request id.');
    try {
      const payload = await invokeFunction<{ roomUrl: string }>('calls-create-room', {
        method: 'POST',
        body: { engagementRequestId: engagementRequestId.trim() }
      });
      setRoomUrl(payload.roomUrl);
    } catch (error) {
      Alert.alert('Create room failed', error instanceof Error ? error.message : 'Unknown error');
    }
  };

  const start = async () => {
    if (!engagementRequestId.trim()) return;
    await invokeFunction('calls-start', { method: 'POST', body: { engagementRequestId: engagementRequestId.trim() } });
    Alert.alert('Call started', 'Call start timestamp recorded.');
  };

  const end = async () => {
    if (!engagementRequestId.trim()) return;
    const data = await invokeFunction<{ billableMinutes: number }>('calls-end', {
      method: 'POST',
      body: { engagementRequestId: engagementRequestId.trim() }
    });
    Alert.alert('Call ended', `Billable minutes: ${data.billableMinutes}`);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Call Room</Text>
      <Text style={styles.subtitle}>Daily room lifecycle for 1:1 paid video calls.</Text>

      <Card>
        <Text style={styles.label}>Engagement Request ID</Text>
        <TextInput
          value={engagementRequestId}
          onChangeText={setEngagementRequestId}
          placeholder="paste request id"
          style={styles.input}
          autoCapitalize="none"
        />

        <Button title="Create Room" onPress={createRoom} />
        <Button title="Start Call" onPress={start} />
        <Button title="End Call" onPress={end} />

        {roomUrl ? <Text style={styles.room}>Room URL: {roomUrl}</Text> : null}
      </Card>

      <Text style={styles.meta}>Signed in: {session.user.email}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f6f9fc' },
  content: { padding: 16 },
  title: { fontSize: 24, fontWeight: '800', color: '#102a43' },
  subtitle: { color: '#486581', marginTop: 4, marginBottom: 12 },
  label: { color: '#334e68', marginBottom: 8, fontWeight: '600' },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#d9e2ec',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  room: { marginTop: 10, color: '#334e68' },
  meta: { marginTop: 12, color: '#9fb3c8', fontSize: 12 }
});

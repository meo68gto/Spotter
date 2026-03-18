import { Session } from '@supabase/supabase-js';
import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { Button } from '../../../components/Button';
import { invokeFunction } from '../../../lib/api';

type CallPayload = {
  roomUrl: string;
  host_token?: string;
  guest_token?: string;
};

export function VideoCallScreen({ session, defaultEngagementRequestId, onBack }: { session: Session; defaultEngagementRequestId?: string; onBack: () => void }) {
  const [engagementRequestId, setEngagementRequestId] = useState(defaultEngagementRequestId ?? '');
  const [roomUrl, setRoomUrl] = useState('');
  const [busy, setBusy] = useState(false);

  const createRoom = async () => {
    if (!engagementRequestId.trim()) return;
    setBusy(true);
    try {
      const data = await invokeFunction<CallPayload>('calls-create-room', {
        method: 'POST',
        body: { engagementRequestId: engagementRequestId.trim() }
      });
      setRoomUrl(data.roomUrl);
    } catch (error) {
      Alert.alert('Create room failed', error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setBusy(false);
    }
  };

  const start = async () => {
    if (!engagementRequestId.trim()) return;
    try {
      await invokeFunction('calls-start', { method: 'POST', body: { engagementRequestId: engagementRequestId.trim() } });
    } catch (error) {
      Alert.alert('Start failed', error instanceof Error ? error.message : 'Unknown error');
    }
  };

  const end = async () => {
    if (!engagementRequestId.trim()) return;
    try {
      const data = await invokeFunction<{ billableMinutes: number }>('calls-end', { method: 'POST', body: { engagementRequestId: engagementRequestId.trim() } });
      Alert.alert('Call ended', `Billable minutes: ${data.billableMinutes}`);
    } catch (error) {
      Alert.alert('End failed', error instanceof Error ? error.message : 'Unknown error');
    }
  };

  if (roomUrl) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Button title="Back" onPress={onBack} tone="secondary" />
          <Button title="Start" onPress={start} />
          <Button title="End" onPress={end} tone="secondary" />
        </View>
        <WebView source={{ uri: roomUrl }} allowsInlineMediaPlayback mediaPlaybackRequiresUserAction={false} style={styles.webview} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Video Call</Text>
      <Text style={styles.subtitle}>Embedded Daily room with lifecycle controls.</Text>
      <TextInput value={engagementRequestId} onChangeText={setEngagementRequestId} style={styles.input} placeholder="Engagement request ID" autoCapitalize="none" />
      <Button title={busy ? 'Creating...' : 'Create Room'} onPress={createRoom} disabled={busy} />
      <Button title="Back" onPress={onBack} tone="secondary" />
      <Text style={styles.meta}>Signed in: {session.user.email}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f6f9fc' },
  content: { padding: 16 },
  title: { color: '#102a43', fontSize: 24, fontWeight: '800' },
  subtitle: { color: '#486581', marginBottom: 10 },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#d9e2ec',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8
  },
  meta: { color: '#829ab1', marginTop: 12 },
  header: { flexDirection: 'row', gap: 8, padding: 8, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#d9e2ec' },
  webview: { flex: 1 }
});

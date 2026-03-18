import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useState } from 'react';
import { Button } from '../../../components/Button';
import { invokeFunction } from '../../../lib/api';

export function ReviewCoachSheet({ visible, sessionId, onClose }: { visible: boolean; sessionId: string | null; onClose: () => void }) {
  const [tag, setTag] = useState('Great teacher');
  const [loading, setLoading] = useState(false);

  const submit = async (thumbsUp: boolean) => {
    if (!sessionId) return;
    setLoading(true);
    try {
      await invokeFunction('sessions-feedback', {
        method: 'POST',
        body: {
          sessionId,
          thumbsUp,
          tag: tag.trim() || undefined
        }
      });
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={styles.sheet}>
          <Text style={styles.title}>Review Coach</Text>
          <TextInput value={tag} onChangeText={setTag} style={styles.input} placeholder="Optional tag" />
          <Button title={loading ? 'Saving...' : 'Thumbs Up'} onPress={() => submit(true)} disabled={loading} />
          <Button title="Thumbs Down" onPress={() => submit(false)} disabled={loading} tone="secondary" />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(15,23,42,0.4)' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: 16 },
  title: { color: '#102a43', fontSize: 20, fontWeight: '800' },
  input: {
    marginTop: 10,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#d9e2ec',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8
  }
});

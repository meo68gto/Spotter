import { Session } from '@supabase/supabase-js';
import { useEffect, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { ThreadType, useInboxThreadMessages } from '../../../hooks/useInboxThreadMessages';
import { Button } from '../../../components/Button';
import { fireRefreshDoneHaptic, fireRefreshStartHaptic } from '../../../lib/haptics';
import { motion } from '../../../lib/motion';
import { useTheme } from '../../../theme/provider';

export function ChatScreen({
  session,
  threadType,
  threadId,
  title,
  onBack
}: {
  session: Session;
  threadType: ThreadType;
  threadId: string;
  title: string;
  onBack: () => void;
}) {
  const { tokens } = useTheme();
  const [draft, setDraft] = useState('');
  const { loading, messages, send, markRead } = useInboxThreadMessages(session, threadType, threadId);

  useEffect(() => {
    markRead();
  }, [markRead]);

  return (
    <View style={[styles.container, { backgroundColor: tokens.background }]}>
      {/* @ts-expect-error TypeScript 5.7+ compatibility with react-native-reanimated */}
      <Animated.View entering={motion.screenEnter} style={[styles.header, { borderBottomColor: tokens.border, backgroundColor: tokens.surface }]}>
        <Button title="Back" accessibilityLabel="Back to conversations" onPress={onBack} tone="secondary" />
        <Text style={[styles.title, { color: tokens.text }]}>{title}</Text>
        <Text style={[styles.meta, { color: tokens.textMuted }]}>{threadType.toUpperCase()}</Text>
      </Animated.View>

      <FlatList
        data={messages}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={async () => {
          await fireRefreshStartHaptic();
          await markRead();
          await fireRefreshDoneHaptic();
        }} />}
        renderItem={({ item }) => {
          const mine = item.sender_user_id === session.user.id;
          return (
            <View style={[styles.bubble, mine ? [styles.bubbleMine, { backgroundColor: tokens.primary }] : [styles.bubbleOther, { backgroundColor: tokens.surface, borderColor: tokens.border }]]}>
              <Text style={[styles.bubbleText, { color: mine ? tokens.primaryContrast : tokens.text }]}>{item.message}</Text>
              <Text style={[styles.time, { color: mine ? tokens.primaryContrast : tokens.textMuted }]}>{new Date(item.created_at).toLocaleTimeString()}</Text>
            </View>
          );
        }}
      />

      <View style={[styles.composer, { borderTopColor: tokens.border, backgroundColor: tokens.surface }]}>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          style={[styles.input, { borderColor: tokens.border, color: tokens.text, backgroundColor: tokens.backgroundElevated }]}
          placeholder="Message"
          accessibilityLabel="Message composer"
          placeholderTextColor={tokens.textMuted}
        />
        <TouchableOpacity
          style={[styles.sendBtn, { backgroundColor: tokens.primary }]}
          accessibilityRole="button"
          accessibilityLabel="Send message"
          onPress={async () => {
            const next = draft;
            setDraft('');
            await send(next);
          }}
        >
          <Text style={[styles.sendText, { color: tokens.primaryContrast }]}>Send</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { padding: 12, borderBottomWidth: 1 },
  title: { fontSize: 18, fontWeight: '800', marginTop: 8 },
  meta: { marginTop: 2 },
  listContent: { padding: 12 },
  bubble: { maxWidth: '84%', borderRadius: 12, padding: 10, marginBottom: 8 },
  bubbleMine: { alignSelf: 'flex-end' },
  bubbleOther: { alignSelf: 'flex-start', borderWidth: 1 },
  bubbleText: {},
  time: { marginTop: 4, fontSize: 11 },
  composer: { flexDirection: 'row', borderTopWidth: 1, padding: 10 },
  input: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8
  },
  sendBtn: { marginLeft: 8, borderRadius: 10, paddingHorizontal: 12, justifyContent: 'center' },
  sendText: { fontWeight: '700' }
});

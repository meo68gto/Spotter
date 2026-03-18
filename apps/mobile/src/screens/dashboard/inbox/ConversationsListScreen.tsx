import { RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { InboxThread, useInboxThreads } from '../../../hooks/useInboxThreads';
import { Button } from '../../../components/Button';
import { Skeleton } from '../../../components/Skeleton';
import { motion } from '../../../lib/motion';
import { fireRefreshDoneHaptic, fireRefreshStartHaptic } from '../../../lib/haptics';
import { useTheme } from '../../../theme/provider';

export function ConversationsListScreen({
  onOpenThread,
  onOpenNotifications
}: {
  onOpenThread: (thread: InboxThread) => void;
  onOpenNotifications: () => void;
}) {
  const { tokens } = useTheme();
  const { loading, threads, refresh } = useInboxThreads();

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: tokens.background }]}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={loading}
          onRefresh={async () => {
            await fireRefreshStartHaptic();
            await refresh();
            await fireRefreshDoneHaptic();
          }}
        />
      }
    >
      <Text style={[styles.title, { color: tokens.text }]}>Inbox</Text>
      <Text style={[styles.subtitle, { color: tokens.textSecondary }]}>Sessions and engagement request conversations.</Text>

      <Button title="Notifications" accessibilityLabel="Open notifications" onPress={onOpenNotifications} tone="secondary" />

      {loading && threads.length === 0 ? (
        <>
          <Skeleton style={styles.skeleton} />
          <Skeleton style={styles.skeleton} />
          <Skeleton style={styles.skeleton} />
        </>
      ) : null}

      {threads.map((thread) => (
        // @ts-expect-error TypeScript 5.7+ compatibility with react-native-reanimated
        <Animated.View
          key={`${thread.threadType}:${thread.threadId}`}
          entering={motion.cardEnter}
          layout={motion.listLayout}
        >
          <TouchableOpacity
            style={[styles.card, { backgroundColor: tokens.surface, borderColor: tokens.border }]}
            onPress={() => onOpenThread(thread)}
            accessibilityRole="button"
            accessibilityLabel={`Open ${thread.threadType} conversation ${thread.title}`}
          >
            <View style={styles.row}>
              <Text style={[styles.cardTitle, { color: tokens.text }]}>{thread.title}</Text>
              <Text style={[styles.badge, { backgroundColor: tokens.primary, color: tokens.primaryContrast }]}>{thread.unreadCount}</Text>
            </View>
            <Text style={[styles.meta, { color: tokens.textMuted }]}>{thread.threadType.toUpperCase()} • {thread.status}</Text>
            <Text style={[styles.preview, { color: tokens.textSecondary }]} numberOfLines={2}>{thread.lastMessage}</Text>
            <Text style={[styles.time, { color: tokens.textMuted }]}>{new Date(thread.lastMessageAt).toLocaleString()}</Text>
          </TouchableOpacity>
        </Animated.View>
      ))}

      {!loading && threads.length === 0 ? <Text style={[styles.empty, { color: tokens.textMuted }]}>No conversations yet.</Text> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16 },
  title: { fontSize: 26, fontWeight: '800' },
  subtitle: { marginBottom: 8 },
  skeleton: {
    marginTop: 10,
    height: 96,
    width: '100%'
  },
  card: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginTop: 10
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { fontWeight: '800' },
  badge: {
    minWidth: 22,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
    textAlign: 'center',
    fontWeight: '700'
  },
  meta: { marginTop: 4, fontSize: 12 },
  preview: { marginTop: 6 },
  time: { marginTop: 6, fontSize: 12 },
  empty: { marginTop: 12 }
});

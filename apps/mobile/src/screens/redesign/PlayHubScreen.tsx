import { Session } from '@supabase/supabase-js';
import { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { useInboxThreads } from '../../hooks/useInboxThreads';
import { invokeFunction } from '../../lib/api';
import { palette, radius, spacing } from '../../theme/design';

type RoundItem = {
  id: string;
  scheduledAt: string;
  course: { name: string; city: string; state: string };
  status: string;
  confirmedParticipants: number;
  maxPlayers: number;
  myInvitationStatus?: string;
};

export function PlayHubScreen({
  session,
  onOpenCreateRound,
  onOpenMyRounds,
  onOpenInvites,
  onOpenInbox,
}: {
  session: Session;
  onOpenCreateRound: () => void;
  onOpenMyRounds: () => void;
  onOpenInvites: () => void;
  onOpenInbox: () => void;
}) {
  const { threads, refresh: refreshThreads } = useInboxThreads();
  const [refreshing, setRefreshing] = useState(false);
  const [upcoming, setUpcoming] = useState<RoundItem[]>([]);
  const [pending, setPending] = useState<RoundItem[]>([]);

  const load = useCallback(async () => {
    const [upcomingResult, pendingResult] = await Promise.allSettled([
      invokeFunction<{ data: RoundItem[] }>('rounds-list', {
        method: 'POST',
        body: { limit: 3, status: ['open', 'full', 'confirmed', 'in_progress'], dateFrom: new Date().toISOString() },
      }),
      invokeFunction<{ data: RoundItem[] }>('rounds-list', {
        method: 'POST',
        body: { limit: 3, invitedOnly: true, status: 'open' },
      }),
    ]);

    if (upcomingResult.status === 'fulfilled') {
      setUpcoming(upcomingResult.value.data ?? []);
    }
    if (pendingResult.status === 'fulfilled') {
      setPending(pendingResult.value.data ?? []);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([load(), refreshThreads()]);
    } finally {
      setRefreshing(false);
    }
  }, [load, refreshThreads]);

  const unread = threads.reduce((sum, item) => sum + item.unreadCount, 0);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>Play together</Text>
        <Text style={styles.heroTitle}>Rounds should feel effortless.</Text>
        <Text style={styles.heroBody}>Create an open round, manage invites, and keep every play plan in one place.</Text>
      </View>

      <View style={styles.quickActions}>
        <TouchableOpacity style={styles.actionChip} onPress={onOpenCreateRound}>
          <Text style={styles.actionChipText}>Create round</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionChip} onPress={onOpenInvites}>
          <Text style={styles.actionChipText}>Invites</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionChip} onPress={onOpenInbox}>
          <Text style={styles.actionChipText}>Messages {unread > 0 ? `(${unread})` : ''}</Text>
        </TouchableOpacity>
      </View>

      <Card>
        <Text style={styles.sectionTitle}>Upcoming play</Text>
        {upcoming.length === 0 ? (
          <>
            <Text style={styles.cardBody}>No rounds are scheduled yet. Start one and let nearby golfers join you.</Text>
            <Button title="Create a round" onPress={onOpenCreateRound} />
          </>
        ) : (
          upcoming.map((round) => (
            <View key={round.id} style={styles.listItem}>
              <Text style={styles.listTitle}>{round.course.name}</Text>
              <Text style={styles.listMeta}>
                {formatDate(round.scheduledAt)} • {round.confirmedParticipants}/{round.maxPlayers} golfers
              </Text>
            </View>
          ))
        )}
        <Button title="View all rounds" onPress={onOpenMyRounds} tone="secondary" />
      </Card>

      <Card>
        <Text style={styles.sectionTitle}>Pending invitations</Text>
        {pending.length === 0 ? (
          <Text style={styles.cardBody}>No pending invites right now. When someone invites you to play, it will appear here.</Text>
        ) : (
          pending.map((round) => (
            <View key={round.id} style={styles.listItem}>
              <Text style={styles.listTitle}>{round.course.name}</Text>
              <Text style={styles.listMeta}>{formatDate(round.scheduledAt)} • {round.myInvitationStatus ?? 'Pending'}</Text>
            </View>
          ))
        )}
        <Button title="Open invites" onPress={onOpenInvites} tone="secondary" />
      </Card>
    </ScrollView>
  );
}

function formatDate(value: string) {
  return new Date(value).toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: palette.sky100 },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl * 2 },
  hero: {
    padding: spacing.xl,
    borderRadius: radius.lg,
    backgroundColor: '#102a43',
    marginBottom: spacing.lg,
  },
  eyebrow: { color: '#cbb67a', fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1, marginBottom: spacing.xs },
  heroTitle: { color: '#f5efe2', fontSize: 28, fontWeight: '900', marginBottom: spacing.sm },
  heroBody: { color: '#d9e2ec', lineHeight: 22 },
  quickActions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  actionChip: { paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderRadius: radius.pill, backgroundColor: '#f6f3ea', borderWidth: 1, borderColor: '#dccfa8' },
  actionChipText: { color: '#173528', fontWeight: '700' },
  sectionTitle: { color: palette.ink900, fontSize: 18, fontWeight: '800', marginBottom: spacing.sm },
  listItem: { paddingVertical: spacing.sm, borderTopWidth: 1, borderTopColor: '#ece7db' },
  listTitle: { color: palette.ink900, fontWeight: '700' },
  listMeta: { color: palette.ink700, marginTop: 2 },
  cardBody: { color: palette.ink700, lineHeight: 20 },
});

import { Session } from '@supabase/supabase-js';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { useInboxThreads } from '../../hooks/useInboxThreads';
import { useProfileDashboard } from '../../hooks/useProfileDashboard';
import { invokeFunction } from '../../lib/api';
import { palette, radius, spacing } from '../../theme/design';

type RecommendedGolfer = {
  user_id: string;
  display_name: string;
  city?: string;
  compatibility_score: number;
  networking_preferences?: { networking_intent?: string };
};

type RoundSummary = {
  id: string;
  scheduledAt: string;
  course: { name: string; city: string; state: string };
  status: string;
};

type EventSummary = {
  id: string;
  title: string;
  city?: string;
  start_time: string;
  sponsor_name?: string;
};

export function GolfHomeHubScreen({
  session,
  onOpenDiscover,
  onOpenPlay,
  onOpenEvents,
  onOpenImprove,
  onOpenInbox,
}: {
  session: Session;
  onOpenDiscover: () => void;
  onOpenPlay: () => void;
  onOpenEvents: () => void;
  onOpenImprove: () => void;
  onOpenInbox: () => void;
}) {
  const { profile, feedback, refresh: refreshProfile } = useProfileDashboard(session);
  const { threads, refresh: refreshInbox } = useInboxThreads();
  const [refreshing, setRefreshing] = useState(false);
  const [recommendedGolfers, setRecommendedGolfers] = useState<RecommendedGolfer[]>([]);
  const [upcomingRound, setUpcomingRound] = useState<RoundSummary | null>(null);
  const [featuredEvent, setFeaturedEvent] = useState<EventSummary | null>(null);

  const load = useCallback(async () => {
    const [discoverResult, roundsResult, eventsResult] = await Promise.allSettled([
      invokeFunction<{ golfers: RecommendedGolfer[] }>('discovery-search', {
        method: 'POST',
        body: { limit: 3 },
      }),
      invokeFunction<{ data: RoundSummary[] }>('rounds-list', {
        method: 'POST',
        body: { limit: 1, status: ['open', 'confirmed', 'full', 'in_progress'], dateFrom: new Date().toISOString() },
      }),
      invokeFunction<EventSummary[]>('sponsors-event-list', {
        method: 'POST',
        body: {},
      }),
    ]);

    if (discoverResult.status === 'fulfilled') {
      setRecommendedGolfers(discoverResult.value.golfers ?? []);
    }
    if (roundsResult.status === 'fulfilled') {
      setUpcomingRound((roundsResult.value.data ?? [])[0] ?? null);
    }
    if (eventsResult.status === 'fulfilled') {
      setFeaturedEvent((eventsResult.value ?? [])[0] ?? null);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([load(), refreshProfile(), refreshInbox()]);
    } finally {
      setRefreshing(false);
    }
  }, [load, refreshInbox, refreshProfile]);

  const firstName = useMemo(() => {
    const rawName = profile?.display_name?.trim() || session.user.email || 'Golfer';
    return rawName.split(' ')[0];
  }, [profile?.display_name, session.user.email]);

  const nextAction = upcomingRound
    ? {
        eyebrow: 'Next up',
        title: `You have a round at ${upcomingRound.course.name}`,
        detail: `${formatRoundDate(upcomingRound.scheduledAt)} • ${upcomingRound.course.city}, ${upcomingRound.course.state}`,
        primary: 'Open round',
        onPrimary: onOpenPlay,
      }
    : {
        eyebrow: 'Recommended',
        title: 'Find a golfer who is ready to play this week',
        detail: 'Start with high-compatibility golfers and open rounds near you.',
        primary: 'Find golfers',
        onPrimary: onOpenDiscover,
      };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={styles.hero}>
        <Text style={styles.greeting}>Good golf starts with the right people.</Text>
        <Text style={styles.heroTitle}>Welcome back, {firstName}.</Text>
        <Text style={styles.heroBody}>
          Spotter is now organized around who you should meet, what you should play, and how you improve.
        </Text>
      </View>

      <Card>
        <Text style={styles.eyebrow}>{nextAction.eyebrow}</Text>
        <Text style={styles.cardTitle}>{nextAction.title}</Text>
        <Text style={styles.cardBody}>{nextAction.detail}</Text>
        <View style={styles.row}>
          <View style={styles.rowItem}>
            <Text style={styles.metricValue}>{threads.reduce((sum, thread) => sum + thread.unreadCount, 0)}</Text>
            <Text style={styles.metricLabel}>Unread messages</Text>
          </View>
          <View style={styles.rowItem}>
            <Text style={styles.metricValue}>{feedback?.positiveRatio ? `${Math.round(feedback.positiveRatio * 100)}%` : '--'}</Text>
            <Text style={styles.metricLabel}>Play-again positivity</Text>
          </View>
        </View>
        <Button title={nextAction.primary} onPress={nextAction.onPrimary} />
        <Button title="Open inbox" onPress={onOpenInbox} tone="secondary" />
      </Card>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Suggested golfers</Text>
        <TouchableOpacity onPress={onOpenDiscover}>
          <Text style={styles.linkText}>See all</Text>
        </TouchableOpacity>
      </View>
      {recommendedGolfers.length === 0 ? (
        <Card>
          <Text style={styles.cardTitle}>No recommendations yet</Text>
          <Text style={styles.cardBody}>Complete your profile and set your play preferences to unlock better golfer suggestions.</Text>
          <Button title="Explore discover" onPress={onOpenDiscover} tone="secondary" />
        </Card>
      ) : (
        recommendedGolfers.map((golfer) => (
          <Card key={golfer.user_id}>
            <Text style={styles.cardTitle}>{golfer.display_name}</Text>
            <Text style={styles.cardBody}>
              {Math.round(golfer.compatibility_score)}% match
              {golfer.city ? ` • ${golfer.city}` : ''}
              {golfer.networking_preferences?.networking_intent ? ` • ${formatIntent(golfer.networking_preferences.networking_intent)}` : ''}
            </Text>
            <Button title="View in Discover" onPress={onOpenDiscover} />
          </Card>
        ))
      )}

      <View style={styles.twoUp}>
        <Card>
          <Text style={styles.sectionTitle}>Events</Text>
          <Text style={styles.cardTitle}>{featuredEvent?.title ?? 'No featured event yet'}</Text>
          <Text style={styles.cardBody}>
            {featuredEvent
              ? `${formatEventDate(featuredEvent.start_time)} • ${featuredEvent.city ?? 'TBD'}`
              : 'Sponsor-backed clinics, tournaments, and mixers will appear here.'}
          </Text>
          <Button title="Browse events" onPress={onOpenEvents} tone="secondary" />
        </Card>

        <Card>
          <Text style={styles.sectionTitle}>Improve</Text>
          <Text style={styles.cardTitle}>Keep your momentum moving</Text>
          <Text style={styles.cardBody}>
            Book a coach, upload swing video, or review your latest progress snapshot.
          </Text>
          <Button title="Open improve" onPress={onOpenImprove} tone="secondary" />
        </Card>
      </View>
    </ScrollView>
  );
}

function formatIntent(intent: string) {
  if (intent === 'business_social') return 'Business + Social';
  return intent.charAt(0).toUpperCase() + intent.slice(1);
}

function formatRoundDate(value: string) {
  return new Date(value).toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatEventDate(value: string) {
  return new Date(value).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: palette.sky100 },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl * 2 },
  hero: {
    padding: spacing.xl,
    borderRadius: radius.lg,
    backgroundColor: '#173528',
    marginBottom: spacing.lg,
  },
  greeting: {
    color: '#d6dcc7',
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: spacing.xs,
  },
  heroTitle: { color: '#f5efe2', fontSize: 28, fontWeight: '900', marginBottom: spacing.sm },
  heroBody: { color: '#d7dfd1', fontSize: 15, lineHeight: 22 },
  eyebrow: { color: palette.amber500, fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1, marginBottom: spacing.xs },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm, marginTop: spacing.sm },
  sectionTitle: { color: palette.ink900, fontSize: 18, fontWeight: '800' },
  linkText: { color: palette.navy600, fontWeight: '700' },
  cardTitle: { color: palette.ink900, fontSize: 19, fontWeight: '800', marginBottom: spacing.xs },
  cardBody: { color: palette.ink700, fontSize: 14, lineHeight: 20 },
  row: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  rowItem: { flex: 1, backgroundColor: '#f6f3ea', borderRadius: radius.md, padding: spacing.md },
  metricValue: { color: '#173528', fontSize: 20, fontWeight: '900' },
  metricLabel: { color: palette.ink700, fontSize: 12, marginTop: 2 },
  twoUp: { gap: spacing.sm },
});

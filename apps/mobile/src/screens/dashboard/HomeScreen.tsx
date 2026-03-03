import { Session } from '@supabase/supabase-js';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, ImageBackground, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { invokeFunction } from '../../lib/api';
import { stockPhotos } from '../../lib/stockPhotos';
import { supabase } from '../../lib/supabase';

type QuickAction = {
  label: string;
  target: 'discover' | 'ask' | 'requests' | 'sessions' | 'coaches' | 'matches';
};

type FeedItem = {
  id: string;
  engagement_requests: {
    question_text: string;
    engagement_responses: Array<{ response_text: string | null; transcript: string | null }>;
  } | null;
};

type PendingItem = {
  id: string;
  question_text: string;
  status: string;
};

const QUICK_ACTIONS: QuickAction[] = [
  { label: 'Discover', target: 'discover' },
  { label: 'Ask Coach', target: 'ask' },
  { label: 'My Requests', target: 'requests' },
  { label: 'Sessions', target: 'sessions' },
  { label: 'Coaches', target: 'coaches' },
  { label: 'Matches', target: 'matches' }
];

export function HomeScreen({
  session,
  onNavigate
}: {
  session: Session;
  onNavigate: (target: QuickAction['target']) => void;
}) {
  const [refreshing, setRefreshing] = useState(false);
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [pending, setPending] = useState<PendingItem[]>([]);
  const [coachId, setCoachId] = useState<string | null>(null);
  const [actingId, setActingId] = useState<string>('');

  const load = useCallback(async () => {
    try {
      const response = await invokeFunction<FeedItem[]>('feed-home', { method: 'GET' });
      setFeed(response);

      const { data: coach } = await supabase.from('coaches').select('id').eq('user_id', session.user.id).maybeSingle();
      if (!coach?.id) {
        setCoachId(null);
        setPending([]);
        return;
      }

      setCoachId(coach.id);

      const { data } = await supabase
        .from('engagement_requests')
        .select('id, question_text, status')
        .eq('coach_id', coach.id)
        .in('status', ['awaiting_expert', 'created'])
        .order('created_at', { ascending: false })
        .limit(10);

      setPending((data ?? []) as PendingItem[]);
    } catch (error) {
      Alert.alert('Home load failed', error instanceof Error ? error.message : 'Unknown error');
    }
  }, [session.user.id]);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  };

  const runAction = async (action: 'engagements-accept' | 'engagements-decline', engagementRequestId: string) => {
    if (actingId) return;
    setActingId(engagementRequestId);
    try {
      await invokeFunction(action, { method: 'POST', body: { engagementRequestId } });
      await load();
    } finally {
      setActingId('');
    }
  };

  const hasPendingActions = useMemo(() => Boolean(coachId && pending.length > 0), [coachId, pending.length]);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <ImageBackground source={{ uri: stockPhotos.homeHero }} style={styles.hero} imageStyle={styles.heroImage}>
        <Text style={styles.heroTitle}>Home</Text>
        <Text style={styles.heroSubtitle}>Quick actions and coach queue in one place.</Text>
      </ImageBackground>

      <View style={styles.quickRow}>
        {QUICK_ACTIONS.map((action) => (
          <TouchableOpacity key={action.target} style={styles.quickAction} onPress={() => onNavigate(action.target)}>
            <Text style={styles.quickLabel}>{action.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Card>
        <Text style={styles.sectionTitle}>Home Feed</Text>
        {feed.slice(0, 5).map((item) => (
          <View key={item.id} style={styles.feedItem}>
            <Text style={styles.feedQuestion}>{item.engagement_requests?.question_text ?? 'Question unavailable'}</Text>
            <Text style={styles.feedAnswer}>
              {item.engagement_requests?.engagement_responses?.[0]?.response_text ??
                item.engagement_requests?.engagement_responses?.[0]?.transcript ??
                'Media response posted'}
            </Text>
          </View>
        ))}
        {feed.length === 0 ? <Text style={styles.empty}>No feed items yet.</Text> : null}
      </Card>

      {hasPendingActions ? (
        <Card>
          <Text style={styles.sectionTitle}>Pending Coach Requests</Text>
          {pending.map((item) => (
            <View key={item.id} style={styles.pendingCard}>
              <Text style={styles.feedQuestion}>{item.question_text}</Text>
              <Text style={styles.meta}>Status: {item.status}</Text>
              <Button
                title={actingId === item.id ? 'Working...' : 'Accept'}
                onPress={() => runAction('engagements-accept', item.id)}
                disabled={actingId === item.id}
              />
              <Button
                title="Decline"
                onPress={() => runAction('engagements-decline', item.id)}
                disabled={actingId === item.id}
                tone="secondary"
              />
            </View>
          ))}
        </Card>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f6f9fc' },
  content: { padding: 16 },
  hero: { height: 165, justifyContent: 'flex-end', padding: 12, marginBottom: 12 },
  heroImage: { borderRadius: 14 },
  heroTitle: { color: '#fff', fontSize: 28, fontWeight: '900' },
  heroSubtitle: { color: '#eaf2f8', fontWeight: '600' },
  quickRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  quickAction: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#d9e2ec',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12
  },
  quickLabel: { color: '#102a43', fontWeight: '700' },
  sectionTitle: { color: '#102a43', fontWeight: '800', fontSize: 18, marginBottom: 8 },
  feedItem: { marginBottom: 10, borderBottomWidth: 1, borderBottomColor: '#eaf2f8', paddingBottom: 8 },
  feedQuestion: { color: '#102a43', fontWeight: '700' },
  feedAnswer: { color: '#334e68', marginTop: 4 },
  pendingCard: { marginTop: 4, marginBottom: 12 },
  meta: { color: '#627d98', marginTop: 4 },
  empty: { color: '#627d98' }
});

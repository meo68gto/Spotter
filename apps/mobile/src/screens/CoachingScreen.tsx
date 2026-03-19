import { useCallback, useEffect, useState } from 'react';
import {
  FlatList,
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Session } from '@supabase/supabase-js';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { supabase } from '../lib/supabase';
import { invokeFunction } from '../lib/api';
import { palette, radius, shadows, spacing } from '../theme/design';

// Coaching is golf-only (removed pickleball, tennis)

type Coach = {
  id: string;
  userId: string;
  displayName: string;
  avatarUrl?: string;
  sport: 'golf';
  hourlyRate: number;
  rating: number;
  reviewCount: number;
  bio?: string;
  specialties: string[];
};

type CoachingSession = {
  id: string;
  coachId: string;
  coachName: string;
  coachAvatar?: string;
  scheduledTime: string;
  status: 'upcoming' | 'completed' | 'cancelled';
  mode: 'video_call' | 'in_person';
};

interface CoachingScreenProps {
  session: Session;
}

export function CoachingScreen({ session }: CoachingScreenProps) {
  const [refreshing, setRefreshing] = useState(false);
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [mySessions, setMySessions] = useState<CoachingSession[]>([]);
  // Removed sport filter - golf only
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'discover' | 'my-sessions'>('discover');
  const [loading, setLoading] = useState(false);

  const loadCoaches = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('coaches')
        .select('id, user_id, sport, hourly_rate, bio, specialties, rating, review_count, profiles!inner(display_name, avatar_url)')
        .eq('is_active', true)
        .order('rating', { ascending: false })
        .limit(20);

      if (error) throw error;

      const formattedCoaches: Coach[] = (data || []).map((coach: any) => ({
        id: coach.id,
        userId: coach.user_id,
        displayName: coach.profiles?.display_name || 'Coach',
        avatarUrl: coach.profiles?.avatar_url,
        sport: coach.sport,
        hourlyRate: coach.hourly_rate || 0,
        rating: coach.rating || 0,
        reviewCount: coach.review_count || 0,
        bio: coach.bio,
        specialties: coach.specialties || [],
      }));

      setCoaches(formattedCoaches);
    } catch (error) {
      console.error('Error loading coaches:', error);
    }
  }, []);

  const loadMySessions = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('coaching_sessions')
        .select('*, coach:coaches!inner(id, profiles!inner(display_name, avatar_url))')
        .eq('user_id', session.user.id)
        .order('scheduled_time', { ascending: true })
        .limit(10);

      if (error) throw error;

      const formattedSessions: CoachingSession[] = (data || []).map((s: any) => ({
        id: s.id,
        coachId: s.coach_id,
        coachName: s.coach?.profiles?.display_name || 'Coach',
        coachAvatar: s.coach?.profiles?.avatar_url,
        scheduledTime: s.scheduled_time,
        status: s.status,
        mode: s.mode,
      }));

      setMySessions(formattedSessions);
    } catch (error) {
      console.error('Error loading sessions:', error);
    }
  }, [session.user.id]);

  const loadData = useCallback(async () => {
    await Promise.all([loadCoaches(), loadMySessions()]);
  }, [loadCoaches, loadMySessions]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const filteredCoaches = coaches.filter((coach) => {
    const matchesSearch =
      !searchQuery ||
      coach.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      coach.bio?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      coach.specialties.some((s) => s.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesSearch;
  });

  const upcomingSessions = mySessions.filter((s) => s.status === 'upcoming');
  const pastSessions = mySessions.filter((s) => s.status !== 'upcoming');

  // NOTE: Booking flow is disabled for now. Backend exists (engagements-create)
  // but needs more testing before enabling. Re-enable when ready to implement
  // full Stripe payment + session scheduling flow.
  // const handleBookSession = async (coachId: string) => {
  //   // Navigate to booking flow
  // };

  const renderStars = (rating: number) => {
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 >= 0.5;
    return (
      <View style={styles.stars}>
        {[...Array(5)].map((_, i) => (
          <Text key={i} style={styles.star}>
            {i < fullStars ? '★' : i === fullStars && hasHalfStar ? '½' : '☆'}
          </Text>
        ))}
      </View>
    );
  };

  const renderCoachCard = ({ item }: { item: Coach }) => (
    <Card>
      <View style={styles.coachCard}>
        <View style={styles.coachHeader}>
          {item.avatarUrl ? (
            <Image source={{ uri: item.avatarUrl }} style={styles.coachAvatar} />
          ) : (
            <View style={styles.coachAvatarPlaceholder}>
              <Text style={styles.coachInitial}>{item.displayName.charAt(0).toUpperCase()}</Text>
            </View>
          )}
          <View style={styles.coachInfo}>
            <Text style={styles.coachName}>{item.displayName}</Text>
            <View style={styles.coachMeta}>
              {renderStars(item.rating)}
              <Text style={styles.reviewCount}>({item.reviewCount})</Text>
            </View>
          </View>
        </View>

        <Text style={styles.coachBio}>{item.bio || 'No bio available'}</Text>

        {item.specialties.length > 0 && (
          <View style={styles.specialties}>
            {item.specialties.slice(0, 3).map((specialty, idx) => (
              <View key={idx} style={styles.specialtyTag}>
                <Text style={styles.specialtyText}>{specialty}</Text>
              </View>
            ))}
          </View>
        )}

        <View style={styles.coachFooter}>
          <Text style={styles.price}>${item.hourlyRate}/hr</Text>
          {/* Booking disabled - see handleBookSession comment above */}
        </View>
      </View>
    </Card>
  );

  const renderSessionCard = (session: CoachingSession) => {
    const sessionDate = new Date(session.scheduledTime);
    const isPast = sessionDate < new Date();

    return (
      <Card key={session.id}>
        <View style={styles.sessionCard}>
          <View style={styles.sessionHeader}>
            {session.coachAvatar ? (
              <Image source={{ uri: session.coachAvatar }} style={styles.sessionAvatar} />
            ) : (
              <View style={styles.sessionAvatarPlaceholder}>
                <Text style={styles.sessionInitial}>{session.coachName.charAt(0).toUpperCase()}</Text>
              </View>
            )}
            <View style={styles.sessionInfo}>
              <Text style={styles.sessionCoachName}>{session.coachName}</Text>
              <Text style={styles.sessionDate}>
                {sessionDate.toLocaleDateString('en-US', {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit',
                })}
              </Text>
              <View style={styles.sessionMeta}>
                <Text style={styles.sessionMode}>
                  {session.mode === 'video_call' ? '📹 Video Call' : '🤝 In Person'}
                </Text>
                <View
                  style={[
                    styles.statusBadge,
                    {
                      backgroundColor:
                        session.status === 'upcoming'
                          ? '#DBEAFE'
                          : session.status === 'completed'
                          ? '#D1FAE5'
                          : '#FEE2E2',
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.statusText,
                      {
                        color:
                          session.status === 'upcoming'
                            ? '#1E40AF'
                            : session.status === 'completed'
                            ? '#065F46'
                            : '#991B1B',
                      },
                    ]}
                  >
                    {session.status.charAt(0).toUpperCase() + session.status.slice(1)}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* Session actions disabled - join/reschedule flows not yet implemented
              Backend supports status updates but full video call + rescheduling UI
              needs to be built. Re-enable when flows are complete.
          {session.status === 'upcoming' && !isPast && (
            <View style={styles.sessionActions}>
              <Button
                title="Join Session"
                onPress={() => {}}
                tone="secondary"
              />
              <Button
                title="Reschedule"
                onPress={() => {}}
                tone="ghost"
              />
            </View>
          )}
          */}
        </View>
      </Card>
    );
  };

  return (
    <View style={styles.container}>
      {/* Tab Switcher */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'discover' && styles.activeTab]}
          onPress={() => setActiveTab('discover')}
        >
          <Text style={[styles.tabText, activeTab === 'discover' && styles.activeTabText]}>
            Discover
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'my-sessions' && styles.activeTab]}
          onPress={() => setActiveTab('my-sessions')}
        >
          <Text style={[styles.tabText, activeTab === 'my-sessions' && styles.activeTabText]}>
            My Sessions
          </Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'discover' ? (
        <FlatList
          data={filteredCoaches}
          renderItem={renderCoachCard}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListHeaderComponent={
            <View>
              <Text style={styles.title}>Find a Golf Coach</Text>
              <Text style={styles.subtitle}>Book golf lessons with expert coaches</Text>

              {/* Search */}
              <TextInput
                style={styles.searchInput}
                placeholder="Search golf coaches, specialties..."
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
            </View>
          }
          ListEmptyComponent={
            <Card>
              <View style={styles.emptyState}>
                <Text style={styles.emptyEmoji}>🎯</Text>
                <Text style={styles.emptyTitle}>No coaches found</Text>
                <Text style={styles.emptyText}>Try adjusting your filters</Text>
              </View>
            </Card>
          }
        />
      ) : (
        <ScrollView
          style={styles.container}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          <Text style={styles.title}>My Coaching Sessions</Text>

          {upcomingSessions.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Upcoming</Text>
              {upcomingSessions.map(renderSessionCard)}
            </View>
          )}

          {pastSessions.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Past Sessions</Text>
              {pastSessions.map(renderSessionCard)}
            </View>
          )}

          {mySessions.length === 0 && (
            <Card>
              <View style={styles.emptyState}>
                <Text style={styles.emptyEmoji}>📅</Text>
                <Text style={styles.emptyTitle}>No sessions yet</Text>
                <Text style={styles.emptyText}>
                  Book your first coaching session to get started
                </Text>
                <Button
                  title="Find a Golf Coach"
                  onPress={() => setActiveTab('discover')}
                />
              </View>
            </Card>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.sky100,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: palette.white,
    borderBottomWidth: 1,
    borderBottomColor: palette.sky200,
  },
  tab: {
    flex: 1,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: palette.navy600,
  },
  tabText: {
    fontSize: 15,
    fontWeight: '600',
    color: palette.ink500,
  },
  activeTabText: {
    color: palette.navy600,
  },
  listContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl * 2,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: palette.ink900,
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: 14,
    color: palette.ink500,
    marginBottom: spacing.lg,
  },
  searchInput: {
    backgroundColor: palette.white,
    borderRadius: radius.md,
    padding: spacing.md,
    fontSize: 15,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: palette.sky200,
  },
  filters: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.lg,
    flexWrap: 'wrap',
  },
  filterChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: palette.white,
    borderWidth: 1,
    borderColor: palette.sky200,
  },
  filterChipActive: {
    backgroundColor: palette.navy600,
    borderColor: palette.navy600,
  },
  filterChipText: {
    fontSize: 14,
    fontWeight: '600',
    color: palette.ink700,
  },
  filterChipTextActive: {
    color: palette.white,
  },
  coachCard: {
    gap: spacing.md,
  },
  coachHeader: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  coachAvatar: {
    width: 64,
    height: 64,
    borderRadius: radius.pill,
  },
  coachAvatarPlaceholder: {
    width: 64,
    height: 64,
    borderRadius: radius.pill,
    backgroundColor: palette.navy600,
    alignItems: 'center',
    justifyContent: 'center',
  },
  coachInitial: {
    color: palette.white,
    fontSize: 28,
    fontWeight: '800',
  },
  coachInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  coachName: {
    fontSize: 18,
    fontWeight: '800',
    color: palette.ink900,
    marginBottom: spacing.xs,
  },
  coachMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  sportBadge: {
    fontSize: 12,
    fontWeight: '700',
    color: palette.navy600,
    backgroundColor: palette.sky100,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs / 2,
    borderRadius: radius.sm,
  },
  stars: {
    flexDirection: 'row',
    gap: 2,
  },
  star: {
    fontSize: 14,
    color: '#F59E0B',
  },
  reviewCount: {
    fontSize: 13,
    color: palette.ink500,
  },
  coachBio: {
    fontSize: 14,
    color: palette.ink700,
    lineHeight: 20,
  },
  specialties: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  specialtyTag: {
    backgroundColor: palette.sky100,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs / 2,
    borderRadius: radius.sm,
  },
  specialtyText: {
    fontSize: 12,
    color: palette.ink700,
  },
  coachFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: palette.sky200,
  },
  price: {
    fontSize: 20,
    fontWeight: '800',
    color: palette.ink900,
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: palette.ink900,
    marginBottom: spacing.md,
  },
  sessionCard: {
    gap: spacing.md,
  },
  sessionHeader: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  sessionAvatar: {
    width: 56,
    height: 56,
    borderRadius: radius.pill,
  },
  sessionAvatarPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: radius.pill,
    backgroundColor: palette.navy600,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sessionInitial: {
    color: palette.white,
    fontSize: 24,
    fontWeight: '800',
  },
  sessionInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  sessionCoachName: {
    fontSize: 16,
    fontWeight: '800',
    color: palette.ink900,
    marginBottom: spacing.xs,
  },
  sessionDate: {
    fontSize: 14,
    color: palette.ink700,
    marginBottom: spacing.xs,
  },
  sessionMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  sessionMode: {
    fontSize: 13,
    color: palette.ink500,
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs / 2,
    borderRadius: radius.sm,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
  },
  sessionActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: palette.sky200,
  },
  emptyState: {
    alignItems: 'center',
    padding: spacing.lg,
  },
  emptyEmoji: {
    fontSize: 40,
    marginBottom: spacing.sm,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: palette.ink900,
    marginBottom: spacing.xs,
  },
  emptyText: {
    fontSize: 14,
    color: palette.ink500,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
});

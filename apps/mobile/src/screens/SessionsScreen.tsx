import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Session } from '@supabase/supabase-js';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { GolfRound } from '../components/RoundCard';
import { supabase } from '../lib/supabase';
import { invokeFunction } from '../lib/api';
import { palette, radius, shadows, spacing } from '../theme/design';

type SessionTab = 'coaching' | 'golf';

type CoachingSession = {
  id: string;
  coachId: string;
  coachName: string;
  coachAvatar?: string;
  scheduledTime: string;
  status: 'upcoming' | 'completed' | 'cancelled';
  mode: 'video_call' | 'in_person';
};

interface SessionsScreenProps {
  session: Session;
}

export function SessionsScreen({ session }: SessionsScreenProps) {
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<SessionTab>('golf');
  const [golfRounds, setGolfRounds] = useState<GolfRound[]>([]);
  const [coachingSessions, setCoachingSessions] = useState<CoachingSession[]>([]);

  const loadGolfRounds = useCallback(async () => {
    try {
      // Use the rounds-list edge function
      const response = await invokeFunction<{ rounds: any[] }>('rounds-list', {
        method: 'GET',
      });

      const formattedRounds: GolfRound[] = (response.rounds || []).map((r: any) => ({
        id: r.id,
        organizerId: r.organizer_id,
        courseId: r.course_id,
        course: r.course ? { id: r.course.id, name: r.course.name } : undefined,
        teeTime: r.tee_time,
        maxPlayers: r.max_players || 4,
        playerIds: r.player_ids || [],
        status: r.status,
        format: r.format,
        wagerAmount: r.wager_amount,
      }));

      setGolfRounds(formattedRounds);
    } catch (error) {
      // Fallback to direct query
      try {
        const { data, error: dbError } = await supabase
          .from('golf_rounds')
          .select('*, course:courses(*)')
          .or(`organizer_id.eq.${session.user.id},player_ids.cs.{${session.user.id}}`)
          .order('tee_time', { ascending: true });

        if (dbError) throw dbError;

        const formattedRounds: GolfRound[] = (data || []).map((r: any) => ({
          id: r.id,
          organizerId: r.organizer_id,
          courseId: r.course_id,
          course: r.course ? { id: r.course.id, name: r.course.name } : undefined,
          teeTime: r.tee_time,
          maxPlayers: r.max_players || 4,
          playerIds: r.player_ids || [],
          status: r.status,
          format: r.format,
          wagerAmount: r.wager_amount,
        }));

        setGolfRounds(formattedRounds);
      } catch (fallbackError) {
        console.error('Error loading golf rounds:', fallbackError);
      }
    }
  }, [session.user.id]);

  const loadCoachingSessions = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('coaching_sessions')
        .select('*, coach:coaches!inner(id, profiles!inner(display_name, avatar_url))')
        .eq('user_id', session.user.id)
        .order('scheduled_time', { ascending: true })
        .limit(20);

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

      setCoachingSessions(formattedSessions);
    } catch (error) {
      console.error('Error loading coaching sessions:', error);
    }
  }, [session.user.id]);

  const loadData = useCallback(async () => {
    await Promise.all([loadGolfRounds(), loadCoachingSessions()]);
  }, [loadGolfRounds, loadCoachingSessions]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleCreateRound = () => {
    Alert.alert('Create Round', 'Round creation flow would open here');
  };

  const handleJoinRound = (roundId: string) => {
    Alert.alert('Join Round', `Would join round ${roundId}`);
  };

  const handleLeaveRound = async (roundId: string) => {
    try {
      const { error } = await supabase
        .from('golf_rounds')
        .update({
          player_ids: supabase.rpc('array_remove', {
            arr: 'player_ids',
            elem: session.user.id,
          }),
        })
        .eq('id', roundId);

      if (error) throw error;
      await loadGolfRounds();
      Alert.alert('Success', 'You have left the round');
    } catch (error) {
      Alert.alert('Error', 'Failed to leave round');
    }
  };

  const upcomingRounds = golfRounds.filter(
    (r) => new Date(r.teeTime) > new Date() && r.status !== 'cancelled'
  );
  const pastRounds = golfRounds.filter(
    (r) => new Date(r.teeTime) <= new Date() || r.status === 'completed'
  );

  const upcomingCoaching = coachingSessions.filter((s) => s.status === 'upcoming');
  const pastCoaching = coachingSessions.filter((s) => s.status !== 'upcoming');

  const renderCoachingSession = (item: CoachingSession) => {
    const sessionDate = new Date(item.scheduledTime);
    const isPast = sessionDate < new Date();

    return (
      <Card key={item.id}>
        <View style={styles.coachingCard}>
          <View style={styles.coachingHeader}>
            {item.coachAvatar ? (
              <Image source={{ uri: item.coachAvatar }} style={styles.coachAvatar} />
            ) : (
              <View style={styles.coachAvatarPlaceholder}>
                <Text style={styles.coachInitial}>{item.coachName.charAt(0).toUpperCase()}</Text>
              </View>
            )}
            <View style={styles.coachingInfo}>
              <Text style={styles.coachName}>{item.coachName}</Text>
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
                  {item.mode === 'video_call' ? '📹 Video Call' : '🤝 In Person'}
                </Text>
                <View
                  style={[
                    styles.statusBadge,
                    {
                      backgroundColor:
                        item.status === 'upcoming'
                          ? '#DBEAFE'
                          : item.status === 'completed'
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
                          item.status === 'upcoming'
                            ? '#1E40AF'
                            : item.status === 'completed'
                            ? '#065F46'
                            : '#991B1B',
                      },
                    ]}
                  >
                    {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {item.status === 'upcoming' && !isPast && (
            <View style={styles.coachingActions}>
              <Button title="Join Session" onPress={() => {}} tone="secondary" />
              <Button title="Reschedule" onPress={() => {}} tone="ghost" />
            </View>
          )}
        </View>
      </Card>
    );
  };

  const renderGolfRound = ({ item }: { item: GolfRound }) => {
    const isOrganizer = item.organizerId === session.user.id;
    const isParticipant = item.playerIds?.includes(session.user.id);
    const participantCount = item.playerIds?.length || 1;
    const isFull = participantCount >= (item.maxPlayers || 4);

    return (
      <Card key={item.id}>
        <View style={styles.roundCard}>
          <View style={styles.roundHeader}>
            <View style={styles.roundInfo}>
              <Text style={styles.courseName}>{item.course?.name || 'Unknown Course'}</Text>
              <Text style={styles.roundDate}>
                {new Date(item.teeTime).toLocaleDateString('en-US', {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit',
                })}
              </Text>
            </View>
            <View
              style={[
                styles.roundStatusBadge,
                {
                  backgroundColor:
                    item.status === 'open'
                      ? '#DBEAFE'
                      : item.status === 'full'
                      ? '#FEF3C7'
                      : item.status === 'confirmed'
                      ? '#D1FAE5'
                      : item.status === 'in_progress'
                      ? '#E0E7FF'
                      : item.status === 'completed'
                      ? '#F3F4F6'
                      : '#FEE2E2',
                },
              ]}
            >
              <Text
                style={[
                  styles.roundStatusText,
                  {
                    color:
                      item.status === 'open'
                        ? '#1E40AF'
                        : item.status === 'full'
                        ? '#92400E'
                        : item.status === 'confirmed'
                        ? '#065F46'
                        : item.status === 'in_progress'
                        ? '#3730A3'
                        : item.status === 'completed'
                        ? '#6B7280'
                        : '#991B1B',
                  },
                ]}
              >
                {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
              </Text>
            </View>
          </View>

          <View style={styles.roundDetails}>
            <Text style={styles.detailText}>
              👥 {participantCount}/{item.maxPlayers || 4} players
            </Text>
            {item.format && (
              <Text style={styles.detailText}>🏆 {item.format}</Text>
            )}
            {item.wagerAmount && item.wagerAmount > 0 && (
              <Text style={styles.detailText}>💰 ${item.wagerAmount}</Text>
            )}
          </View>

          <View style={styles.roundActions}>
            {isOrganizer ? (
              <Button title="Manage Round" onPress={() => {}} tone="secondary" />
            ) : isParticipant ? (
              <>
                <Button title="View Details" onPress={() => {}} tone="secondary" />
                <Button
                  title="Leave Round"
                  onPress={() => handleLeaveRound(item.id)}
                  tone="ghost"
                />
              </>
            ) : item.status === 'open' && !isFull ? (
              <Button
                title="Join Round"
                onPress={() => handleJoinRound(item.id)}
                tone="secondary"
              />
            ) : (
              <Text style={styles.fullText}>Round is full</Text>
            )}
          </View>
        </View>
      </Card>
    );
  };

  const renderCoachingTab = () => (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {upcomingCoaching.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Upcoming Sessions</Text>
          {upcomingCoaching.map(renderCoachingSession)}
        </View>
      )}

      {pastCoaching.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Past Sessions</Text>
          {pastCoaching.map(renderCoachingSession)}
        </View>
      )}

      {coachingSessions.length === 0 && (
        <Card>
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>📅</Text>
            <Text style={styles.emptyTitle}>No coaching sessions</Text>
            <Text style={styles.emptyText}>
              Book a coaching session to improve your game
            </Text>
            <Button title="Find a Golf Coach" onPress={() => {}} />
          </View>
        </Card>
      )}
    </ScrollView>
  );

  const renderGolfTab = () => (
    <FlatList
      data={upcomingRounds}
      renderItem={renderGolfRound}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.listContent}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      ListHeaderComponent={
        <View>
          <View style={styles.headerActions}>
            <Button title="+ Create Round" onPress={handleCreateRound} />
          </View>

          {pastRounds.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Past Rounds</Text>
              {pastRounds.slice(0, 3).map((round) => renderGolfRound({ item: round }))}
            </View>
          )}

          {upcomingRounds.length > 0 && (
            <Text style={styles.sectionTitle}>Upcoming Rounds</Text>
          )}
        </View>
      }
      ListEmptyComponent={
        <Card>
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>⛳</Text>
            <Text style={styles.emptyTitle}>No upcoming rounds</Text>
            <Text style={styles.emptyText}>
              Create a round or join one to get started
            </Text>
            <Button title="Create Round" onPress={handleCreateRound} />
          </View>
        </Card>
      }
    />
  );

  return (
    <View style={styles.container}>
      {/* Tab Bar */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'coaching' && styles.activeTab]}
          onPress={() => setActiveTab('coaching')}
        >
          <Text style={[styles.tabText, activeTab === 'coaching' && styles.activeTabText]}>
            Coaching Sessions
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'golf' && styles.activeTab]}
          onPress={() => setActiveTab('golf')}
        >
          <Text style={[styles.tabText, activeTab === 'golf' && styles.activeTabText]}>
            Golf Rounds
          </Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'coaching' ? renderCoachingTab() : renderGolfTab()}
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
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl * 2,
  },
  listContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl * 2,
  },
  headerActions: {
    marginBottom: spacing.lg,
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
  coachingCard: {
    gap: spacing.md,
  },
  coachingHeader: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  coachAvatar: {
    width: 56,
    height: 56,
    borderRadius: radius.pill,
  },
  coachAvatarPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: radius.pill,
    backgroundColor: palette.navy600,
    alignItems: 'center',
    justifyContent: 'center',
  },
  coachInitial: {
    color: palette.white,
    fontSize: 24,
    fontWeight: '800',
  },
  coachingInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  coachName: {
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
  coachingActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: palette.sky200,
  },
  roundCard: {
    gap: spacing.md,
  },
  roundHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  roundInfo: {
    flex: 1,
  },
  courseName: {
    fontSize: 16,
    fontWeight: '800',
    color: palette.ink900,
    marginBottom: spacing.xs,
  },
  roundDate: {
    fontSize: 14,
    color: palette.ink700,
  },
  roundStatusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs / 2,
    borderRadius: radius.sm,
  },
  roundStatusText: {
    fontSize: 12,
    fontWeight: '700',
  },
  roundDetails: {
    flexDirection: 'row',
    gap: spacing.md,
    flexWrap: 'wrap',
  },
  detailText: {
    fontSize: 13,
    color: palette.ink700,
  },
  roundActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: palette.sky200,
  },
  fullText: {
    fontSize: 14,
    color: palette.ink500,
    fontStyle: 'italic',
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

// GAP 2: Profile Round History Component
// Shows rounds played, would-play-again rate, recent rounds, and standing foursomes

import { useEffect, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { supabase } from '../lib/supabase';
import { palette, radius, spacing, shadows } from '../theme/design';

interface StandingFoursome {
  foursome_id: string;
  standing_foursomes: {
    name: string;
    status: string;
    cadence: string | null;
  };
}

interface RecentRound {
  id: string;
  courseName: string;
  scheduledAt: string;
  players: string[];
}

interface RoundHistorySectionProps {
  profileId: string;
  isOwnProfile: boolean;
}

export function RoundHistorySection({ profileId, isOwnProfile }: RoundHistorySectionProps) {
  const [roundCount, setRoundCount] = useState<number>(0);
  const [wouldPlayAgainPct, setWouldPlayAgainPct] = useState<number | null>(null);
  const [recentRounds, setRecentRounds] = useState<RecentRound[]>([]);
  const [standingFoursomes, setStandingFoursomes] = useState<StandingFoursome[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRoundHistory();
  }, [profileId]);

  const fetchRoundHistory = async () => {
    try {
      setLoading(true);

      // Fetch round count from round_participants_v2
      const { count: countResult } = await supabase
        .from('round_participants_v2')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', profileId);
      setRoundCount(countResult || 0);

      // Fetch would-play-again rate from round_ratings
      const { data: ratings } = await supabase
        .from('round_ratings')
        .select('would_play_again')
        .eq('rater_id', profileId);
      
      if (ratings && ratings.length > 0) {
        const trueCount = ratings.filter((r) => r.would_play_again === true).length;
        setWouldPlayAgainPct(Math.round((trueCount / ratings.length) * 100));
      } else {
        setWouldPlayAgainPct(null);
      }

      // Fetch recent rounds (last 5) where user was a participant
      const { data: participantRounds } = await supabase
        .from('round_participants_v2')
        .select('round_id')
        .eq('user_id', profileId)
        .order('joined_at', { ascending: false })
        .limit(5);

      if (participantRounds && participantRounds.length > 0) {
        const roundIds = participantRounds.map((p) => p.round_id);
        
        const { data: roundsData } = await supabase
          .from('rounds')
          .select('id, course_id, scheduled_at, course:course_id(name)')
          .in('id', roundIds)
          .order('scheduled_at', { ascending: false })
          .limit(5);

        // Fetch participant names for each round
        const roundsWithPlayers: RecentRound[] = [];
        for (const round of (roundsData || [])) {
          const { data: participants } = await supabase
            .from('round_participants_v2')
            .select('user:user_id(display_name)')
            .eq('round_id', round.id)
            .limit(4);

          const playerNames = (participants || [])
            .map((p: any) => p.user?.display_name || 'Unknown')
            .filter((name: string) => name !== 'Unknown');

          roundsWithPlayers.push({
            id: round.id,
            courseName: (round.course as any)?.name || 'Unknown Course',
            scheduledAt: round.scheduled_at,
            players: playerNames.slice(0, 4),
          });
        }

        setRecentRounds(roundsWithPlayers);
      }

      // Fetch standing foursomes the user belongs to
      const { data: foursomes } = await supabase
        .from('standing_foursome_members')
        .select('foursome_id, standing_foursomes(name, status, cadence)')
        .eq('user_id', profileId);

      setStandingFoursomes((foursomes as any) || []);

    } catch (error) {
      console.error('Error fetching round history:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading round history...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Stats Row */}
      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{roundCount}</Text>
          <Text style={styles.statLabel}>Rounds Played</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.stat}>
          <Text style={styles.statValue}>
            {wouldPlayAgainPct !== null ? `${wouldPlayAgainPct}%` : 'N/A'}
          </Text>
          <Text style={styles.statLabel}>Would Play Again</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.stat}>
          <Text style={styles.statValue}>{standingFoursomes.length}</Text>
          <Text style={styles.statLabel}>Foursomes</Text>
        </View>
      </View>

      {/* Standing Foursomes Section */}
      {standingFoursomes.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Standing Foursomes</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {standingFoursomes.map((foursome) => (
              <TouchableOpacity key={foursome.foursome_id} style={styles.foursomeCard}>
                <Text style={styles.foursomeName}>
                  {foursome.standing_foursomes?.name || 'My Foursome'}
                </Text>
                <View style={styles.foursomeStatus}>
                  <View style={[
                    styles.statusDot,
                    { backgroundColor: foursome.standing_foursomes?.status === 'active' ? '#10B981' : '#9CA3AF' }
                  ]} />
                  <Text style={styles.statusText}>
                    {foursome.standing_foursomes?.status || 'active'}
                  </Text>
                </View>
                {foursome.standing_foursomes?.cadence && (
                  <Text style={styles.cadenceText}>
                    {foursome.standing_foursomes.cadence}
                  </Text>
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Recent Rounds Section */}
      {recentRounds.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Rounds</Text>
          {recentRounds.map((round) => (
            <View key={round.id} style={styles.roundItem}>
              <View style={styles.roundHeader}>
                <Text style={styles.roundDate}>{formatDate(round.scheduledAt)}</Text>
                <Text style={styles.roundCourse}>{round.courseName}</Text>
              </View>
              <Text style={styles.roundPlayers}>
                With: {round.players.join(', ')}
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* Empty state */}
      {roundCount === 0 && recentRounds.length === 0 && (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>⛳</Text>
          <Text style={styles.emptyTitle}>No rounds yet</Text>
          <Text style={styles.emptyText}>
            {isOwnProfile 
              ? "You haven't played any rounds yet. Create or join a round to get started!"
              : "This golfer hasn't played any rounds yet."}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.md,
  },
  loadingContainer: {
    padding: spacing.lg,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 14,
    color: palette.ink500,
  },
  statsRow: {
    flexDirection: 'row',
    backgroundColor: palette.white,
    borderRadius: radius.md,
    padding: spacing.md,
    ...shadows.card,
  },
  stat: {
    flex: 1,
    alignItems: 'center',
  },
  statDivider: {
    width: 1,
    backgroundColor: palette.sky200,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '800',
    color: palette.ink900,
  },
  statLabel: {
    fontSize: 11,
    color: palette.ink500,
    marginTop: 2,
    textAlign: 'center',
  },
  section: {
    gap: spacing.sm,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: palette.ink700,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  foursomeCard: {
    backgroundColor: palette.white,
    borderRadius: radius.md,
    padding: spacing.md,
    marginRight: spacing.sm,
    minWidth: 140,
    ...shadows.card,
  },
  foursomeName: {
    fontSize: 14,
    fontWeight: '700',
    color: palette.ink900,
    marginBottom: spacing.xs,
  },
  foursomeStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 12,
    color: palette.ink700,
    textTransform: 'capitalize',
  },
  cadenceText: {
    fontSize: 11,
    color: palette.ink500,
    marginTop: 2,
  },
  roundItem: {
    backgroundColor: palette.white,
    borderRadius: radius.md,
    padding: spacing.md,
    ...shadows.card,
  },
  roundHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  roundDate: {
    fontSize: 13,
    fontWeight: '600',
    color: palette.ink700,
  },
  roundCourse: {
    fontSize: 14,
    fontWeight: '700',
    color: palette.ink900,
  },
  roundPlayers: {
    fontSize: 12,
    color: palette.ink500,
  },
  emptyState: {
    alignItems: 'center',
    padding: spacing.xl,
    backgroundColor: palette.white,
    borderRadius: radius.md,
    ...shadows.card,
  },
  emptyIcon: {
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
    fontSize: 13,
    color: palette.ink500,
    textAlign: 'center',
  },
});

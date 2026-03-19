import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
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
import { RoundCard, GolfRound } from '../components/RoundCard';
import { TierBadge, TierSlug } from '../components/TierBadge';
import { supabase } from '../lib/supabase';
import { palette, radius, shadows, spacing } from '../theme/design';

type DeepLinkTarget = 'home' | 'coaching' | 'ask' | 'requests' | 'sessions' | 'profile';

interface HomeScreenProps {
  session: Session;
  onNavigate: (target: DeepLinkTarget) => void;
}

interface UserWithTier {
  id: string;
  email: string;
  displayName: string;
  avatarUrl?: string;
  tier: {
    slug: TierSlug;
    name: string;
    status: string;
    features: Record<string, boolean>;
    isPaid: boolean;
    expiresAt: string | null;
    autoRenew: boolean;
  };
}

interface ConnectionSuggestion {
  id: string;
  displayName: string;
  avatarUrl?: string;
  company?: string;
  role?: string;
  mutualConnections: number;
}

export function HomeScreen({ session, onNavigate }: HomeScreenProps) {
  const [refreshing, setRefreshing] = useState(false);
  const [userWithTier, setUserWithTier] = useState<UserWithTier | null>(null);
  const [upcomingRounds, setUpcomingRounds] = useState<GolfRound[]>([]);
  const [recentConnections, setRecentConnections] = useState<any[]>([]);
  const [suggestedMembers, setSuggestedMembers] = useState<ConnectionSuggestion[]>([]);

  const loadUserData = useCallback(async () => {
    try {
      // Load user with tier info
      const { data: userData, error: userError } = await supabase
        .from('profiles')
        .select('id, display_name, email, avatar_url, tier_slug')
        .eq('id', session.user.id)
        .single();

      if (userError) throw userError;

      // Get tier details
      const { data: tierData } = await supabase
        .from('membership_tiers')
        .select('*')
        .eq('slug', userData?.tier_slug || 'free')
        .single();

      setUserWithTier({
        id: userData.id,
        email: userData.email,
        displayName: userData.display_name || 'Golfer',
        avatarUrl: userData.avatar_url,
        tier: {
          slug: (userData.tier_slug || 'free') as TierSlug,
          name: tierData?.name || 'Free',
          status: 'active',
          features: tierData?.features || {},
          isPaid: userData.tier_slug !== 'free',
          expiresAt: null,
          autoRenew: false,
        },
      });

      // Load upcoming rounds (next 3)
      const { data: roundsData } = await supabase
        .from('golf_rounds')
        .select('*, course:courses(*)')
        .or(`organizer_id.eq.${session.user.id},player_ids.cs.{${session.user.id}}`)
        .gte('tee_time', new Date().toISOString())
        .order('tee_time', { ascending: true })
        .limit(3);

      const formattedRounds: GolfRound[] = (roundsData || []).map((r: any) => ({
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

      setUpcomingRounds(formattedRounds);

      // Load recent connections
      const { data: connectionsData } = await supabase
        .from('connections')
        .select('*, connected_user:profiles!connections_connected_user_id_fkey(display_name, avatar_url, company, role)')
        .eq('user_id', session.user.id)
        .eq('status', 'accepted')
        .order('created_at', { ascending: false })
        .limit(5);

      setRecentConnections(connectionsData || []);

      // Load suggested members in same tier
      const { data: suggestionsData } = await supabase
        .from('profiles')
        .select('id, display_name, avatar_url, company, role')
        .eq('tier_slug', userData?.tier_slug || 'free')
        .neq('id', session.user.id)
        .limit(5);

      // Calculate actual mutual connections for each suggestion
      const suggestionsWithMutuals: ConnectionSuggestion[] = await Promise.all(
        (suggestionsData || []).map(async (s: any) => {
          // Get current user's connections
          const { data: myConnections } = await supabase
            .from('connections')
            .select('connected_user_id')
            .eq('user_id', session.user.id)
            .eq('status', 'accepted');

          const myConnectionIds = myConnections?.map(c => c.connected_user_id) || [];

          // Get suggestion's connections
          const { data: theirConnections } = await supabase
            .from('connections')
            .select('connected_user_id')
            .eq('user_id', s.id)
            .eq('status', 'accepted');

          const theirConnectionIds = theirConnections?.map(c => c.connected_user_id) || [];

          // Calculate intersection
          const mutualCount = myConnectionIds.filter(id => theirConnectionIds.includes(id)).length;

          return {
            id: s.id,
            displayName: s.display_name,
            avatarUrl: s.avatar_url,
            company: s.company,
            role: s.role,
            mutualConnections: mutualCount,
          };
        })
      );

      setSuggestedMembers(suggestionsWithMutuals);
    } catch (error) {
      console.error('Error loading home data:', error);
    }
  }, [session.user.id]);

  useEffect(() => {
    loadUserData();
  }, [loadUserData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadUserData();
    setRefreshing(false);
  };

  const handleCreateRound = () => {
    onNavigate('sessions');
  };

  const handleFindMembers = () => {
    onNavigate('requests');
  };

  const handleConnect = async (memberId: string) => {
    try {
      const { error } = await supabase
        .from('connections')
        .insert({
          user_id: session.user.id,
          connected_user_id: memberId,
          status: 'pending',
        });

      if (error) throw error;

      Alert.alert('Success', 'Connection request sent!');
    } catch (err) {
      console.error('Error sending connection request:', err);
      Alert.alert('Error', 'Failed to send connection request');
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {/* Welcome Header */}
      <View style={styles.header}>
        <View style={styles.welcomeSection}>
          <View style={styles.avatarContainer}>
            {userWithTier?.avatarUrl ? (
              <Image source={{ uri: userWithTier.avatarUrl }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarInitial}>
                  {userWithTier?.displayName?.charAt(0).toUpperCase() || 'G'}
                </Text>
              </View>
            )}
          </View>
          <View style={styles.welcomeText}>
            <Text style={styles.greeting}>
              Welcome back, {userWithTier?.displayName?.split(' ')[0] || 'Golfer'}!
            </Text>
            <TierBadge tier={userWithTier?.tier?.slug || 'free'} size="sm" />
          </View>
        </View>
      </View>

      {/* Quick Actions */}
      <View style={styles.quickActions}>
        <TouchableOpacity style={styles.quickAction} onPress={handleCreateRound}>
          <View style={styles.quickActionIcon}>
            <Text style={styles.quickActionEmoji}>⛳</Text>
          </View>
          <Text style={styles.quickActionLabel}>Create Round</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.quickAction} onPress={handleFindMembers}>
          <View style={styles.quickActionIcon}>
            <Text style={styles.quickActionEmoji}>👥</Text>
          </View>
          <Text style={styles.quickActionLabel}>Find Members</Text>
        </TouchableOpacity>
      </View>

      {/* Upcoming Rounds */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Upcoming Rounds</Text>
          <TouchableOpacity onPress={() => onNavigate('sessions')}>
            <Text style={styles.seeAll}>See All →</Text>
          </TouchableOpacity>
        </View>
        {upcomingRounds.length > 0 ? (
          upcomingRounds.map((round) => (
            <RoundCard key={round.id} round={round} />
          ))
        ) : (
          <Card>
            <View style={styles.emptyState}>
              <Text style={styles.emptyEmoji}>🏌️</Text>
              <Text style={styles.emptyTitle}>No upcoming rounds</Text>
              <Text style={styles.emptyText}>
                Create a round or join one to get started
              </Text>
              <Button title="Create Round" onPress={handleCreateRound} />
            </View>
          </Card>
        )}
      </View>

      {/* Recent Connections */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Recent Connections</Text>
        {recentConnections.length > 0 ? (
          <Card>
            {recentConnections.slice(0, 3).map((connection: any, index: number) => (
              <View key={connection.id} style={styles.connectionRow}>
                {connection.connected_user?.avatar_url ? (
                  <Image
                    source={{ uri: connection.connected_user.avatar_url }}
                    style={styles.connectionAvatar}
                  />
                ) : (
                  <View style={styles.connectionAvatarPlaceholder}>
                    <Text style={styles.connectionInitial}>
                      {connection.connected_user?.display_name?.charAt(0).toUpperCase() || '?'}
                    </Text>
                  </View>
                )}
                <View style={styles.connectionInfo}>
                  <Text style={styles.connectionName}>
                    {connection.connected_user?.display_name || 'Unknown'}
                  </Text>
                  <Text style={styles.connectionMeta}>
                    {connection.connected_user?.company || 'No company listed'}
                  </Text>
                </View>
              </View>
            ))}
          </Card>
        ) : (
          <Card>
            <View style={styles.emptyState}>
              <Text style={styles.emptyEmoji}>🤝</Text>
              <Text style={styles.emptyTitle}>No connections yet</Text>
              <Text style={styles.emptyText}>
                Connect with other golfers in your tier
              </Text>
            </View>
          </Card>
        )}
      </View>

      {/* Discover Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Discover</Text>
        <Text style={styles.sectionSubtitle}>
          Members in your tier ({userWithTier?.tier?.name || 'Free'})
        </Text>
        {suggestedMembers.length > 0 ? (
          suggestedMembers.map((member) => (
            <Card key={member.id}>
              <View style={styles.suggestionRow}>
                {member.avatarUrl ? (
                  <Image source={{ uri: member.avatarUrl }} style={styles.suggestionAvatar} />
                ) : (
                  <View style={styles.suggestionAvatarPlaceholder}>
                    <Text style={styles.suggestionInitial}>
                      {member.displayName?.charAt(0).toUpperCase() || '?'}
                    </Text>
                  </View>
                )}
                <View style={styles.suggestionInfo}>
                  <Text style={styles.suggestionName}>{member.displayName}</Text>
                  <Text style={styles.suggestionMeta}>
                    {member.role}{member.role && member.company ? ' at ' : ''}
                    {member.company}
                  </Text>
                  <Text style={styles.mutualText}>
                    {member.mutualConnections} mutual connection
                    {member.mutualConnections !== 1 ? 's' : ''}
                  </Text>
                </View>
                <Button
                  title="Connect"
                  onPress={() => handleConnect(member.id)}
                  tone="secondary"
                />
              </View>
            </Card>
          ))
        ) : (
          <Card>
            <View style={styles.emptyState}>
              <Text style={styles.emptyEmoji}>🔍</Text>
              <Text style={styles.emptyTitle}>No suggestions yet</Text>
              <Text style={styles.emptyText}>
                Check back later for members in your tier
              </Text>
            </View>
          </Card>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.sky100,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl * 2,
  },
  header: {
    marginBottom: spacing.lg,
  },
  welcomeSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  avatarContainer: {
    position: 'relative',
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: radius.pill,
    borderWidth: 3,
    borderColor: palette.white,
    ...shadows.card,
  },
  avatarPlaceholder: {
    width: 64,
    height: 64,
    borderRadius: radius.pill,
    backgroundColor: palette.navy600,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: palette.white,
    ...shadows.card,
  },
  avatarInitial: {
    color: palette.white,
    fontSize: 28,
    fontWeight: '800',
  },
  welcomeText: {
    flex: 1,
    gap: spacing.xs,
  },
  greeting: {
    fontSize: 22,
    fontWeight: '800',
    color: palette.ink900,
  },
  quickActions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  quickAction: {
    flex: 1,
    backgroundColor: palette.white,
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: 'center',
    ...shadows.card,
  },
  quickActionIcon: {
    width: 48,
    height: 48,
    borderRadius: radius.lg,
    backgroundColor: palette.sky100,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  quickActionEmoji: {
    fontSize: 24,
  },
  quickActionLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: palette.ink900,
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: palette.ink900,
    marginBottom: spacing.sm,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: palette.ink500,
    marginBottom: spacing.md,
    marginTop: -spacing.xs,
  },
  seeAll: {
    fontSize: 14,
    fontWeight: '600',
    color: palette.navy600,
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
  connectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: palette.sky200,
  },
  connectionAvatar: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
  },
  connectionAvatarPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    backgroundColor: palette.navy600,
    alignItems: 'center',
    justifyContent: 'center',
  },
  connectionInitial: {
    color: palette.white,
    fontSize: 18,
    fontWeight: '700',
  },
  connectionInfo: {
    flex: 1,
  },
  connectionName: {
    fontSize: 15,
    fontWeight: '700',
    color: palette.ink900,
  },
  connectionMeta: {
    fontSize: 13,
    color: palette.ink500,
    marginTop: 2,
  },
  suggestionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  suggestionAvatar: {
    width: 48,
    height: 48,
    borderRadius: radius.pill,
  },
  suggestionAvatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: radius.pill,
    backgroundColor: palette.navy600,
    alignItems: 'center',
    justifyContent: 'center',
  },
  suggestionInitial: {
    color: palette.white,
    fontSize: 20,
    fontWeight: '700',
  },
  suggestionInfo: {
    flex: 1,
  },
  suggestionName: {
    fontSize: 15,
    fontWeight: '700',
    color: palette.ink900,
  },
  suggestionMeta: {
    fontSize: 13,
    color: palette.ink700,
    marginTop: 2,
  },
  mutualText: {
    fontSize: 12,
    color: palette.ink500,
    marginTop: 2,
  },
});

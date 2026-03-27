import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  ToastAndroid,
  TouchableOpacity,
  View,
} from 'react-native';
import { Session } from '@supabase/supabase-js';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { TierBadge } from '../../components/TierBadge';
import { UpgradeModal } from '../../components/UpgradeModal';
import { invokeFunction } from '../../lib/api';
import { palette, radius, spacing } from '../../theme/design';
import {
  MatchSuggestion,
  TopMatchesResponse,
  MatchScore,
  MATCH_TIERS,
  RequestIntroductionInput,
  Introduction,
} from '@spotter/types';

interface MutualConnection {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  tier: string;
  connectionDate: string;
}

interface MutualConnectionsResponse {
  data: MutualConnection[];
  count: number;
  targetUserId: string;
}

export function MatchingScreen({ session }: { session: Session }) {
  const [matches, setMatches] = useState<MatchSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedMatch, setSelectedMatch] = useState<MatchSuggestion | null>(null);
  const [metadata, setMetadata] = useState<TopMatchesResponse['metadata'] | null>(null);
  const [pendingIntroIds, setPendingIntroIds] = useState<Set<string>>(new Set());
  const [requestingIntroIds, setRequestingIntroIds] = useState<Set<string>>(new Set());
  
  // Epic 7: Upgrade modal state
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [currentTier, setCurrentTier] = useState<'free' | 'select' | 'summit'>('free');

  const fetchMatches = useCallback(async () => {
    setLoading(true);
    try {
      const response = await invokeFunction<TopMatchesResponse>('top-matches', {
        method: 'POST',
        body: { limit: 10 },
      });
      setMatches(response.matches);
      setMetadata(response.metadata);
    } catch (error) {
      Alert.alert('Failed to load matches', error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchMatches();
  }, [fetchMatches]);

  const fetchMutualConnections = async (targetUserId: string): Promise<MutualConnection[]> => {
    try {
      const response = await invokeFunction<MutualConnectionsResponse>('connections-list', {
        method: 'GET',
      });
      return response.data || [];
    } catch (error) {
      console.log('Failed to fetch mutual connections:', error);
      return [];
    }
  };

  const handleRequestIntroduction = async (match: MatchSuggestion) => {
    if (requestingIntroIds.has(match.user.id) || pendingIntroIds.has(match.user.id)) return;

    // Epic 7: Check tier permissions before requesting introduction
    try {
      const userTierData = await invokeFunction<{
        user: { tier: { slug: string } | null; tierStatus: { isActive: boolean } };
        computed: {
          canSendIntros: boolean;
          introCreditsRemaining: number;
          introCreditsMonthly: number | null;
          introCreditsResetAt: string | null;
        };
      }>('user-with-tier', { method: 'GET' });

      if (!userTierData.computed.canSendIntros) {
        setCurrentTier(userTierData.user.tier?.slug || 'free');
        setShowUpgradeModal(true);
        return;
      }

      // Check intro credits for Select tier
      if (userTierData.computed.introCreditsMonthly !== null) {
        if (userTierData.computed.introCreditsRemaining <= 0) {
          setCurrentTier(userTierData.user.tier?.slug || 'free');
          setShowUpgradeModal(true);
          return;
        }
      }
    } catch (error) {
      console.error('Error checking tier:', error);
      Alert.alert('Error', 'Unable to verify your membership. Please try again.');
      return;
    }

    // Check if there are mutual connections
    if (match.mutualConnections === 0) {
      Alert.alert(
        'No Mutual Connections',
        'You need at least one mutual connection to request an introduction. Try connecting with them directly first.',
        [{ text: 'OK' }]
      );
      return;
    }

    setRequestingIntroIds((prev) => new Set(prev).add(match.user.id));

    try {
      // Fetch actual mutual connections to get connector ID
      const mutualConnections = await fetchMutualConnections(match.user.id);
      
      if (mutualConnections.length === 0) {
        Alert.alert(
          'No Mutual Connections',
          'You need at least one mutual connection to request an introduction.',
          [{ text: 'OK' }]
        );
        return;
      }

      // Use the first mutual connection as the connector
      const connector = mutualConnections[0];

      const response = await invokeFunction<{ data: Introduction }>('network-introduction-request', {
        method: 'POST',
        body: {
          connectorId: connector.id,
          targetId: match.user.id,
          connectorMessage: `I'd like to connect with you for golf.`,
        } as RequestIntroductionInput,
      });

      setPendingIntroIds((prev) => new Set(prev).add(match.user.id));

      if (Platform.OS === 'android') {
        ToastAndroid.show('Introduction request sent', ToastAndroid.SHORT);
      }

      Alert.alert(
        'Request Sent!',
        `Your introduction request to ${match.user.displayName} has been sent via ${connector.displayName}.`,
        [{ text: 'OK', onPress: () => setSelectedMatch(null) }]
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to send introduction request';
      Alert.alert('Error', message);
    } finally {
      setRequestingIntroIds((prev) => {
        const next = new Set(prev);
        next.delete(match.user.id);
        return next;
      });
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchMatches();
  };

  const getTierColor = (tier: string) => {
    switch (tier) {
      case 'excellent':
        return '#059669'; // green
      case 'good':
        return '#0891b2'; // cyan
      case 'fair':
        return '#d97706'; // amber
      default:
        return '#6b7280'; // gray
    }
  };

  const renderFactorBar = (factor: MatchScore['factors'][0]) => {
    const color = factor.rawScore >= 75 ? '#059669' : factor.rawScore >= 50 ? '#d97706' : '#dc2626';
    
    return (
      <View style={styles.factorItem} key={factor.factor}>
        <View style={styles.factorHeader}>
          <Text style={styles.factorLabel}>{factor.label}</Text>
          <Text style={styles.factorScore}>{factor.rawScore}%</Text>
        </View>
        <View style={styles.factorBarBackground}>
          <View style={[styles.factorBarFill, { width: `${factor.rawScore}%`, backgroundColor: color }]} />
        </View>
      </View>
    );
  };

  const renderMatchCard = ({ item }: { item: MatchSuggestion }) => {
    const tier = item.matchScore.tier;
    const tierColor = getTierColor(tier);
    
    return (
      <TouchableOpacity onPress={() => setSelectedMatch(item)} activeOpacity={0.9}>
        <Card>
          <View style={styles.matchCard}>
            <View style={styles.matchHeader}>
              <View style={styles.avatarContainer}>
                {item.user.avatarUrl ? (
                  <Image source={{ uri: item.user.avatarUrl }} style={styles.avatar} />
                ) : (
                  <View style={styles.avatarPlaceholder}>
                    <Text style={styles.avatarInitial}>
                      {item.user.displayName.charAt(0)}
                    </Text>
                  </View>
                )}
              </View>
              <View style={styles.userInfo}>
                <Text style={styles.userName}>{item.user.displayName}</Text>
                {item.user.city && (
                  <Text style={styles.userLocation}>{item.user.city}</Text>
                )}
                {item.professional?.company && (
                  <Text style={styles.professionalInfo}>
                    {item.professional.title} at {item.professional.company}
                  </Text>
                )}
              </View>
              <View style={[styles.scoreCircle, { borderColor: tierColor }]}>
                <Text style={[styles.scoreValue, { color: tierColor }]}>
                  {Math.round(item.matchScore.overallScore)}
                </Text>
                <Text style={styles.scorePercent}>%</Text>
              </View>
            </View>

            <View style={styles.statsRow}>
              {item.golf?.handicap !== undefined && (
                <View style={styles.statItem}>
                  <Text style={styles.statLabel}>Handicap</Text>
                  <Text style={styles.statValue}>{item.golf.handicap}</Text>
                </View>
              )}
              {item.mutualConnections > 0 && (
                <View style={styles.statItem}>
                  <Text style={styles.statLabel}>Mutual</Text>
                  <Text style={styles.statValue}>{item.mutualConnections}</Text>
                </View>
              )}
              {item.distanceKm !== undefined && (
                <View style={styles.statItem}>
                  <Text style={styles.statLabel}>Distance</Text>
                  <Text style={styles.statValue}>{Math.round(item.distanceKm)}km</Text>
                </View>
              )}
            </View>

            <View style={styles.tierBadge}>
              {pendingIntroIds.has(item.user.id) ? (
                <Text style={[styles.tierText, { color: '#8b5cf6' }]}>
                  Intro Pending
                </Text>
              ) : (
                <Text style={[styles.tierText, { color: tierColor }]}>
                  {MATCH_TIERS[tier]?.label}
                </Text>
              )}
            </View>

            <Text style={styles.reasoning} numberOfLines={2}>
              {item.matchScore.reasoning}
            </Text>
          </View>
        </Card>
      </TouchableOpacity>
    );
  };

  const renderMatchDetail = () => {
    if (!selectedMatch) return null;

    const match = selectedMatch;
    const tierColor = getTierColor(match.matchScore.tier);

    return (
      <View style={styles.detailOverlay}>
        <View style={styles.detailContent}>
          <View style={styles.detailHeader}>
            <TouchableOpacity onPress={() => setSelectedMatch(null)} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={styles.detailProfile}>
              {match.user.avatarUrl ? (
                <Image source={{ uri: match.user.avatarUrl }} style={styles.detailAvatar} />
              ) : (
                <View style={styles.detailAvatarPlaceholder}>
                  <Text style={styles.detailAvatarInitial}>
                    {match.user.displayName.charAt(0)}
                  </Text>
                </View>
              )}
              <Text style={styles.detailName}>{match.user.displayName}</Text>
              {match.user.city && (
                <Text style={styles.detailLocation}>{match.user.city}</Text>
              )}
            </View>

            <View style={styles.detailScoreSection}>
              <Text style={styles.detailScoreLabel}>Compatibility Score</Text>
              <View style={[styles.detailScoreCircle, { borderColor: tierColor }]}>
                <Text style={[styles.detailScoreValue, { color: tierColor }]}>
                  {Math.round(match.matchScore.overallScore)}
                </Text>
                <Text style={styles.detailScorePercent}>%</Text>
              </View>
              <Text style={[styles.detailTierLabel, { color: tierColor }]}>
                {MATCH_TIERS[match.matchScore.tier]?.label}
              </Text>
            </View>

            <View style={styles.factorsSection}>
              <Text style={styles.sectionTitle}>Match Factors</Text>
              {match.matchScore.factors.map(renderFactorBar)}
            </View>

            {match.professional && (
              <View style={styles.infoSection}>
                <Text style={styles.sectionTitle}>Professional</Text>
                {match.professional.company && (
                  <Text style={styles.infoText}>
                    <Text style={styles.infoLabel}>Company: </Text>
                    {match.professional.company}
                  </Text>
                )}
                {match.professional.title && (
                  <Text style={styles.infoText}>
                    <Text style={styles.infoLabel}>Title: </Text>
                    {match.professional.title}
                  </Text>
                )}
                {match.professional.industry && (
                  <Text style={styles.infoText}>
                    <Text style={styles.infoLabel}>Industry: </Text>
                    {match.professional.industry}
                  </Text>
                )}
              </View>
            )}

            {match.golf && (
              <View style={styles.infoSection}>
                <Text style={styles.sectionTitle}>Golf Profile</Text>
                {match.golf.handicap !== undefined && (
                  <Text style={styles.infoText}>
                    <Text style={styles.infoLabel}>Handicap: </Text>
                    {match.golf.handicap}
                  </Text>
                )}
                {match.golf.homeCourseName && (
                  <Text style={styles.infoText}>
                    <Text style={styles.infoLabel}>Home Course: </Text>
                    {match.golf.homeCourseName}
                  </Text>
                )}
                {match.golf.yearsPlaying !== undefined && (
                  <Text style={styles.infoText}>
                    <Text style={styles.infoLabel}>Years Playing: </Text>
                    {match.golf.yearsPlaying}
                  </Text>
                )}
              </View>
            )}

            <View style={styles.reasoningSection}>
              <Text style={styles.sectionTitle}>Why This Match?</Text>
              <Text style={styles.reasoningText}>{match.matchScore.reasoning}</Text>
            </View>

            <Button
              title={
                pendingIntroIds.has(match.user.id)
                  ? 'Intro Pending'
                  : requestingIntroIds.has(match.user.id)
                  ? 'Sending...'
                  : 'Request Introduction'
              }
              onPress={() => {
                if (pendingIntroIds.has(match.user.id)) {
                  Alert.alert('Already Pending', 'You have already sent an introduction request to this user.');
                  return;
                }
                if (requestingIntroIds.has(match.user.id)) return;

                Alert.alert(
                  'Request Introduction',
                  `Send introduction request to ${match.user.displayName}?`,
                  [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Send',
                      onPress: () => handleRequestIntroduction(match),
                    },
                  ]
                );
              }}
              tone="primary"
              disabled={pendingIntroIds.has(match.user.id) || requestingIntroIds.has(match.user.id)}
              loading={requestingIntroIds.has(match.user.id)}
            />
            <Button
              title="Close"
              onPress={() => setSelectedMatch(null)}
              tone="secondary"
            />
          </ScrollView>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Your Matches</Text>
        <Text style={styles.subtitle}>Top compatible golfers</Text>
        {metadata && (
          <Text style={styles.metaText}>
            {matches.length} matches from {metadata.candidatePoolSize} candidates
          </Text>
        )}
      </View>

      <FlatList
        data={matches}
        renderItem={renderMatchCard}
        keyExtractor={(item) => item.user.id}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No matches found yet</Text>
              <Text style={styles.emptySubtext}>
                Complete your profile to get better matches
              </Text>
            </View>
          ) : null
        }
      />

      {renderMatchDetail()}

      <UpgradeModal
        visible={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        currentTier={currentTier}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.sky100,
  },
  header: {
    padding: spacing.lg,
    backgroundColor: palette.white,
    borderBottomWidth: 1,
    borderBottomColor: palette.sky200,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: palette.ink900,
  },
  subtitle: {
    fontSize: 14,
    color: palette.ink700,
    marginTop: 4,
  },
  metaText: {
    fontSize: 12,
    color: palette.ink500,
    marginTop: spacing.xs,
  },
  listContent: {
    padding: spacing.md,
  },
  matchCard: {
    gap: spacing.sm,
  },
  matchHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  avatarContainer: {
    width: 48,
    height: 48,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: radius.pill,
  },
  avatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: radius.pill,
    backgroundColor: palette.navy600,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    color: palette.white,
    fontSize: 20,
    fontWeight: '700',
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '700',
    color: palette.ink900,
  },
  userLocation: {
    fontSize: 13,
    color: palette.ink700,
    marginTop: 2,
  },
  professionalInfo: {
    fontSize: 12,
    color: palette.ink500,
    marginTop: 2,
  },
  scoreCircle: {
    width: 56,
    height: 56,
    borderRadius: radius.pill,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreValue: {
    fontSize: 20,
    fontWeight: '800',
  },
  scorePercent: {
    fontSize: 10,
    fontWeight: '600',
    marginTop: -2,
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.lg,
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: palette.sky200,
  },
  statItem: {
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 10,
    color: palette.ink500,
    textTransform: 'uppercase',
  },
  statValue: {
    fontSize: 16,
    fontWeight: '700',
    color: palette.ink900,
  },
  tierBadge: {
    alignSelf: 'flex-start',
    marginTop: spacing.xs,
  },
  tierText: {
    fontSize: 12,
    fontWeight: '700',
  },
  reasoning: {
    fontSize: 13,
    color: palette.ink700,
    marginTop: spacing.xs,
    lineHeight: 18,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: palette.ink700,
  },
  emptySubtext: {
    fontSize: 14,
    color: palette.ink500,
    marginTop: spacing.xs,
    textAlign: 'center',
    paddingHorizontal: spacing.lg,
  },
  detailOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(16, 42, 67, 0.5)',
    justifyContent: 'flex-end',
    zIndex: 100,
  },
  detailContent: {
    backgroundColor: palette.white,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    maxHeight: '90%',
    padding: spacing.lg,
  },
  detailHeader: {
    alignItems: 'flex-end',
    marginBottom: spacing.sm,
  },
  closeButton: {
    padding: spacing.sm,
  },
  closeButtonText: {
    fontSize: 20,
    color: palette.ink700,
    fontWeight: '600',
  },
  detailProfile: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  detailAvatar: {
    width: 80,
    height: 80,
    borderRadius: radius.pill,
    marginBottom: spacing.sm,
  },
  detailAvatarPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: radius.pill,
    backgroundColor: palette.navy600,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  detailAvatarInitial: {
    color: palette.white,
    fontSize: 36,
    fontWeight: '700',
  },
  detailName: {
    fontSize: 22,
    fontWeight: '800',
    color: palette.ink900,
  },
  detailLocation: {
    fontSize: 14,
    color: palette.ink700,
    marginTop: 4,
  },
  detailScoreSection: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  detailScoreLabel: {
    fontSize: 14,
    color: palette.ink700,
    marginBottom: spacing.sm,
  },
  detailScoreCircle: {
    width: 100,
    height: 100,
    borderRadius: radius.pill,
    borderWidth: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailScoreValue: {
    fontSize: 36,
    fontWeight: '800',
  },
  detailScorePercent: {
    fontSize: 14,
    fontWeight: '600',
  },
  detailTierLabel: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: spacing.sm,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: palette.ink900,
    marginBottom: spacing.sm,
  },
  factorsSection: {
    marginBottom: spacing.lg,
  },
  factorItem: {
    marginBottom: spacing.sm,
  },
  factorHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  factorLabel: {
    fontSize: 13,
    color: palette.ink700,
  },
  factorScore: {
    fontSize: 13,
    fontWeight: '600',
    color: palette.ink900,
  },
  factorBarBackground: {
    height: 6,
    backgroundColor: palette.sky200,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  factorBarFill: {
    height: '100%',
    borderRadius: radius.pill,
  },
  infoSection: {
    marginBottom: spacing.lg,
    padding: spacing.md,
    backgroundColor: palette.sky100,
    borderRadius: radius.md,
  },
  infoText: {
    fontSize: 14,
    color: palette.ink700,
    marginBottom: spacing.xs,
  },
  infoLabel: {
    fontWeight: '600',
    color: palette.ink900,
  },
  reasoningSection: {
    marginBottom: spacing.lg,
  },
  reasoningText: {
    fontSize: 14,
    color: palette.ink700,
    lineHeight: 20,
  },
});

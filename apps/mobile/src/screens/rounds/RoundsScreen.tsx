import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Session } from '@supabase/supabase-js';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { invokeFunction } from '../../lib/api';
import { palette, radius, spacing } from '../../theme/design';
import {
  RoundWithCourse,
  RoundStatus,
  RoundFilters,
  ROUND_STATUS_META,
  RoundListResponse,
} from '@spotter/types';

type RoundsTab = 'upcoming' | 'pending' | 'past';

interface RoundsScreenProps {
  session: Session;
  onCreateRound: () => void;
  onRoundPress: (round: RoundWithCourse) => void;
}

export function RoundsScreen({ session, onCreateRound, onRoundPress }: RoundsScreenProps) {
  const [activeTab, setActiveTab] = useState<RoundsTab>('upcoming');
  const [rounds, setRounds] = useState<RoundWithCourse[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const fetchRounds = useCallback(async () => {
    setLoading(true);
    try {
      const filters: RoundFilters = {};
      
      // Configure filters based on active tab
      if (activeTab === 'upcoming') {
        filters.status = ['open', 'full', 'confirmed', 'in_progress'];
        filters.dateFrom = new Date().toISOString();
      } else if (activeTab === 'pending') {
        filters.invitedOnly = true;
        filters.status = 'open';
      } else if (activeTab === 'past') {
        filters.status = ['completed', 'cancelled'];
        filters.dateTo = new Date().toISOString();
      }

      const response = await invokeFunction<RoundListResponse>('rounds-list', {
        method: 'POST',
        body: { ...filters, limit: 50 },
      });
      
      setRounds(response.data);
    } catch (error) {
      Alert.alert('Failed to load rounds', error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeTab]);

  useEffect(() => {
    fetchRounds();
  }, [fetchRounds]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchRounds();
  };

  const getStatusColor = (status: RoundStatus) => {
    switch (status) {
      case 'open':
        return { bg: '#DBEAFE', text: '#1E40AF' }; // blue
      case 'full':
        return { bg: '#FEF3C7', text: '#92400E' }; // amber
      case 'confirmed':
        return { bg: '#D1FAE5', text: '#065F46' }; // green
      case 'in_progress':
        return { bg: '#E0E7FF', text: '#3730A3' }; // indigo
      case 'completed':
        return { bg: '#F3F4F6', text: '#374151' }; // gray
      case 'cancelled':
        return { bg: '#FEE2E2', text: '#991B1B' }; // red
      default:
        return { bg: palette.sky100, text: palette.ink700 };
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const isToday = date.toDateString() === today.toDateString();
    const isTomorrow = date.toDateString() === tomorrow.toDateString();

    if (isToday) return 'Today';
    if (isTomorrow) return 'Tomorrow';
    
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const renderRoundCard = ({ item }: { item: RoundWithCourse }) => {
    const statusColors = getStatusColor(item.status);
    const statusMeta = ROUND_STATUS_META[item.status];
    const isParticipant = item.isParticipant;
    const myStatus = item.myInvitationStatus;

    return (
      <TouchableOpacity onPress={() => onRoundPress(item)} activeOpacity={0.9}>
        <Card>
          <View style={styles.roundCard}>
            <View style={styles.roundHeader}>
              <View style={styles.dateContainer}>
                <Text style={styles.dateText}>{formatDate(item.scheduledAt)}</Text>
                <Text style={styles.timeText}>{formatTime(item.scheduledAt)}</Text>
              </View>
              <View style={[styles.statusBadge, { backgroundColor: statusColors.bg }]}>
                <Text style={[styles.statusText, { color: statusColors.text }]}>
                  {statusMeta.label}
                </Text>
              </View>
            </View>

            <View style={styles.courseSection}>
              <Text style={styles.courseName}>{item.course.name}</Text>
              <Text style={styles.courseLocation}>
                {item.course.city}, {item.course.state}
              </Text>
            </View>

            <View style={styles.roundDetails}>
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>Players</Text>
                <Text style={styles.detailValue}>
                  {item.confirmedParticipants}/{item.maxPlayers}
                </Text>
              </View>
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>Cart</Text>
                <Text style={styles.detailValue}>
                  {item.cartPreference.charAt(0).toUpperCase() + item.cartPreference.slice(1)}
                </Text>
              </View>
              {isParticipant && (
                <View style={styles.detailItem}>
                  <Text style={styles.detailLabel}>Your Status</Text>
                  <Text style={[styles.detailValue, styles.participantBadge]}>
                    Joined
                  </Text>
                </View>
              )}
              {myStatus && (
                <View style={styles.detailItem}>
                  <Text style={styles.detailLabel}>Invitation</Text>
                  <Text style={[
                    styles.detailValue,
                    myStatus === 'pending' && styles.pendingBadge,
                    myStatus === 'accepted' && styles.acceptedBadge,
                    myStatus === 'declined' && styles.declinedBadge,
                  ]}>
                    {myStatus.charAt(0).toUpperCase() + myStatus.slice(1)}
                  </Text>
                </View>
              )}
            </View>

            {item.notes && (
              <Text style={styles.notes} numberOfLines={2}>
                {item.notes}
              </Text>
            )}
          </View>
        </Card>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Rounds</Text>
        <Text style={styles.subtitle}>Manage your golf rounds</Text>
      </View>

      <View style={styles.tabBar}>
        {(['upcoming', 'pending', 'past'] as RoundsTab[]).map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.tabActive]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.createButtonContainer}>
        <Button title="Create Round" onPress={onCreateRound} />
      </View>

      <FlatList
        data={rounds}
        renderItem={renderRoundCard}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>
                {activeTab === 'upcoming' && 'No upcoming rounds'}
                {activeTab === 'pending' && 'No pending invitations'}
                {activeTab === 'past' && 'No past rounds'}
              </Text>
              <Text style={styles.emptySubtext}>
                {activeTab === 'upcoming' && 'Create a round to get started'}
                {activeTab === 'pending' && 'Invitations will appear here'}
                {activeTab === 'past' && 'Completed rounds will appear here'}
              </Text>
            </View>
          ) : null
        }
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
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: palette.navy600,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: palette.ink700,
  },
  tabTextActive: {
    color: palette.navy600,
  },
  createButtonContainer: {
    padding: spacing.md,
    backgroundColor: palette.white,
    borderBottomWidth: 1,
    borderBottomColor: palette.sky200,
  },
  listContent: {
    padding: spacing.md,
  },
  roundCard: {
    gap: spacing.sm,
  },
  roundHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  dateContainer: {
    flex: 1,
  },
  dateText: {
    fontSize: 16,
    fontWeight: '700',
    color: palette.ink900,
  },
  timeText: {
    fontSize: 14,
    color: palette.ink700,
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
  },
  courseSection: {
    marginTop: spacing.sm,
  },
  courseName: {
    fontSize: 15,
    fontWeight: '600',
    color: palette.ink900,
  },
  courseLocation: {
    fontSize: 13,
    color: palette.ink700,
    marginTop: 2,
  },
  roundDetails: {
    flexDirection: 'row',
    gap: spacing.lg,
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: palette.sky200,
  },
  detailItem: {
    flex: 1,
  },
  detailLabel: {
    fontSize: 11,
    color: palette.ink500,
    textTransform: 'uppercase',
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '600',
    color: palette.ink900,
    marginTop: 2,
  },
  participantBadge: {
    color: '#059669',
  },
  pendingBadge: {
    color: '#d97706',
  },
  acceptedBadge: {
    color: '#059669',
  },
  declinedBadge: {
    color: '#dc2626',
  },
  notes: {
    fontSize: 13,
    color: palette.ink700,
    marginTop: spacing.sm,
    fontStyle: 'italic',
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
  },
});

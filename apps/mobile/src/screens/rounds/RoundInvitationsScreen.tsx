import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  Image,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Session } from '@supabase/supabase-js';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { invokeFunction } from '../lib/api';
import { palette, radius, spacing } from '../theme/design';
import {
  RoundInvitation,
  RoundInvitationWithRound,
  InvitationStatus,
  INVITATION_STATUS_META,
  RespondToRoundInput,
} from '@spotter/types';

type InvitationsTab = 'incoming' | 'sent';

interface InvitationsResponse {
  incoming: RoundInvitationWithRound[];
  sent: RoundInvitationWithRound[];
}

interface RoundInvitationsScreenProps {
  session: Session;
  onRoundPress: (roundId: string) => void;
}

export function RoundInvitationsScreen({ session, onRoundPress }: RoundInvitationsScreenProps) {
  const [activeTab, setActiveTab] = useState<InvitationsTab>('incoming');
  const [incoming, setIncoming] = useState<RoundInvitationWithRound[]>([]);
  const [sent, setSent] = useState<RoundInvitationWithRound[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [respondingId, setRespondingId] = useState<string | null>(null);

  const fetchInvitations = useCallback(async () => {
    setLoading(true);
    try {
      const response = await invokeFunction<InvitationsResponse>('round-invitations', {
        method: 'GET',
      });
      setIncoming(response.incoming);
      setSent(response.sent);
    } catch (error) {
      Alert.alert('Failed to load invitations', error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchInvitations();
  }, [fetchInvitations]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchInvitations();
  };

  const respondToInvitation = async (invitationId: string, action: 'accept' | 'decline') => {
    setRespondingId(invitationId);
    try {
      const input = {
        invitationId,
        action,
      };

      await invokeFunction('round-respond', {
        method: 'POST',
        body: input as Record<string, unknown>,
      });

      // Refresh the list
      await fetchInvitations();
      
      if (action === 'accept') {
        Alert.alert('Accepted', 'You have joined the round!');
      }
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to respond');
    } finally {
      setRespondingId(null);
    }
  };

  const getStatusColor = (status: InvitationStatus) => {
    switch (status) {
      case 'pending':
        return { bg: '#FEF3C7', text: '#92400E' }; // amber
      case 'accepted':
        return { bg: '#D1FAE5', text: '#065F46' }; // green
      case 'declined':
        return { bg: '#FEE2E2', text: '#991B1B' }; // red
      case 'expired':
        return { bg: '#F3F4F6', text: '#374151' }; // gray
      default:
        return { bg: palette.sky100, text: palette.ink700 };
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
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

  const renderIncomingInvitation = ({ item }: { item: RoundInvitationWithRound }) => {
    const statusColors = getStatusColor(item.status);
    const statusMeta = INVITATION_STATUS_META[item.status];
    const round = item.round;

    return (
      <Card>
        <View style={styles.invitationCard}>
          <View style={styles.invitationHeader}>
            <View style={styles.invitationBadge}>
              <Text style={styles.invitationLabel}>Invitation</Text>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: statusColors.bg }]}>
              <Text style={[styles.statusText, { color: statusColors.text }]}>
                {statusMeta.label}
              </Text>
            </View>
          </View>

          <TouchableOpacity
            onPress={() => onRoundPress(round.id)}
            activeOpacity={0.8}
            style={styles.roundInfo}
          >
            <Text style={styles.courseName}>{round.course.name}</Text>
            <Text style={styles.courseLocation}>
              {round.course.city}, {round.course.state}
            </Text>
            <Text style={styles.roundDateTime}>
              {formatDate(round.scheduledAt)} at {formatTime(round.scheduledAt)}
            </Text>
          </TouchableOpacity>

          <View style={styles.roundDetails}>
            <Text style={styles.detailText}>
              {round.confirmedParticipants}/{round.maxPlayers} players
            </Text>
            <Text style={styles.detailText}>
              Cart: {round.cartPreference.charAt(0).toUpperCase() + round.cartPreference.slice(1)}
            </Text>
          </View>

          {item.status === 'pending' && (
            <View style={styles.actions}>
              <Button
                title={respondingId === item.id ? 'Working...' : 'Accept'}
                onPress={() => respondToInvitation(item.id, 'accept')}
                disabled={respondingId === item.id}
              />
              <Button
                title="Decline"
                onPress={() =>
                  Alert.alert('Decline Invitation', 'Are you sure?', [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Decline',
                      style: 'destructive',
                      onPress: () => respondToInvitation(item.id, 'decline'),
                    },
                  ])
                }
                disabled={respondingId === item.id}
                tone="secondary"
              />
            </View>
          )}

          {item.status === 'accepted' && (
            <View style={styles.acceptedBadge}>
              <Text style={styles.acceptedText}>✓ You are attending</Text>
            </View>
          )}

          {item.status === 'declined' && (
            <View style={styles.declinedBadge}>
              <Text style={styles.declinedText}>✗ You declined</Text>
            </View>
          )}
        </View>
      </Card>
    );
  };

  const renderSentInvitation = ({ item }: { item: RoundInvitationWithRound }) => {
    const statusColors = getStatusColor(item.status);
    const statusMeta = INVITATION_STATUS_META[item.status];
    const round = item.round;
    const invitee = item.invitee;

    return (
      <Card>
        <View style={styles.invitationCard}>
          <View style={styles.invitationHeader}>
            <View style={styles.sentBadge}>
              <Text style={styles.sentLabel}>Sent</Text>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: statusColors.bg }]}>
              <Text style={[styles.statusText, { color: statusColors.text }]}>
                {statusMeta.label}
              </Text>
            </View>
          </View>

          <View style={styles.inviteeRow}>
            {invitee?.avatarUrl ? (
              <Image source={{ uri: invitee.avatarUrl }} style={styles.inviteeAvatar} />
            ) : (
              <View style={styles.inviteeAvatarPlaceholder}>
                <Text style={styles.inviteeAvatarInitial}>{invitee?.displayName.charAt(0) || '?'}</Text>
              </View>
            )}
            <View style={styles.inviteeInfo}>
              <Text style={styles.inviteeName}>{invitee?.displayName || 'Unknown'}</Text>
              {item.message && (
                <Text style={styles.inviteeMessage} numberOfLines={2}>
                  "{item.message}"
                </Text>
              )}
            </View>
          </View>

          <TouchableOpacity
            onPress={() => onRoundPress(round.id)}
            activeOpacity={0.8}
            style={styles.roundInfoCompact}
          >
            <Text style={styles.courseNameSmall}>{round.course.name}</Text>
            <Text style={styles.roundDateTimeSmall}>
              {formatDate(round.scheduledAt)} at {formatTime(round.scheduledAt)}
            </Text>
          </TouchableOpacity>
        </View>
      </Card>
    );
  };

  const data = activeTab === 'incoming' ? incoming : sent;
  const renderItem = activeTab === 'incoming' ? renderIncomingInvitation : renderSentInvitation;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Invitations</Text>
        <Text style={styles.subtitle}>Manage round invitations</Text>
      </View>

      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'incoming' && styles.tabActive]}
          onPress={() => setActiveTab('incoming')}
        >
          <Text style={[styles.tabText, activeTab === 'incoming' && styles.tabTextActive]}>
            Incoming
          </Text>
          {incoming.length > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{incoming.length}</Text>
            </View>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'sent' && styles.tabActive]}
          onPress={() => setActiveTab('sent')}
        >
          <Text style={[styles.tabText, activeTab === 'sent' && styles.tabTextActive]}>
            Sent
          </Text>
          {sent.length > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{sent.length}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      <FlatList
        data={data}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>
                {activeTab === 'incoming' && 'No incoming invitations'}
                {activeTab === 'sent' && 'No sent invitations'}
              </Text>
              <Text style={styles.emptySubtext}>
                {activeTab === 'incoming' && 'Invitations will appear here when others invite you'}
                {activeTab === 'sent' && 'Invitations you send will appear here'}
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    gap: spacing.xs,
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
  badge: {
    backgroundColor: palette.navy600,
    borderRadius: radius.pill,
    paddingHorizontal: 6,
    paddingVertical: 2,
    minWidth: 20,
    alignItems: 'center',
  },
  badgeText: {
    color: palette.white,
    fontSize: 12,
    fontWeight: '700',
  },
  listContent: {
    padding: spacing.md,
  },
  invitationCard: {
    gap: spacing.sm,
  },
  invitationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  invitationBadge: {
    backgroundColor: '#DBEAFE',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
  },
  invitationLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1E40AF',
    textTransform: 'uppercase',
  },
  sentBadge: {
    backgroundColor: '#E0E7FF',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
  },
  sentLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#3730A3',
    textTransform: 'uppercase',
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  roundInfo: {
    marginTop: spacing.xs,
  },
  roundInfoCompact: {
    backgroundColor: palette.sky100,
    borderRadius: radius.sm,
    padding: spacing.sm,
    marginTop: spacing.sm,
  },
  courseName: {
    fontSize: 16,
    fontWeight: '700',
    color: palette.ink900,
  },
  courseNameSmall: {
    fontSize: 14,
    fontWeight: '600',
    color: palette.ink900,
  },
  courseLocation: {
    fontSize: 13,
    color: palette.ink700,
    marginTop: 2,
  },
  roundDateTime: {
    fontSize: 14,
    color: palette.ink700,
    marginTop: 4,
    fontWeight: '500',
  },
  roundDateTimeSmall: {
    fontSize: 12,
    color: palette.ink500,
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
  detailText: {
    fontSize: 13,
    color: palette.ink700,
    fontWeight: '500',
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  acceptedBadge: {
    backgroundColor: '#D1FAE5',
    borderRadius: radius.sm,
    padding: spacing.sm,
    marginTop: spacing.sm,
  },
  acceptedText: {
    color: '#065F46',
    fontWeight: '600',
    textAlign: 'center',
  },
  declinedBadge: {
    backgroundColor: '#FEE2E2',
    borderRadius: radius.sm,
    padding: spacing.sm,
    marginTop: spacing.sm,
  },
  declinedText: {
    color: '#991B1B',
    fontWeight: '600',
    textAlign: 'center',
  },
  inviteeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  inviteeAvatar: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
  },
  inviteeAvatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: palette.navy600,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inviteeAvatarInitial: {
    color: palette.white,
    fontSize: 16,
    fontWeight: '700',
  },
  inviteeInfo: {
    flex: 1,
  },
  inviteeName: {
    fontSize: 14,
    fontWeight: '600',
    color: palette.ink900,
  },
  inviteeMessage: {
    fontSize: 12,
    color: palette.ink500,
    marginTop: 2,
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
    paddingHorizontal: spacing.lg,
  },
});

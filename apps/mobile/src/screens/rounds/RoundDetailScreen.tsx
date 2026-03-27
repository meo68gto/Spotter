// Epic 5: Round Detail Screen
// Shows course, time, participants, status, and actions

import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
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
  ROUND_STATUS_META,
} from '@spotter/types';

// Backend response type for participant (matches rounds-detail edge function)
interface RoundParticipantResponse {
  id: string;
  userId: string;
  displayName: string;
  avatarUrl?: string;
  currentHandicap?: number;
  isCreator: boolean;
  joinedAt: string;
}

interface RoundDetailScreenProps {
  session: Session;
  roundId: string;
  onBack: () => void;
  onEdit?: (roundId: string) => void;
}

export function RoundDetailScreen({
  session,
  roundId,
  onBack,
  onEdit,
}: RoundDetailScreenProps) {
  const [round, setRound] = useState<RoundWithCourse | null>(null);
  const [participants, setParticipants] = useState<RoundParticipantResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchRoundDetail = async () => {
    try {
      setLoading(true);
      setError(null);

      // Get round details with participants via rounds-detail
      const response = await invokeFunction<{
        data: RoundWithCourse & { participants: RoundParticipantResponse[] };
      }>('rounds-detail', {
        method: 'GET',
        params: { roundId },
      });

      if (!response.data) {
        setError('Round not found');
        return;
      }

      setRound(response.data);
      setParticipants(response.data.participants || []);
    } catch (err: any) {
      console.error('Error fetching round detail:', err);
      // Extract error message from backend response if available
      const errorMessage = err?.response?.data?.error || 
                          err?.message || 
                          'Failed to load round details';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRoundDetail();
  }, [roundId]);

  const handleCancelRound = async () => {
    Alert.alert(
      'Cancel Round',
      'Are you sure you want to cancel this round?',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: async () => {
            setActionLoading(true);
            try {
              await invokeFunction('rounds-cancel', {
                method: 'POST',
                body: { roundId },
              });
              Alert.alert('Success', 'Round cancelled successfully');
              fetchRoundDetail();
            } catch (err) {
              Alert.alert('Error', err instanceof Error ? err.message : 'Failed to cancel round');
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleLeaveRound = async () => {
    Alert.alert(
      'Leave Round',
      'Are you sure you want to leave this round?',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes, Leave',
          style: 'destructive',
          onPress: async () => {
            setActionLoading(true);
            try {
              await invokeFunction('rounds-leave', {
                method: 'POST',
                body: { roundId },
              });
              Alert.alert('Success', 'You have left the round');
              fetchRoundDetail();
            } catch (err) {
              Alert.alert('Error', err instanceof Error ? err.message : 'Failed to leave round');
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]
    );
  };

  const getStatusColor = (status: RoundStatus) => {
    switch (status) {
      case 'open':
        return { bg: '#DBEAFE', text: '#1E40AF' };
      case 'full':
        return { bg: '#FEF3C7', text: '#92400E' };
      case 'confirmed':
        return { bg: '#D1FAE5', text: '#065F46' };
      case 'in_progress':
        return { bg: '#E0E7FF', text: '#3730A3' };
      case 'completed':
        return { bg: '#F3F4F6', text: '#374151' };
      case 'cancelled':
        return { bg: '#FEE2E2', text: '#991B1B' };
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
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    });
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={palette.navy600} />
        <Text style={styles.loadingText}>Loading round details...</Text>
      </View>
    );
  }

  if (error || !round) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>{error || 'Round not found'}</Text>
        <Button title="Go Back" onPress={onBack} />
      </View>
    );
  }

  const statusColors = getStatusColor(round.status);
  const statusMeta = ROUND_STATUS_META[round.status];
  const isCreator = round.creatorId === session.user.id;
  const isParticipant = round.isParticipant;
  const canCancel = isCreator && ['open', 'full'].includes(round.status);
  const canLeave = isParticipant && !isCreator && ['open', 'full', 'confirmed'].includes(round.status);

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Round Details</Text>
        <Text style={styles.subtitle}>{round.course.name}</Text>
      </View>

      <View style={styles.content}>
        {/* Status Card */}
        <Card>
          <View style={styles.statusRow}>
            <View style={[styles.statusBadge, { backgroundColor: statusColors.bg }]}>
              <Text style={[styles.statusText, { color: statusColors.text }]}>
                {statusMeta.label}
              </Text>
            </View>
            <Text style={styles.dateTimeText}>
              {formatDate(round.scheduledAt)} at {formatTime(round.scheduledAt)}
            </Text>
          </View>
        </Card>

        {/* Course Card */}
        <Card>
          <Text style={styles.sectionTitle}>Course</Text>
          <Text style={styles.courseName}>{round.course.name}</Text>
          <Text style={styles.courseLocation}>
            {round.course.city}, {round.course.state}
          </Text>
        </Card>

        {/* Details Card */}
        <Card>
          <Text style={styles.sectionTitle}>Details</Text>
          <View style={styles.detailsGrid}>
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Group Size</Text>
              <Text style={styles.detailValue}>
                {round.confirmedParticipants}/{round.maxPlayers} players
              </Text>
            </View>
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Cart Preference</Text>
              <Text style={styles.detailValue}>
                {round.cartPreference.charAt(0).toUpperCase() + round.cartPreference.slice(1)}
              </Text>
            </View>
          </View>
          {round.notes && (
            <View style={styles.notesSection}>
              <Text style={styles.detailLabel}>Notes</Text>
              <Text style={styles.notesText}>{round.notes}</Text>
            </View>
          )}
        </Card>

        {/* Participants Card */}
        <Card>
          <Text style={styles.sectionTitle}>Participants</Text>
          <View style={styles.participantsList}>
            {participants.map((participant) => (
              <View key={participant.id} style={styles.participantRow}>
                {participant.avatarUrl ? (
                  <Image
                    source={{ uri: participant.avatarUrl }}
                    style={styles.participantAvatar}
                  />
                ) : (
                  <View style={styles.participantAvatarFallback}>
                    <Text style={styles.participantAvatarInitial}>
                      {participant.displayName.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                )}
                <View style={styles.participantInfo}>
                  <Text style={styles.participantName}>
                    {participant.displayName}
                    {participant.isCreator && (
                      <Text style={styles.creatorBadge}> (Host)</Text>
                    )}
                  </Text>
                  {participant.currentHandicap && (
                    <Text style={styles.participantHandicap}>
                      Handicap: {participant.currentHandicap}
                    </Text>
                  )}
                </View>
              </View>
            ))}
          </View>
        </Card>

        {/* Actions */}
        {(canCancel || canLeave) && (
          <View style={styles.actions}>
            {canCancel && (
              <Button
                title={actionLoading ? 'Cancelling...' : 'Cancel Round'}
                onPress={handleCancelRound}
                disabled={actionLoading}
              />
            )}
            {canLeave && (
              <Button
                title={actionLoading ? 'Leaving...' : 'Leave Round'}
                onPress={handleLeaveRound}
                disabled={actionLoading}
              />
            )}
          </View>
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
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: palette.sky100,
    padding: spacing.lg,
  },
  loadingText: {
    marginTop: spacing.md,
    fontSize: 14,
    color: palette.ink500,
  },
  errorText: {
    fontSize: 16,
    color: palette.error,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  header: {
    padding: spacing.lg,
    backgroundColor: palette.white,
    borderBottomWidth: 1,
    borderBottomColor: palette.sky200,
  },
  backButton: {
    marginBottom: spacing.sm,
  },
  backButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: palette.navy600,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: palette.ink900,
  },
  subtitle: {
    fontSize: 14,
    color: palette.ink500,
    marginTop: 4,
  },
  content: {
    padding: spacing.md,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
  dateTimeText: {
    fontSize: 14,
    fontWeight: '600',
    color: palette.ink900,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: palette.ink900,
    marginBottom: spacing.sm,
  },
  courseName: {
    fontSize: 18,
    fontWeight: '700',
    color: palette.ink900,
  },
  courseLocation: {
    fontSize: 14,
    color: palette.ink500,
    marginTop: 4,
  },
  detailsGrid: {
    flexDirection: 'row',
    gap: spacing.lg,
  },
  detailItem: {
    flex: 1,
  },
  detailLabel: {
    fontSize: 12,
    color: palette.ink500,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '600',
    color: palette.ink900,
  },
  notesSection: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: palette.sky200,
  },
  notesText: {
    fontSize: 14,
    color: palette.ink700,
    marginTop: 4,
  },
  participantsList: {
    gap: spacing.sm,
  },
  participantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  participantAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  participantAvatarFallback: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: palette.navy600,
    alignItems: 'center',
    justifyContent: 'center',
  },
  participantAvatarInitial: {
    color: palette.white,
    fontSize: 16,
    fontWeight: '700',
  },
  participantInfo: {
    flex: 1,
  },
  participantName: {
    fontSize: 14,
    fontWeight: '600',
    color: palette.ink900,
  },
  creatorBadge: {
    fontWeight: '700',
    color: palette.navy600,
  },
  participantHandicap: {
    fontSize: 12,
    color: palette.ink500,
    marginTop: 2,
  },
  actions: {
    marginTop: spacing.md,
    gap: spacing.sm,
  },
});

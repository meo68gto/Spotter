import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { GolfRound, RoundStatus } from '@spotter/types';
import { Card } from './Card';
import { palette, radius, spacing } from '../theme/design';

interface RoundCardProps {
  round: GolfRound;
  onPress?: () => void;
}

const STATUS_CONFIG: Record<RoundStatus, { label: string; bgColor: string; textColor: string }> = {
  draft: { label: 'Draft', bgColor: palette.sky100, textColor: palette.ink700 },
  open: { label: 'Open', bgColor: '#DBEAFE', textColor: '#1E40AF' }, // blue
  full: { label: 'Full', bgColor: '#FEF3C7', textColor: '#92400E' }, // amber
  confirmed: { label: 'Confirmed', bgColor: '#D1FAE5', textColor: '#065F46' }, // green
  in_progress: { label: 'In Progress', bgColor: '#E0E7FF', textColor: '#3730A3' }, // indigo
  completed: { label: 'Completed', bgColor: '#F3F4F6', textColor: palette.ink700 }, // gray
  cancelled: { label: 'Cancelled', bgColor: '#FEE2E2', textColor: '#991B1B' }, // red
};

export function RoundCard({ round, onPress }: RoundCardProps) {
  const statusConfig = STATUS_CONFIG[round.status];
  const participantCount = round.playerIds?.length || 1;
  const maxPlayers = round.maxPlayers || 4;

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8}>
      <Card>
        <View style={styles.container}>
          <View style={styles.header}>
            <View style={styles.courseInfo}>
              <Text style={styles.courseName}>{round.course?.name || 'Unknown Course'}</Text>
              <Text style={styles.dateTime}>
                {formatDate(round.teeTime)} at {formatTime(round.teeTime)}
              </Text>
            </View>
            <View
              style={[
                styles.statusBadge,
                { backgroundColor: statusConfig.bgColor },
              ]}
            >
              <Text style={[styles.statusText, { color: statusConfig.textColor }]}>
                {statusConfig.label}
              </Text>
            </View>
          </View>

          <View style={styles.footer}>
            <View style={styles.participants}>
              <Text style={styles.participantText}>
                {participantCount}/{maxPlayers} players
              </Text>
            </View>
            {round.organizerId && (
              <View style={styles.organizer}>
                <Text style={styles.organizerLabel}>Organized by</Text>
                <View style={styles.organizerAvatar}>
                  <Text style={styles.organizerInitial}>?</Text>
                </View>
              </View>
            )}
          </View>
        </View>
      </Card>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  courseInfo: {
    flex: 1,
  },
  courseName: {
    fontSize: 16,
    fontWeight: '700',
    color: palette.ink900,
  },
  dateTime: {
    fontSize: 14,
    color: palette.ink700,
    marginTop: 2,
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
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: palette.sky200,
  },
  participants: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  participantText: {
    fontSize: 13,
    color: palette.ink700,
    fontWeight: '600',
  },
  organizer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  organizerLabel: {
    fontSize: 12,
    color: palette.ink500,
  },
  organizerAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: palette.navy600,
    alignItems: 'center',
    justifyContent: 'center',
  },
  organizerInitial: {
    color: palette.white,
    fontSize: 10,
    fontWeight: '700',
  },
});

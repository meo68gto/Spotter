// Epic 5: Standing Foursome Card Component
// Displays a standing foursome group

import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Card } from './Card';
import { palette, radius, spacing } from '../theme/design';
import { StandingFoursomeWithMembers } from '@spotter/types';

interface StandingFoursomeCardProps {
  foursome: StandingFoursomeWithMembers;
  onPress?: () => void;
  onSchedulePress?: () => void;
}

export function StandingFoursomeCard({ foursome, onPress, onSchedulePress }: StandingFoursomeCardProps) {
  const memberCount = foursome.members?.length || 1;
  const organizer = foursome.organizer;

  const formatLastRound = (dateString?: string) => {
    if (!dateString) return 'No rounds yet';
    const date = new Date(dateString);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Played today';
    if (diffDays === 1) return 'Played yesterday';
    if (diffDays < 7) return `Played ${diffDays} days ago`;
    if (diffDays < 30) return `Played ${Math.floor(diffDays / 7)} weeks ago`;
    return `Last played ${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
  };

  const getCadenceLabel = (cadence: string) => {
    const labels: Record<string, string> = {
      weekly: 'Weekly',
      biweekly: 'Bi-weekly',
      monthly: 'Monthly',
      flexible: 'When we can',
    };
    return labels[cadence] || cadence;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return { bg: '#DBEAFE', text: '#1E40AF' }; // blue
      case 'paused': return { bg: '#FEF3C7', text: '#92400E' }; // amber
      case 'disbanded': return { bg: '#F3F4F6', text: '#6B7280' }; // gray
      default: return { bg: palette.sky200, text: palette.ink700 };
    }
  };

  const statusColors = getStatusColor(foursome.status);

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8}>
      <Card>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.titleSection}>
              <Text style={styles.name}>{foursome.name}</Text>
              {foursome.preferredCourse && (
                <Text style={styles.course}>
                  {foursome.preferredCourse.name}
                </Text>
              )}
            </View>
            <View style={[styles.statusBadge, { backgroundColor: statusColors.bg }]}>
              <Text style={[styles.statusText, { color: statusColors.text }]}>
                {foursome.status.charAt(0).toUpperCase() + foursome.status.slice(1)}
              </Text>
            </View>
          </View>

          {/* Members */}
          <View style={styles.membersSection}>
            <Text style={styles.sectionLabel}>{memberCount} Members</Text>
            <View style={styles.memberAvatars}>
              {foursome.members?.slice(0, 4).map((member, index) => (
                <View 
                  key={member.userId} 
                  style={[
                    styles.avatarContainer,
                    index > 0 && styles.avatarOverlap
                  ]}
                >
                  {member.avatarUrl ? (
                    <Image source={{ uri: member.avatarUrl }} style={styles.avatar} />
                  ) : (
                    <View style={[styles.avatar, styles.avatarFallback]}>
                      <Text style={styles.avatarInitial}>
                        {member.displayName.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                  )}
                  {member.role === 'organizer' && (
                    <View style={styles.organizerBadge}>
                      <Text style={styles.organizerBadgeText}>★</Text>
                    </View>
                  )}
                </View>
              ))}
            </View>
          </View>

          {/* Stats */}
          <View style={styles.statsSection}>
            <View style={styles.stat}>
              <Text style={styles.statValue}>{foursome.roundsPlayedCount}</Text>
              <Text style={styles.statLabel}>Rounds</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.stat}>
              <Text style={styles.statValue}>{getCadenceLabel(foursome.cadence)}</Text>
              <Text style={styles.statLabel}>Cadence</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.stat}>
              <Text style={[styles.statValue, styles.lastRoundText]}>
                {formatLastRound(foursome.lastRoundAt)}
              </Text>
              <Text style={styles.statLabel}>Activity</Text>
            </View>
          </View>

          {/* Schedule Button */}
          {foursome.status === 'active' && onSchedulePress && (
            <TouchableOpacity 
              style={styles.scheduleButton}
              onPress={(e) => {
                e.stopPropagation();
                onSchedulePress();
              }}
            >
              <Text style={styles.scheduleButtonText}>Schedule Next Round</Text>
            </TouchableOpacity>
          )}
        </View>
      </Card>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  titleSection: {
    flex: 1,
  },
  name: {
    fontSize: 16,
    fontWeight: '700',
    color: palette.ink900,
  },
  course: {
    fontSize: 13,
    color: palette.ink500,
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs / 2,
    borderRadius: radius.sm,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  membersSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionLabel: {
    fontSize: 12,
    color: palette.ink500,
    fontWeight: '500',
  },
  memberAvatars: {
    flexDirection: 'row',
  },
  avatarContainer: {
    position: 'relative',
  },
  avatarOverlap: {
    marginLeft: -8,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: palette.white,
  },
  avatarFallback: {
    backgroundColor: palette.navy600,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    color: palette.white,
    fontSize: 12,
    fontWeight: '700',
  },
  organizerBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: palette.navy600,
    width: 14,
    height: 14,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: palette.white,
  },
  organizerBadgeText: {
    color: palette.white,
    fontSize: 8,
    fontWeight: '700',
  },
  statsSection: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: palette.sky200,
  },
  stat: {
    flex: 1,
    alignItems: 'center',
  },
  statDivider: {
    width: 1,
    height: 24,
    backgroundColor: palette.sky200,
  },
  statValue: {
    fontSize: 14,
    fontWeight: '700',
    color: palette.ink900,
  },
  statLabel: {
    fontSize: 11,
    color: palette.ink500,
    marginTop: 2,
  },
  lastRoundText: {
    fontSize: 12,
  },
  scheduleButton: {
    backgroundColor: palette.navy600,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  scheduleButtonText: {
    color: palette.white,
    fontSize: 14,
    fontWeight: '600',
  },
});

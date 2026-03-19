import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { 
  RelationshipState, 
  getRelationshipStateLabel,
  getStrengthScoreColor,
  getStrengthScoreLabel,
} from '@spotter/types';
import { Card } from './Card';
import { palette, radius, spacing } from '../theme/design';

interface ConnectionCardProps {
  id: string;
  displayName: string;
  avatarUrl?: string | null;
  tier?: string;
  professional?: {
    role?: string;
    company?: string;
  };
  golf?: {
    handicap?: number;
  };
  relationshipState: RelationshipState;
  strengthScore: number;
  roundsCount: number;
  lastInteractionAt?: string | null;
  isSavedByMe: boolean;
  isPending?: boolean;
  isIncoming?: boolean;
  onPress?: () => void;
  onAccept?: () => void;
  onDecline?: () => void;
  onSave?: () => void;
  onUnsave?: () => void;
}

export function ConnectionCard({
  id,
  displayName,
  avatarUrl,
  tier,
  professional,
  golf,
  relationshipState,
  strengthScore,
  roundsCount,
  lastInteractionAt,
  isSavedByMe,
  isPending,
  isIncoming,
  onPress,
  onAccept,
  onDecline,
  onSave,
  onUnsave,
}: ConnectionCardProps) {
  const strengthColor = getStrengthScoreColor(strengthScore);
  const strengthLabel = getStrengthScoreLabel(strengthScore);
  const lastActive = lastInteractionAt ? formatLastActive(lastInteractionAt) : 'Never';
  const relationshipLabel = getRelationshipStateLabel(relationshipState);

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8}>
      <Card>
        <View style={styles.container}>
          {/* Avatar Section */}
          <View style={styles.avatarSection}>
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarInitial}>{displayName.charAt(0).toUpperCase()}</Text>
              </View>
            )}
            
            {/* Save Indicator */}
            {isSavedByMe && (
              <View style={styles.savedBadge}>
                <Text style={styles.savedText}>★</Text>
              </View>
            )}
          </View>

          {/* Info Section */}
          <View style={styles.infoSection}>
            <View style={styles.nameRow}>
              <Text style={styles.name}>{displayName}</Text>
              {tier && (
                <View style={[styles.tierBadge, { backgroundColor: getTierColor(tier) }]}>
                  <Text style={styles.tierText}>{tier}</Text>
                </View>
              )}
            </View>
            
            {professional?.role && (
              <Text style={styles.role}>
                {professional.role}
                {professional.company ? ` at ${professional.company}` : ''}
              </Text>
            )}

            {/* Golf Info */}
            {golf?.handicap !== undefined && (
              <Text style={styles.handicap}>Handicap: {golf.handicap}</Text>
            )}

            {/* Relationship State & Stats */}
            <View style={styles.statsRow}>
              <View style={[styles.stateBadge, getStateBadgeStyle(relationshipState)]}>
                <Text style={styles.stateText}>{relationshipLabel}</Text>
              </View>
              
              {roundsCount > 0 && (
                <Text style={styles.rounds}>{roundsCount} round{roundsCount !== 1 ? 's' : ''}</Text>
              )}
            </View>

            {/* Strength Score */}
            <View style={styles.strengthContainer}>
              <View style={styles.strengthBar}>
                <View 
                  style={[
                    styles.strengthFill, 
                    { width: `${strengthScore}%`, backgroundColor: strengthColor }
                  ]} 
                />
              </View>
              <View style={styles.strengthLabel}>
                <Text style={[styles.strengthText, { color: strengthColor }]}>
                  {strengthLabel} ({strengthScore})
                </Text>
              </View>
            </View>

            {/* Last Active */}
            <Text style={styles.lastActive}>Last active: {lastActive}</Text>
          </View>
        </View>

        {/* Action Buttons */}
        {isPending ? (
          <View style={styles.actionButtons}>
            {isIncoming ? (
              <>
                <TouchableOpacity style={[styles.button, styles.acceptButton]} onPress={onAccept}>
                  <Text style={styles.buttonText}>Accept</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.button, styles.declineButton]} onPress={onDecline}>
                  <Text style={styles.declineText}>Decline</Text>
                </TouchableOpacity>
              </>
            ) : (
              <View style={styles.pendingBadge}>
                <Text style={styles.pendingText}>Pending</Text>
              </View>
            )}
          </View>
        ) : (
          <View style={styles.actionButtons}>
            {isSavedByMe ? (
              <TouchableOpacity style={[styles.button, styles.savedButton]} onPress={onUnsave}>
                <Text style={styles.savedButtonText}>★ Saved</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={[styles.button, styles.saveButton]} onPress={onSave}>
                <Text style={styles.saveButtonText}>☆ Save</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </Card>
    </TouchableOpacity>
  );
}

function getTierColor(tier: string): string {
  switch (tier) {
    case 'summit':
      return '#8b5cf6'; // violet-500
    case 'select':
      return '#3b82f6'; // blue-500
    default:
      return '#22c55e'; // green-500
  }
}

function getStateBadgeStyle(state: RelationshipState) {
  switch (state) {
    case 'regular_partner':
      return { backgroundColor: '#dbeafe' }; // blue-100
    case 'played_together':
      return { backgroundColor: '#dcfce7' }; // green-100
    case 'invited':
      return { backgroundColor: '#fef3c7' }; // amber-100
    default:
      return { backgroundColor: '#f3f4f6' }; // gray-100
  }
}

function formatLastActive(isoDate: string): string {
  const date = new Date(isoDate);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
  return `${Math.floor(diffDays / 365)} years ago`;
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  avatarSection: {
    alignItems: 'center',
    position: 'relative',
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: radius.pill,
  },
  avatarPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: radius.pill,
    backgroundColor: palette.navy600,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    color: palette.white,
    fontSize: 24,
    fontWeight: '700',
  },
  savedBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 20,
    height: 20,
    borderRadius: radius.pill,
    backgroundColor: palette.amber500,
    alignItems: 'center',
    justifyContent: 'center',
  },
  savedText: {
    color: palette.white,
    fontSize: 12,
  },
  infoSection: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  name: {
    fontSize: 16,
    fontWeight: '700',
    color: palette.ink900,
  },
  tierBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  tierText: {
    color: palette.white,
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  role: {
    fontSize: 14,
    color: palette.ink700,
    marginTop: 2,
  },
  handicap: {
    fontSize: 13,
    color: palette.ink600,
    marginTop: 2,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  stateBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  stateText: {
    fontSize: 11,
    fontWeight: '500',
    color: palette.ink700,
  },
  rounds: {
    fontSize: 12,
    color: palette.ink500,
  },
  strengthContainer: {
    marginTop: spacing.sm,
  },
  strengthBar: {
    height: 4,
    backgroundColor: palette.ink200,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  strengthFill: {
    height: '100%',
    borderRadius: radius.pill,
  },
  strengthLabel: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
  },
  strengthText: {
    fontSize: 11,
    fontWeight: '600',
  },
  lastActive: {
    fontSize: 12,
    color: palette.ink500,
    marginTop: spacing.sm,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: palette.ink100,
  },
  button: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
  },
  acceptButton: {
    backgroundColor: palette.navy600,
  },
  declineButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: palette.ink300,
  },
  saveButton: {
    backgroundColor: palette.navy100,
  },
  savedButton: {
    backgroundColor: palette.amber100,
  },
  buttonText: {
    color: palette.white,
    fontSize: 14,
    fontWeight: '600',
  },
  declineText: {
    color: palette.ink600,
    fontSize: 14,
    fontWeight: '600',
  },
  saveButtonText: {
    color: palette.navy700,
    fontSize: 14,
    fontWeight: '600',
  },
  savedButtonText: {
    color: palette.amber700,
    fontSize: 14,
    fontWeight: '600',
  },
  pendingBadge: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: palette.ink200,
    borderRadius: radius.md,
  },
  pendingText: {
    color: palette.ink600,
    fontSize: 14,
    fontWeight: '500',
  },
});
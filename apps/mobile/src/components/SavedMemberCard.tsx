import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SavedMemberTier, getSavedMemberTierLabel } from '@spotter/types';
import { Card } from './Card';
import { TierBadge, TierSlug } from './TierBadge';
import { palette, radius, spacing } from '../theme/design';

interface SavedMemberCardProps {
  id: string;
  displayName: string;
  avatarUrl?: string | null;
  tier?: string;
  savedTier: SavedMemberTier;
  notes?: string | null;
  tags?: string[];
  professional?: {
    role?: string;
    company?: string;
  };
  golf?: {
    handicap?: number;
  };
  createdAt?: string;
  onPress?: () => void;
  onEdit?: () => void;
}

export function SavedMemberCard({
  id,
  displayName,
  avatarUrl,
  tier,
  savedTier,
  notes,
  tags = [],
  professional,
  golf,
  createdAt,
  onPress,
  onEdit,
}: SavedMemberCardProps) {
  const tierColor = getTierColor(savedTier);
  const tierLabel = getSavedMemberTierLabel(savedTier);
  const savedDate = createdAt ? formatSavedDate(createdAt) : null;

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
            {/* Saved Member Tier Badge */}
            <View style={[styles.savedTierBadge, { backgroundColor: tierColor }]}>
              <Text style={styles.savedTierText}>{tierLabel}</Text>
            </View>
            {/* Epic 7: Membership Tier Badge */}
            {tier && (
              <View style={styles.membershipTierBadge}>
                <TierBadge tier={tier as TierSlug} size="sm" />
              </View>
            )}
          </View>

          {/* Info Section */}
          <View style={styles.infoSection}>
            <View style={styles.nameRow}>
              <Text style={styles.name}>{displayName}</Text>
              {tier && (
                <View style={[styles.membershipBadge, { backgroundColor: getMembershipTierColor(tier) }]}>
                  <Text style={styles.membershipText}>{tier}</Text>
                </View>
              )}
            </View>
            
            {professional?.role && (
              <Text style={styles.role}>
                {professional.role}
                {professional.company ? ` at ${professional.company}` : ''}
              </Text>
            )}
            
            {golf?.handicap !== undefined && (
              <Text style={styles.handicap}>Handicap: {golf.handicap}</Text>
            )}

            {/* Tags */}
            {tags.length > 0 && (
              <View style={styles.tagsContainer}>
                {tags.slice(0, 3).map((tag, index) => (
                  <View key={index} style={styles.tag}>
                    <Text style={styles.tagText}>{tag}</Text>
                  </View>
                ))}
                {tags.length > 3 && (
                  <Text style={styles.moreTags}>+{tags.length - 3}</Text>
                )}
              </View>
            )}

            {/* Notes Preview */}
            {notes && (
              <Text style={styles.notes} numberOfLines={2}>
                {notes}
              </Text>
            )}

            {/* Saved Date */}
            {savedDate && (
              <Text style={styles.savedDate}>Saved {savedDate}</Text>
            )}
          </View>

          {/* Edit Button */}
          {onEdit && (
            <TouchableOpacity style={styles.editButton} onPress={onEdit}>
              <Text style={styles.editText}>Edit</Text>
            </TouchableOpacity>
          )}
        </View>
      </Card>
    </TouchableOpacity>
  );
}

function getTierColor(tier: SavedMemberTier): string {
  switch (tier) {
    case 'favorite':
      return '#fbbf24'; // amber-400
    case 'archived':
      return '#9ca3af'; // gray-400
    default:
      return '#3b82f6'; // blue-500
  }
}

function getMembershipTierColor(tier: string): string {
  switch (tier) {
    case 'summit':
      return '#8b5cf6'; // violet-500
    case 'select':
      return '#3b82f6'; // blue-500
    default:
      return '#22c55e'; // green-500
  }
}

function formatSavedDate(isoDate: string): string {
  const date = new Date(isoDate);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) return 'today';
  if (diffDays === 1) return 'yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
  return `${Math.floor(diffDays / 365)} years ago`;
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-start',
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
  tierBadge: {
    position: 'absolute',
    bottom: -4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  tierText: {
    color: palette.white,
    fontSize: 10,
    fontWeight: '600',
  },
  savedTierBadge: {
    position: 'absolute',
    bottom: -4,
    left: 0,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  savedTierText: {
    color: palette.white,
    fontSize: 10,
    fontWeight: '600',
  },
  membershipTierBadge: {
    position: 'absolute',
    bottom: -4,
    right: 0,
  },
  infoSection: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  name: {
    fontSize: 16,
    fontWeight: '700',
    color: palette.ink900,
  },
  membershipBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  membershipText: {
    fontSize: 10,
    fontWeight: '600',
    color: palette.white,
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
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  tag: {
    backgroundColor: palette.navy100,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  tagText: {
    fontSize: 11,
    color: palette.navy700,
    fontWeight: '500',
  },
  moreTags: {
    fontSize: 11,
    color: palette.ink500,
    alignSelf: 'center',
  },
  notes: {
    fontSize: 13,
    color: palette.ink500,
    marginTop: spacing.sm,
    fontStyle: 'italic',
  },
  savedDate: {
    fontSize: 12,
    color: palette.ink400,
    marginTop: spacing.sm,
  },
  editButton: {
    padding: spacing.sm,
  },
  editText: {
    fontSize: 14,
    color: palette.navy600,
    fontWeight: '500',
  },
});
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SavedMemberTier, getSavedMemberTierLabel } from '@spotter/types';
import { Card } from './Card';
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
  onPress,
  onEdit,
}: SavedMemberCardProps) {
  const tierColor = getTierColor(savedTier);
  const tierLabel = getSavedMemberTierLabel(savedTier);

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
            {/* Tier Badge */}
            <View style={[styles.tierBadge, { backgroundColor: tierColor }]}>
              <Text style={styles.tierText}>{tierLabel}</Text>
            </View>
          </View>

          {/* Info Section */}
          <View style={styles.infoSection}>
            <Text style={styles.name}>{displayName}</Text>
            
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
  infoSection: {
    flex: 1,
  },
  name: {
    fontSize: 16,
    fontWeight: '700',
    color: palette.ink900,
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
  editButton: {
    padding: spacing.sm,
  },
  editText: {
    fontSize: 14,
    color: palette.navy600,
    fontWeight: '500',
  },
});
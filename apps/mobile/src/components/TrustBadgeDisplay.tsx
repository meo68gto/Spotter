import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { TrustBadge, TrustBadgeType, TRUST_BADGE_META } from '@spotter/types';
import { palette, radius, spacing } from '../theme/design';

// ============================================================================
// Types
// ============================================================================

interface TrustBadgeDisplayProps {
  badges: TrustBadge[];
  size?: 'sm' | 'md' | 'lg';
  maxDisplay?: number;
  showAll?: boolean;
}

interface TrustBadgeItemProps {
  badge: TrustBadge;
  size: 'sm' | 'md' | 'lg';
}

// ============================================================================
// Helper Functions
// ============================================================================

const getBadgeMeta = (type: TrustBadgeType) => {
  return TRUST_BADGE_META[type] || {
    icon: '🏆',
    displayName: 'Badge',
    color: palette.ink500,
    description: ''
  };
};

// ============================================================================
// Sub-Components
// ============================================================================

const TrustBadgeItem: React.FC<TrustBadgeItemProps> = ({ badge, size }) => {
  const meta = getBadgeMeta(badge.badgeType);
  
  const sizeStyles = {
    sm: {
      container: { paddingHorizontal: spacing.xs, paddingVertical: 4, gap: 4 },
      icon: { fontSize: 12 },
      text: { fontSize: 10 },
    },
    md: {
      container: { paddingHorizontal: spacing.sm, paddingVertical: 6, gap: 6 },
      icon: { fontSize: 14 },
      text: { fontSize: 12 },
    },
    lg: {
      container: { paddingHorizontal: spacing.md, paddingVertical: 8, gap: 8 },
      icon: { fontSize: 16 },
      text: { fontSize: 13 },
    },
  };
  
  const s = sizeStyles[size];

  return (
    <View style={[
      styles.badgeContainer,
      {
        paddingHorizontal: s.container.paddingHorizontal,
        paddingVertical: s.container.paddingVertical,
        gap: s.container.gap,
        backgroundColor: `${meta.color}15`, // 15 = ~8% opacity
        borderColor: meta.color,
      }
    ]}>
      <Text style={[styles.badgeIcon, { fontSize: s.icon.fontSize }]}>{meta.icon}</Text>
      <Text style={[
        styles.badgeText, 
        { 
          fontSize: s.text.fontSize,
          color: meta.color 
        }
      ]}>
        {meta.displayName}
      </Text>
    </View>
  );
};

// ============================================================================
// Main Component
// ============================================================================

export function TrustBadgeDisplay({ 
  badges, 
  size = 'md',
  maxDisplay = 5,
  showAll = false 
}: TrustBadgeDisplayProps) {
  const visibleBadges = showAll ? badges : badges.slice(0, maxDisplay);
  const hiddenCount = badges.length - maxDisplay;

  if (badges.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No trust badges yet</Text>
        <Text style={styles.emptySubtext}>
          Complete rounds and build your reputation to earn badges
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.badgeGrid}>
        {visibleBadges.map((badge) => (
          <TrustBadgeItem key={badge.id} badge={badge} size={size} />
        ))}
        {!showAll && hiddenCount > 0 && (
          <View style={[
            styles.moreBadge,
            size === 'sm' 
              ? { paddingHorizontal: spacing.xs, paddingVertical: 4 }
              : size === 'md' 
              ? { paddingHorizontal: spacing.sm, paddingVertical: 6 }
              : { paddingHorizontal: spacing.md, paddingVertical: 8 }
          ]}>
            <Text style={[
              styles.moreText,
              size === 'sm' ? { fontSize: 10 } : size === 'md' ? { fontSize: 12 } : { fontSize: 13 }
            ]}>
              +{hiddenCount} more
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

// ============================================================================
// Compact Badge List (horizontal scroll)
// ============================================================================

export function TrustBadgeCompact({ badges }: { badges: TrustBadge[] }) {
  if (badges.length === 0) return null;

  return (
    <ScrollView 
      horizontal 
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.compactContainer}
    >
      {badges.map((badge) => {
        const meta = getBadgeMeta(badge.badgeType);
        return (
          <View 
            key={badge.id} 
            style={[
              styles.compactBadge,
              { backgroundColor: `${meta.color}15`, borderColor: meta.color }
            ]}
          >
            <Text style={styles.compactIcon}>{meta.icon}</Text>
          </View>
        );
      })}
    </ScrollView>
  );
}

// ============================================================================
// Styles
// ============================================================================

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
  },
  badgeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  badgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: radius.md,
  },
  badgeIcon: {
    lineHeight: 16,
  },
  badgeText: {
    fontWeight: '600',
  },
  moreBadge: {
    backgroundColor: palette.sky100,
    borderRadius: radius.md,
    justifyContent: 'center',
  },
  moreText: {
    color: palette.ink500,
    fontWeight: '600',
  },
  emptyContainer: {
    padding: spacing.md,
    alignItems: 'center',
    backgroundColor: palette.sky100,
    borderRadius: radius.md,
  },
  emptyText: {
    fontSize: 14,
    fontWeight: '600',
    color: palette.ink700,
  },
  emptySubtext: {
    fontSize: 12,
    color: palette.ink500,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  // Compact styles
  compactContainer: {
    flexDirection: 'row',
    gap: spacing.xs,
    paddingVertical: spacing.xs,
  },
  compactBadge: {
    width: 32,
    height: 32,
    borderRadius: radius.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  compactIcon: {
    fontSize: 16,
    lineHeight: 20,
  },
});

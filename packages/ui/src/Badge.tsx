import React from 'react';
import { StyleSheet, Text, View, type ViewStyle } from 'react-native';
import type { TierSlug } from '@spotter/types';

type BadgeVariant = 'free' | 'select' | 'summit';

interface BadgeProps {
  tier?: TierSlug | BadgeVariant;
  label?: string;
  size?: 'small' | 'medium';
  style?: ViewStyle;
}

const TIER_COLORS: Record<BadgeVariant, { bg: string; text: string; border: string }> = {
  free:     { bg: '#F3F4F6', text: '#6B7280', border: '#D1D5DB' },
  select:   { bg: '#EFF6FF', text: '#1D4ED8', border: '#BFDBFE' },
  summit:   { bg: '#FEF3C7', text: '#92400E', border: '#FCD34D' },
};

const TIER_LABELS: Record<BadgeVariant, string> = {
  free:   'Free',
  select: 'Select',
  summit: 'Summit',
};

/**
 * Tier badge component (free / select / summit).
 * Uses color tokens matching Spotter's tier design system.
 */
export function Badge({ tier, label, size = 'medium', style }: BadgeProps) {
  const variant: BadgeVariant = tier ?? 'free';
  const colors = TIER_COLORS[variant];
  const displayLabel = label ?? TIER_LABELS[variant];
  const isSmall = size === 'small';

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: colors.bg,
          borderColor: colors.border,
          paddingHorizontal: isSmall ? 6 : 10,
          paddingVertical: isSmall ? 2 : 4,
        },
        style,
      ]}
    >
      <Text
        style={[
          styles.label,
          {
            color: colors.text,
            fontSize: isSmall ? 11 : 13,
            fontWeight: isSmall ? '600' : '700',
          },
        ]}
      >
        {displayLabel}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderRadius: 20,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  label: {
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
});

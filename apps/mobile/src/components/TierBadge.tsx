import { StyleSheet, Text, View } from 'react-native';
import { TierSlug } from '@spotter/types';
import { palette, radius, spacing } from '../theme/design';

type TierSize = 'sm' | 'md' | 'lg';

interface TierBadgeProps {
  tier: TierSlug;
  size?: TierSize;
}

const TIER_CONFIG: Record<TierSlug, { label: string; bgColor: string; textColor: string; borderColor: string }> = {
  free: {
    label: 'FREE',
    bgColor: palette.sky100,
    textColor: palette.ink700,
    borderColor: palette.sky300,
  },
  select: {
    label: 'SELECT',
    bgColor: '#FEF3C7', // amber-100
    textColor: '#92400E', // amber-800
    borderColor: '#FCD34D', // amber-300
  },
  summit: {
    label: 'SUMMIT',
    bgColor: '#FEF9C3', // yellow-100
    textColor: '#854D0E', // yellow-900
    borderColor: '#FDE047', // yellow-300
  },
};

const SIZE_CONFIG: Record<TierSize, { padding: number; fontSize: number; borderRadius: number }> = {
  sm: { padding: spacing.xs / 2, fontSize: 10, borderRadius: radius.sm / 2 },
  md: { padding: spacing.xs, fontSize: 12, borderRadius: radius.sm },
  lg: { padding: spacing.sm, fontSize: 14, borderRadius: radius.md },
};

export function TierBadge({ tier, size = 'md' }: TierBadgeProps) {
  const config = TIER_CONFIG[tier];
  const sizeConfig = SIZE_CONFIG[size];

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: config.bgColor,
          borderColor: config.borderColor,
          paddingHorizontal: sizeConfig.padding * 2,
          paddingVertical: sizeConfig.padding,
          borderRadius: sizeConfig.borderRadius,
        },
      ]}
    >
      <Text
        style={[
          styles.text,
          {
            color: config.textColor,
            fontSize: sizeConfig.fontSize,
          },
        ]}
      >
        {config.label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  text: {
    fontWeight: '800',
    letterSpacing: 0.5,
  },
});

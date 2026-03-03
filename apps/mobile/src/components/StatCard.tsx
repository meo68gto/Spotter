import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { palette } from '../theme/tokens/colors';
import { radiusMd, radiusLg } from '../theme/tokens/radius';
import { spaceSm, spaceMd } from '../theme/tokens/spacing';
import { elevation } from '../theme/tokens/elevation';

// ─── Types ────────────────────────────────────────────────────────────────────

export type StatCardVariant = 'default' | 'accent' | 'minimal';
export type StatCardTrend   = 'up' | 'down' | 'neutral';

export interface StatCardProps {
  label:    string;
  value:    string | number;
  /** Delta text, e.g. "+12%" or "-3" */
  delta?:   string;
  trend?:   StatCardTrend;
  icon?:    keyof typeof Ionicons.glyphMap;
  variant?: StatCardVariant;
  /** Compact single-line layout */
  compact?: boolean;
  style?:   ViewStyle;
}

// ─── Trend config ──────────────────────────────────────────────────────────────

const TREND_CONFIG: Record<StatCardTrend, {
  icon:  keyof typeof Ionicons.glyphMap;
  color: string;
}> = {
  up:      { icon: 'trending-up',   color: palette.mint600  },
  down:    { icon: 'trending-down', color: palette.red500   },
  neutral: { icon: 'remove',        color: palette.ink400   },
};

// ─── StatCard Component ─────────────────────────────────────────────────────────

export const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  delta,
  trend    = 'neutral',
  icon,
  variant  = 'default',
  compact  = false,
  style,
}) => {
  const trendCfg = TREND_CONFIG[trend];
  const isAccent = variant === 'accent';

  const bgColor    = isAccent ? palette.navy600 : palette.white;
  const textColor  = isAccent ? palette.white   : palette.ink900;
  const labelColor = isAccent ? 'rgba(255,255,255,0.7)' : palette.ink500;

  if (compact) {
    return (
      <View
        style={[
          styles.compact,
          { backgroundColor: bgColor },
          variant === 'default' && (elevation.sm as ViewStyle),
          style,
        ]}
      >
        {icon && <Ionicons name={icon} size={16} color={isAccent ? palette.mint300 : palette.mint500} />}
        <Text style={[styles.compactValue, { color: textColor }]}>{value}</Text>
        <Text style={[styles.compactLabel, { color: labelColor }]}>{label}</Text>
        {delta && (
          <Text style={[styles.delta, { color: isAccent ? palette.mint300 : trendCfg.color }]}>
            {delta}
          </Text>
        )}
      </View>
    );
  }

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: bgColor },
        variant === 'default' && (elevation.sm as ViewStyle),
        variant === 'minimal' && styles.minimal,
        style,
      ]}
    >
      {/* Top row: icon + trend */}
      <View style={styles.topRow}>
        {icon && (
          <View style={[styles.iconBg, isAccent && styles.iconBgAccent]}>
            <Ionicons name={icon} size={18} color={isAccent ? palette.mint300 : palette.mint500} />
          </View>
        )}
        {(delta ?? trend) && (
          <View style={styles.trendBadge}>
            <Ionicons name={trendCfg.icon} size={12} color={isAccent ? palette.mint300 : trendCfg.color} />
            {delta && (
              <Text style={[styles.delta, { color: isAccent ? palette.mint300 : trendCfg.color }]}>
                {delta}
              </Text>
            )}
          </View>
        )}
      </View>

      {/* Value */}
      <Text style={[styles.value, { color: textColor }]}>{value}</Text>

      {/* Label */}
      <Text style={[styles.label, { color: labelColor }]}>{label}</Text>
    </View>
  );
};

export default StatCard;

const styles = StyleSheet.create({
  card: {
    borderRadius: radiusLg,
    padding: spaceMd,
    gap: spaceSm - 2,
  },
  minimal: {
    borderWidth: 1,
    borderColor: palette.ink200,
  },
  compact: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radiusMd,
    paddingHorizontal: spaceMd,
    paddingVertical: spaceSm,
    gap: spaceSm,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spaceSm,
  },
  iconBg: {
    width: 36,
    height: 36,
    borderRadius: radiusMd,
    backgroundColor: palette.mint50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBgAccent: {
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  trendBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  value: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  label: {
    fontSize: 12,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  delta: {
    fontSize: 12,
    fontWeight: '700',
  },
  compactValue: {
    fontSize: 18,
    fontWeight: '800',
  },
  compactLabel: {
    flex: 1,
    fontSize: 13,
  },
});

import React, { type ReactNode } from 'react';
import { View, Text, StyleSheet, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { palette } from '../theme/tokens/colors';
import { spaceMd, spaceLg, spaceXl } from '../theme/tokens/spacing';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface EmptyStateProps {
  /** Ionicons icon name */
  icon?:     keyof typeof Ionicons.glyphMap;
  title:     string;
  subtitle?: string;
  /** Optional CTA rendered below the text */
  action?:   ReactNode;
  style?:    ViewStyle;
}

// ─── EmptyState Component ───────────────────────────────────────────────────

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  subtitle,
  action,
  style,
}) => (
  <View style={[styles.container, style]}>
    {icon && (
      <View style={styles.iconWrapper}>
        <Ionicons name={icon} size={48} color={palette.ink300} />
      </View>
    )}
    <Text style={styles.title}>{title}</Text>
    {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
    {action && <View style={styles.action}>{action}</View>}
  </View>
);

export default EmptyState;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spaceXl,
    paddingVertical: spaceXl * 2,
    gap: spaceMd,
  },
  iconWrapper: {
    marginBottom: spaceMd,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: palette.ink700,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: palette.ink500,
    textAlign: 'center',
    lineHeight: 20,
    marginTop: -spaceMd / 2,
  },
  action: {
    marginTop: spaceLg,
  },
});

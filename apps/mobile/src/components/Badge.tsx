import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { palette } from '../theme/tokens/colors';
import { radiusFull } from '../theme/tokens/radius';
import { spaceXs, spaceSm } from '../theme/tokens/spacing';

// ─── Types ────────────────────────────────────────────────────────────────────

export type BadgeVariant =
  | 'default'
  | 'primary'
  | 'success'
  | 'warning'
  | 'error'
  | 'info'
  | 'outline';

export type BadgeSize = 'sm' | 'md' | 'lg';

export interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
  size?: BadgeSize;
  /** Render as a dot (no text) — useful for notification indicators */
  dot?: boolean;
  style?: ViewStyle;
}

// ─── Variant config ───────────────────────────────────────────────────────────

const VARIANT_STYLES: Record<BadgeVariant, { bg: string; text: string; border?: string }> = {
  default: { bg: palette.ink200,   text: palette.ink700 },
  primary: { bg: palette.navy600,  text: palette.white  },
  success: { bg: palette.green50,  text: palette.green600 },
  warning: { bg: palette.amber50,  text: palette.amber600 },
  error:   { bg: palette.red50,    text: palette.red600 },
  info:    { bg: palette.sky100,   text: palette.sky500 },
  outline: { bg: 'transparent',    text: palette.ink700, border: palette.ink300 },
};

const SIZE_STYLES: Record<BadgeSize, { fontSize: number; paddingH: number; paddingV: number; minW: number }> = {
  sm: { fontSize: 9,  paddingH: 4,  paddingV: 1, minW: 14 },
  md: { fontSize: 11, paddingH: 6,  paddingV: 2, minW: 18 },
  lg: { fontSize: 13, paddingH: 8,  paddingV: 3, minW: 22 },
};

// ─── Badge Component ───────────────────────────────────────────────────────────

export const Badge: React.FC<BadgeProps> = ({
  label,
  variant = 'default',
  size = 'md',
  dot = false,
  style,
}) => {
  const variantStyle = VARIANT_STYLES[variant];
  const sizeStyle    = SIZE_STYLES[size];

  if (dot) {
    return (
      <View
        style={[
          styles.dot,
          { backgroundColor: variantStyle.bg },
          style,
        ]}
      />
    );
  }

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: variantStyle.bg,
          paddingHorizontal: sizeStyle.paddingH,
          paddingVertical:   sizeStyle.paddingV,
          minWidth:          sizeStyle.minW,
          borderWidth: variantStyle.border ? 1 : 0,
          borderColor: variantStyle.border ?? 'transparent',
        },
        style,
      ]}
    >
      <Text
        style={[
          styles.label,
          {
            fontSize:   sizeStyle.fontSize,
            color:      variantStyle.text,
          },
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </View>
  );
};

export default Badge;

const styles = StyleSheet.create({
  container: {
    borderRadius: radiusFull,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  label: {
    fontWeight: '600',
    textAlign: 'center',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: radiusFull,
  },
});

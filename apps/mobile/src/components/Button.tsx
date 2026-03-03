import React, { useRef, useCallback } from 'react';
import {
  Pressable,
  Text,
  View,
  StyleSheet,
  Animated,
  ActivityIndicator,
  type ViewStyle,
  type TextStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { palette } from '../theme/tokens/colors';
import { radiusMd, radiusFull } from '../theme/tokens/radius';
import { spaceXs, spaceSm, spaceMd, spaceLg } from '../theme/tokens/spacing';
import { durationFast, easingOut } from '../theme/tokens/motion';

// ─── Types ────────────────────────────────────────────────────────────────────

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive';
export type ButtonSize    = 'sm' | 'md' | 'lg';

export interface ButtonProps {
  title: string;
  onPress?: () => void;
  variant?:  ButtonVariant;
  size?:     ButtonSize;
  disabled?: boolean;
  loading?:  boolean;
  /** Icon shown to the left of the label */
  iconLeft?:  keyof typeof Ionicons.glyphMap;
  /** Icon shown to the right of the label */
  iconRight?: keyof typeof Ionicons.glyphMap;
  /** Fill full available width */
  fullWidth?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

// ─── Variant configs ───────────────────────────────────────────────────────────

const VARIANT_MAP: Record<ButtonVariant, {
  bg:       string;
  border:   string;
  text:     string;
  bgPress:  string;
}> = {
  primary:     { bg: palette.mint500,  border: palette.mint500,  text: palette.white,    bgPress: palette.mint600 },
  secondary:   { bg: palette.navy600,  border: palette.navy600,  text: palette.white,    bgPress: palette.navy700 },
  outline:     { bg: 'transparent',    border: palette.ink300,   text: palette.ink800,   bgPress: palette.ink100 },
  ghost:       { bg: 'transparent',    border: 'transparent',    text: palette.mint600,  bgPress: palette.mint50 },
  destructive: { bg: palette.red500,   border: palette.red500,   text: palette.white,    bgPress: palette.red600 },
};

const SIZE_MAP: Record<ButtonSize, {
  paddingH: number;
  paddingV: number;
  fontSize: number;
  iconSize: number;
  radius:   number;
}> = {
  sm: { paddingH: spaceMd,  paddingV: spaceXs,  fontSize: 13, iconSize: 14, radius: radiusMd },
  md: { paddingH: spaceLg,  paddingV: spaceSm,  fontSize: 15, iconSize: 16, radius: radiusMd },
  lg: { paddingH: spaceLg * 1.5, paddingV: spaceMd,  fontSize: 17, iconSize: 18, radius: radiusMd },
};

// ─── Button Component ────────────────────────────────────────────────────────────

export const Button: React.FC<ButtonProps> = ({
  title,
  onPress,
  variant   = 'primary',
  size      = 'md',
  disabled  = false,
  loading   = false,
  iconLeft,
  iconRight,
  fullWidth = false,
  style,
  textStyle,
}) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const vc = VARIANT_MAP[variant];
  const sc = SIZE_MAP[size];
  const isDisabled = disabled || loading;

  const handlePressIn = useCallback(() => {
    if (isDisabled) return;
    Animated.timing(scaleAnim, {
      toValue: 0.97,
      duration: durationFast,
      easing: easingOut,
      useNativeDriver: true,
    }).start();
  }, [isDisabled, scaleAnim]);

  const handlePressOut = useCallback(() => {
    Animated.timing(scaleAnim, {
      toValue: 1,
      duration: durationFast,
      easing: easingOut,
      useNativeDriver: true,
    }).start();
  }, [scaleAnim]);

  return (
    <Animated.View style={[{ transform: [{ scale: scaleAnim }] }, fullWidth && styles.fullWidth]}>
      <Pressable
        onPress={isDisabled ? undefined : onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={({ pressed }) => [
          styles.base,
          {
            backgroundColor: pressed ? vc.bgPress : vc.bg,
            borderColor:     vc.border,
            borderRadius:    sc.radius,
            paddingHorizontal: sc.paddingH,
            paddingVertical:   sc.paddingV,
          },
          fullWidth && styles.fullWidth,
          isDisabled && styles.disabled,
          style,
        ]}
      >
        {loading ? (
          <ActivityIndicator size="small" color={vc.text} />
        ) : (
          <View style={styles.inner}>
            {iconLeft && (
              <Ionicons name={iconLeft} size={sc.iconSize} color={vc.text} style={styles.iconLeft} />
            )}
            <Text
              style={[
                styles.label,
                { fontSize: sc.fontSize, color: vc.text },
                textStyle,
              ]}
              numberOfLines={1}
            >
              {title}
            </Text>
            {iconRight && (
              <Ionicons name={iconRight} size={sc.iconSize} color={vc.text} style={styles.iconRight} />
            )}
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
};

export default Button;

const styles = StyleSheet.create({
  base: {
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullWidth: {
    width: '100%',
  },
  disabled: {
    opacity: 0.45,
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  label: {
    fontWeight: '600',
    textAlign: 'center',
  },
  iconLeft: {
    marginRight: spaceXs,
  },
  iconRight: {
    marginLeft: spaceXs,
  },
});

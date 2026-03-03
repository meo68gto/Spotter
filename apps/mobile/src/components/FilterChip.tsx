import React, { useRef, useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Animated,
  ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { palette } from '../theme/tokens/colors';
import { typography } from '../theme/tokens/typography';
import { spaceXs, spaceSm, spaceMd } from '../theme/tokens/spacing';
import { radiusFull } from '../theme/tokens/radius';
import { durationFast, easeOut } from '../theme/tokens/motion';

// ─── Types ────────────────────────────────────────────────────────────────────

export type FilterChipVariant = 'default' | 'accent';

export interface FilterChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
  variant?: FilterChipVariant;
  disabled?: boolean;
  style?: ViewStyle;
}

// ─── FilterChip Component ─────────────────────────────────────────────────────

export const FilterChip: React.FC<FilterChipProps> = ({
  label,
  selected = false,
  onPress,
  icon,
  variant = 'default',
  disabled = false,
  style,
}) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = useCallback(() => {
    if (disabled) return;
    Animated.timing(scaleAnim, {
      toValue: 0.95,
      duration: durationFast,
      easing: easeOut,
      useNativeDriver: true,
    }).start();
  }, [disabled, scaleAnim]);

  const handlePressOut = useCallback(() => {
    Animated.timing(scaleAnim, {
      toValue: 1,
      duration: durationFast,
      easing: easeOut,
      useNativeDriver: true,
    }).start();
  }, [scaleAnim]);

  const isAccent = variant === 'accent';

  const bgColor = selected
    ? isAccent ? palette.mint500 : palette.navy600
    : palette.white;

  const borderColor = selected
    ? isAccent ? palette.mint500 : palette.navy600
    : palette.ink200;

  const textColor = selected ? palette.white : palette.ink700;
  const iconColor = selected ? palette.white : palette.ink500;

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <Pressable
        onPress={disabled ? undefined : onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={[
          styles.chip,
          { backgroundColor: bgColor, borderColor },
          disabled && styles.disabled,
          style,
        ]}
      >
        {icon && (
          <Ionicons
            name={icon}
            size={14}
            color={iconColor}
            style={styles.icon}
          />
        )}
        <Text style={[styles.label, { color: textColor }]}>{label}</Text>
        {selected && (
          <Ionicons
            name="checkmark"
            size={12}
            color={palette.white}
            style={styles.check}
          />
        )}
      </Pressable>
    </Animated.View>
  );
};

export default FilterChip;

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: radiusFull,
    paddingHorizontal: spaceMd,
    paddingVertical: spaceXs + 2,
    gap: spaceXs,
    alignSelf: 'flex-start',
  },
  label: {
    fontSize: 13,
    fontWeight: '500',
  },
  icon: {
    marginRight: -2,
  },
  check: {
    marginLeft: -2,
  },
  disabled: {
    opacity: 0.45,
  },
});

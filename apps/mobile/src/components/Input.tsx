import React, { useRef, useCallback, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  Animated,
  type ViewStyle,
  type TextInputProps,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { palette } from '../theme/tokens/colors';
import { radiusMd } from '../theme/tokens/radius';
import { spaceXs, spaceSm, spaceMd } from '../theme/tokens/spacing';
import { durationFast, easingOut } from '../theme/tokens/motion';

// ─── Types ────────────────────────────────────────────────────────────────────

export type InputVariant = 'default' | 'filled' | 'underline';
export type InputSize    = 'sm' | 'md' | 'lg';

export interface InputProps extends Omit<TextInputProps, 'style'> {
  label?:        string;
  hint?:         string;
  error?:        string;
  variant?:      InputVariant;
  size?:         InputSize;
  iconLeft?:     keyof typeof Ionicons.glyphMap;
  iconRight?:    keyof typeof Ionicons.glyphMap;
  onIconRightPress?: () => void;
  /** Show clear button when there is text */
  clearable?:    boolean;
  style?:        ViewStyle;
}

// ─── Size config ──────────────────────────────────────────────────────────────

const SIZE_MAP: Record<InputSize, { height: number; fontSize: number; paddingH: number }> = {
  sm: { height: 36, fontSize: 13, paddingH: spaceSm },
  md: { height: 44, fontSize: 15, paddingH: spaceMd },
  lg: { height: 52, fontSize: 16, paddingH: spaceMd },
};

// ─── Input Component ───────────────────────────────────────────────────────────

export const Input: React.FC<InputProps> = ({
  label,
  hint,
  error,
  variant   = 'default',
  size      = 'md',
  iconLeft,
  iconRight,
  onIconRightPress,
  clearable = false,
  value,
  onChangeText,
  style,
  ...rest
}) => {
  const [focused, setFocused] = useState(false);
  const borderAnim = useRef(new Animated.Value(0)).current;

  const handleFocus = useCallback(() => {
    setFocused(true);
    Animated.timing(borderAnim, {
      toValue: 1,
      duration: durationFast,
      easing: easingOut,
      useNativeDriver: false,
    }).start();
    rest.onFocus?.({} as any);
  }, [borderAnim, rest.onFocus]);

  const handleBlur = useCallback(() => {
    setFocused(false);
    Animated.timing(borderAnim, {
      toValue: 0,
      duration: durationFast,
      easing: easingOut,
      useNativeDriver: false,
    }).start();
    rest.onBlur?.({} as any);
  }, [borderAnim, rest.onBlur]);

  const borderColor = borderAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [
      error ? palette.red500 : palette.ink200,
      error ? palette.red500 : palette.mint500,
    ],
  });

  const sc = SIZE_MAP[size];

  const containerStyle = [
    styles.inputContainer,
    { height: sc.height, paddingHorizontal: sc.paddingH },
    variant === 'filled' && styles.filled,
    variant === 'underline' && styles.underline,
    variant === 'default' && { borderRadius: radiusMd },
  ];

  const showClear = clearable && value && value.length > 0;
  const showRightIcon = iconRight && !showClear;

  return (
    <View style={[styles.wrapper, style]}>
      {label && <Text style={styles.label}>{label}</Text>}

      <Animated.View
        style={[
          ...containerStyle,
          variant !== 'underline' && { borderColor },
          variant === 'underline' && { borderBottomColor: borderColor },
        ]}
      >
        {iconLeft && (
          <Ionicons name={iconLeft} size={18} color={focused ? palette.mint500 : palette.ink400} style={styles.iconLeft} />
        )}

        <TextInput
          value={value}
          onChangeText={onChangeText}
          onFocus={handleFocus}
          onBlur={handleBlur}
          style={[
            styles.input,
            { fontSize: sc.fontSize },
            iconLeft  && styles.inputWithIconLeft,
            (showRightIcon || showClear) && styles.inputWithIconRight,
          ]}
          placeholderTextColor={palette.ink300}
          {...rest}
        />

        {showClear && (
          <Pressable onPress={() => onChangeText?.('')} hitSlop={4}>
            <Ionicons name="close-circle" size={18} color={palette.ink400} />
          </Pressable>
        )}

        {showRightIcon && (
          <Pressable onPress={onIconRightPress} hitSlop={4}>
            <Ionicons name={iconRight!} size={18} color={focused ? palette.mint500 : palette.ink400} />
          </Pressable>
        )}
      </Animated.View>

      {(error || hint) && (
        <Text style={[styles.helper, error ? styles.errorText : styles.hintText]}>
          {error ?? hint}
        </Text>
      )}
    </View>
  );
};

export default Input;

const styles = StyleSheet.create({
  wrapper: {
    gap: spaceXs,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: palette.ink700,
    marginBottom: 2,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    backgroundColor: palette.white,
  },
  filled: {
    backgroundColor: palette.gray100,
    borderRadius: radiusMd,
    borderColor: 'transparent',
  },
  underline: {
    borderWidth: 0,
    borderBottomWidth: 1.5,
    borderRadius: 0,
    backgroundColor: 'transparent',
    paddingHorizontal: 0,
  },
  input: {
    flex: 1,
    color: palette.ink900,
    padding: 0,
  },
  inputWithIconLeft: {
    marginLeft: spaceSm,
  },
  inputWithIconRight: {
    marginRight: spaceSm,
  },
  iconLeft: {
    marginRight: spaceSm,
  },
  helper: {
    fontSize: 12,
    marginTop: 2,
  },
  hintText: {
    color: palette.ink400,
  },
  errorText: {
    color: palette.red500,
  },
});

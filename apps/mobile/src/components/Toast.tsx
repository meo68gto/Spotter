import React, { useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Animated,
  type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { palette } from '../theme/tokens/colors';
import { radiusMd, radiusLg } from '../theme/tokens/radius';
import { spaceXs, spaceSm, spaceMd } from '../theme/tokens/spacing';
import { elevation } from '../theme/tokens/elevation';
import { durationNormal, durationFast, easingOut } from '../theme/tokens/motion';

// ─── Types ────────────────────────────────────────────────────────────────────

export type ToastVariant = 'default' | 'success' | 'error' | 'warning' | 'info';
export type ToastPosition = 'top' | 'bottom';

export interface ToastProps {
  visible:      boolean;
  message:      string;
  variant?:     ToastVariant;
  position?:    ToastPosition;
  /** Auto-dismiss after N ms (default: 3000). Set to 0 to disable auto-dismiss */
  duration?:    number;
  onDismiss?:   () => void;
  /** Optional action button */
  action?:      { label: string; onPress: () => void };
  style?:       ViewStyle;
}

// ─── Variant config ───────────────────────────────────────────────────────────

const VARIANT_CONFIG: Record<ToastVariant, {
  bg:        string;
  text:      string;
  icon:      keyof typeof Ionicons.glyphMap;
  iconColor: string;
}> = {
  default: {
    bg:        palette.ink800,
    text:      palette.white,
    icon:      'information-circle-outline',
    iconColor: palette.ink300,
  },
  success: {
    bg:        palette.green500,
    text:      palette.white,
    icon:      'checkmark-circle-outline',
    iconColor: 'rgba(255,255,255,0.9)',
  },
  error: {
    bg:        palette.red500,
    text:      palette.white,
    icon:      'alert-circle-outline',
    iconColor: 'rgba(255,255,255,0.9)',
  },
  warning: {
    bg:        palette.amber500,
    text:      palette.white,
    icon:      'warning-outline',
    iconColor: 'rgba(255,255,255,0.9)',
  },
  info: {
    bg:        palette.sky400,
    text:      palette.white,
    icon:      'information-circle-outline',
    iconColor: 'rgba(255,255,255,0.9)',
  },
};

// ─── Toast Component ───────────────────────────────────────────────────────────

export const Toast: React.FC<ToastProps> = ({
  visible,
  message,
  variant   = 'default',
  position  = 'bottom',
  duration  = 3000,
  onDismiss,
  action,
  style,
}) => {
  const insets      = useSafeAreaInsets();
  const slideAnim   = useRef(new Animated.Value(100)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const timerRef    = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cfg = VARIANT_CONFIG[variant];

  const dismiss = useCallback(() => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue:  position === 'bottom' ? 100 : -100,
        duration: durationFast,
        easing:   easingOut,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 0,
        duration: durationFast,
        useNativeDriver: true,
      }),
    ]).start(() => onDismiss?.());
  }, [slideAnim, opacityAnim, position, onDismiss]);

  useEffect(() => {
    if (visible) {
      slideAnim.setValue(position === 'bottom' ? 100 : -100);
      opacityAnim.setValue(0);

      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: durationNormal,
          easing: easingOut,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: durationNormal,
          useNativeDriver: true,
        }),
      ]).start();

      if (duration > 0) {
        timerRef.current = setTimeout(dismiss, duration);
      }
    } else {
      if (timerRef.current) clearTimeout(timerRef.current);
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [visible, duration, dismiss, position]);

  if (!visible) return null;

  const safeOffset = position === 'bottom'
    ? insets.bottom + 16
    : insets.top + 16;

  return (
    <Animated.View
      style={[
        styles.container,
        position === 'bottom' ? { bottom: safeOffset } : { top: safeOffset },
        { transform: [{ translateY: slideAnim }], opacity: opacityAnim },
        (elevation.lg as ViewStyle),
        style,
      ]}
      pointerEvents="box-none"
    >
      <View style={[styles.toast, { backgroundColor: cfg.bg }]}>
        <Ionicons name={cfg.icon} size={20} color={cfg.iconColor} />

        <Text style={[styles.message, { color: cfg.text }]} numberOfLines={2}>
          {message}
        </Text>

        {action && (
          <Pressable onPress={() => { action.onPress(); dismiss(); }} style={styles.actionBtn}>
            <Text style={[styles.actionText, { color: cfg.text }]}>{action.label}</Text>
          </Pressable>
        )}

        {onDismiss && (
          <Pressable onPress={dismiss} hitSlop={8}>
            <Ionicons name="close" size={16} color={cfg.iconColor} />
          </Pressable>
        )}
      </View>
    </Animated.View>
  );
};

export default Toast;

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: spaceMd,
    right: spaceMd,
    zIndex: 9999,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radiusLg,
    paddingHorizontal: spaceMd,
    paddingVertical: spaceSm + 2,
    gap: spaceSm,
    minHeight: 48,
  },
  message: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 20,
  },
  actionBtn: {
    paddingHorizontal: spaceSm,
    paddingVertical: spaceXs,
    borderRadius: radiusMd,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  actionText: {
    fontSize: 13,
    fontWeight: '700',
  },
});

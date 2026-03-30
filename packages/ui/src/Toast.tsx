import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

export type ToastType = 'success' | 'error' | 'info';

export type ToastPayload = {
  type?: ToastType;
  title: string;
  message?: string;
  durationMs?: number;
};

type ToastState = (ToastPayload & { id: string }) | null;

// ---------------------------------------------------------------------------
// Design tokens — mirrors Spotter mobile theme defaults
// ---------------------------------------------------------------------------
const DEFAULT_TOKENS = {
  primary:    '#2563EB',
  success:    '#16A34A',
  danger:     '#DC2626',
  surfaceElevated: '#FFFFFF',
  border:     '#E5E7EB',
  text:       '#111827',
  textSecondary: '#6B7280',
};

let dispatcher: ((payload: ToastPayload) => void) | null = null;

/**
 * Global toast dispatcher. Call this from anywhere in the app.
 *
 * @example
 * import { showToast } from '@spotter/ui';
 * showToast({ type: 'success', title: 'Saved!', message: 'Your changes were saved.' });
 */
export const showToast = (payload: ToastPayload) => {
  dispatcher?.(payload);
};

interface ToastProps {
  /** Override theme tokens (defaults work for Spotter mobile/web). */
  tokens?: typeof DEFAULT_TOKENS;
}

export function Toast({ tokens = DEFAULT_TOKENS }: ToastProps) {
  const [toast, setToast] = useState<ToastState>(null);
  const translateY = useSharedValue(-140);
  const opacity = useSharedValue(0);

  useEffect(() => {
    dispatcher = (payload: ToastPayload) => {
      setToast({ ...payload, id: `${Date.now()}-${Math.random().toString(16).slice(2)}` });
    };
    return () => { dispatcher = null; };
  }, []);

  const hideToast = () => {
    translateY.value = withTiming(-140, { duration: 200, easing: Easing.out(Easing.quad) });
    opacity.value = withTiming(0, { duration: 180 });
    setTimeout(() => setToast(null), 220);
  };

  useEffect(() => {
    if (!toast) return;
    translateY.value = -140;
    opacity.value = 0;
    translateY.value = withTiming(0, { duration: 250, easing: Easing.out(Easing.cubic) });
    opacity.value = withTiming(1, { duration: 220 });
    const timeout = setTimeout(hideToast, toast.durationMs ?? 2400);
    return () => clearTimeout(timeout);
  }, [toast]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  const accent = useMemo(() => {
    if (!toast || toast.type === 'info') return tokens.primary;
    if (toast.type === 'success') return tokens.success;
    return tokens.danger;
  }, [toast, tokens]);

  if (!toast) return null;

  return (
    <View style={styles.wrapper} pointerEvents="none">
      <Animated.View style={[styles.toastWrap, animatedStyle]}>
        <View style={[styles.toast, { backgroundColor: tokens.surfaceElevated, borderColor: tokens.border }]}>
          <View style={[styles.accent, { backgroundColor: accent }]} />
          <View style={styles.copy}>
            <Text style={[styles.title, { color: tokens.text }]}>{toast.title}</Text>
            {toast.message
              ? <Text style={[styles.message, { color: tokens.textSecondary }]}>{toast.message}</Text>
              : null}
          </View>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper:  { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
  toastWrap: { position: 'absolute', left: 16, right: 16, top: 10 },
  toast: {
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
  },
  accent: { width: 4 },
  copy:  { flex: 1, paddingVertical: 14, paddingHorizontal: 14 },
  title: { fontSize: 15, fontWeight: '600' },
  message: { fontSize: 13, marginTop: 2 },
});

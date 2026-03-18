import { ReactNode, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useTheme } from '../theme/provider';

export type ToastType = 'success' | 'error' | 'info';

export type ToastPayload = {
  type?: ToastType;
  title: string;
  message?: string;
  durationMs?: number;
};

type ToastState = (ToastPayload & { id: string }) | null;

let dispatcher: ((payload: ToastPayload) => void) | null = null;

export const showToast = (payload: ToastPayload) => {
  dispatcher?.(payload);
};

export function ToastHost({ children }: { children: ReactNode }) {
  const { tokens } = useTheme();
  const [toast, setToast] = useState<ToastState>(null);
  const translateY = useSharedValue(-140);
  const opacity = useSharedValue(0);

  useEffect(() => {
    dispatcher = (payload: ToastPayload) => {
      setToast({ ...payload, id: `${Date.now()}-${Math.random().toString(16).slice(2)}` });
    };
    return () => {
      dispatcher = null;
    };
  }, []);

  const hideToast = () => {
    translateY.value = withTiming(-140, { duration: 200, easing: Easing.out(Easing.quad) }, (finished) => {
      if (finished) runOnJS(setToast)(null);
    });
    opacity.value = withTiming(0, { duration: 180 });
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
    opacity: opacity.value
  }));

  const accent = useMemo(() => {
    if (!toast || toast.type === 'info') return tokens.primary;
    if (toast.type === 'success') return tokens.success;
    return tokens.danger;
  }, [tokens, toast]);

  return (
    <View style={styles.root} pointerEvents="box-none">
      {children}
      {toast ? (
        // @ts-expect-error TypeScript 5.7+ compatibility with react-native-reanimated
        <Animated.View style={[styles.toastWrap, animatedStyle]} pointerEvents="none">
          <View style={[styles.toast, { backgroundColor: tokens.surfaceElevated, borderColor: tokens.border }]}> 
            <View style={[styles.accent, { backgroundColor: accent }]} />
            <View style={styles.copy}>
              <Text style={[styles.title, { color: tokens.text }]}>{toast.title}</Text>
              {toast.message ? <Text style={[styles.message, { color: tokens.textSecondary }]}>{toast.message}</Text> : null}
            </View>
          </View>
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1
  },
  toastWrap: {
    position: 'absolute',
    left: 16,
    right: 16,
    top: 10
  },
  toast: {
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 16,
    elevation: 6
  },
  accent: {
    width: 6
  },
  copy: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  title: {
    fontSize: 14,
    fontWeight: '800'
  },
  message: {
    marginTop: 2,
    fontSize: 13
  }
});

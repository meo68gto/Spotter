import { StyleProp, StyleSheet, ViewStyle } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { useEffect } from 'react';
import { useTheme } from '../theme/provider';

export function Skeleton({ style }: { style?: StyleProp<ViewStyle> }) {
  const { tokens } = useTheme();
  const shimmer = useSharedValue(-1);

  useEffect(() => {
    shimmer.value = withRepeat(withTiming(1, { duration: 1100, easing: Easing.linear }), -1, false);
  }, [shimmer]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shimmer.value * 220 }]
  }));

  return (
    // @ts-expect-error TypeScript 5.7+ compatibility with react-native-reanimated
    <Animated.View style={[styles.base, style, { backgroundColor: tokens.backgroundMuted }]}>
      {/* @ts-expect-error TypeScript 5.7+ compatibility with react-native-reanimated */}
      <Animated.View style={[styles.shimmer, animatedStyle, { backgroundColor: tokens.surfaceElevated }]} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  base: {
    overflow: 'hidden',
    borderRadius: 10
  },
  shimmer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 120,
    opacity: 0.35
  }
});

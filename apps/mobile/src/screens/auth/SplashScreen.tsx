import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useTheme } from '../../theme/provider';

export function SplashScreen({ subtitle = 'Finding your session...' }: { subtitle?: string }) {
  const { tokens } = useTheme();
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.93);

  useEffect(() => {
    opacity.value = withTiming(1, { duration: 360, easing: Easing.out(Easing.cubic) });
    scale.value = withTiming(1, { duration: 360, easing: Easing.out(Easing.cubic) });
  }, [opacity, scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }]
  }));

  return (
    <View style={[styles.container, { backgroundColor: tokens.background }]}>
      {/* @ts-expect-error TypeScript 5.7+ compatibility with react-native-reanimated */}
      <Animated.View style={[styles.lockup, animatedStyle, { backgroundColor: tokens.surface, borderColor: tokens.border }]}>
        <Text style={[styles.wordmark, { color: tokens.text }]}>SPOTTER</Text>
        <Text style={[styles.subtitle, { color: tokens.textSecondary }]}>{subtitle}</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24
  },
  lockup: {
    minWidth: 220,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 28,
    paddingVertical: 22,
    alignItems: 'center'
  },
  wordmark: {
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: 3
  },
  subtitle: {
    marginTop: 8,
    fontSize: 14
  }
});

/**
 * Spotter Design System — Motion / Animation Tokens
 *
 * Provides duration, easing, and spring preset values for
 * React Native Animated and Reanimated animations.
 *
 * Usage:
 *
 *   import { durationFast, easeOut } from '../theme/tokens/motion';
 *
 *   Animated.timing(value, {
 *     duration: durationFast,
 *     easing: easeOut,
 *     useNativeDriver: true,
 *   }).start();
 *
 *   // Or with Reanimated:
 *   withTiming(value, { duration: durationNormal, easing: Easing.bezier(...easeInOut) })
 */

import { Easing } from 'react-native';

// ---------------------------------------------------------------------------
// Duration (milliseconds)
// ---------------------------------------------------------------------------

/** 100ms — micro interactions (press feedback, icon swap) */
export const durationInstant = 100;

/** 150ms — fast transitions (tooltip appear, badge pop) */
export const durationFast = 150;

/** 250ms — standard transitions (screen slide, modal open) */
export const durationNormal = 250;

/** 400ms — slow transitions (page fade, onboarding step) */
export const durationSlow = 400;

/** 600ms — extra slow (splash, brand animation) */
export const durationXSlow = 600;

export const duration = {
  instant: durationInstant,
  fast:    durationFast,
  normal:  durationNormal,
  slow:    durationSlow,
  xslow:   durationXSlow,
} as const;

// ---------------------------------------------------------------------------
// Easing functions (React Native Easing API)
// ---------------------------------------------------------------------------

/**
 * Ease-in: starts slow, ends fast.
 * Use for elements exiting the screen.
 */
export const easingIn = Easing.bezier(0.4, 0.0, 1.0, 1.0);

/**
 * Ease-out: starts fast, ends slow.
 * Use for elements entering the screen.
 */
export const easingOut = Easing.bezier(0.0, 0.0, 0.2, 1.0);

/**
 * Ease-in-out: starts slow, middle fast, ends slow.
 * Use for elements moving across the screen.
 */
export const easingInOut = Easing.bezier(0.4, 0.0, 0.2, 1.0);

/**
 * Linear: constant speed.
 * Use for looping animations (spinners, progress bars).
 */
export const easingLinear = Easing.linear;

export const easing = {
  in:     easingIn,
  out:    easingOut,
  inOut:  easingInOut,
  linear: easingLinear,
} as const;

// ---------------------------------------------------------------------------
// Reanimated-compatible easing (cubic bezier arrays)
// ---------------------------------------------------------------------------

/**
 * Raw cubic bezier values for use with Reanimated's Easing.bezier():
 *
 *   import { Easing } from 'react-native-reanimated';
 *   import { easeOutCubic } from '../theme/tokens/motion';
 *   withTiming(val, { easing: Easing.bezier(...easeOutCubic) });
 */
export const easeInCubic:    [number, number, number, number] = [0.4, 0.0, 1.0, 1.0];
export const easeOutCubic:   [number, number, number, number] = [0.0, 0.0, 0.2, 1.0];
export const easeInOutCubic: [number, number, number, number] = [0.4, 0.0, 0.2, 1.0];

// ---------------------------------------------------------------------------
// Spring presets (for Reanimated withSpring)
// ---------------------------------------------------------------------------

export const springSnappy = {
  damping: 18,
  stiffness: 200,
  mass: 1,
  overshootClamping: false,
} as const;

export const springBouncy = {
  damping: 12,
  stiffness: 180,
  mass: 1,
  overshootClamping: false,
} as const;

export const springSmooth = {
  damping: 25,
  stiffness: 150,
  mass: 1,
  overshootClamping: true,
} as const;

// ---------------------------------------------------------------------------
// Composite motion object (for import as single namespace)
// ---------------------------------------------------------------------------

export const motion = {
  duration,
  easing,
  spring: {
    snappy: springSnappy,
    bouncy: springBouncy,
    smooth: springSmooth,
  },
} as const;

/**
 * Spotter Design System — Elevation / Shadow Tokens
 *
 * React Native shadow props differ from web box-shadow.
 * Each elevation level provides a complete shadow style object that can be
 * spread directly into a StyleSheet:
 *
 *   import { elevation } from '../theme/tokens/elevation';
 *
 *   const styles = StyleSheet.create({
 *     card: {
 *       backgroundColor: '#fff',
 *       borderRadius: 12,
 *       ...elevation.sm,  // <-- spread the shadow object
 *     },
 *   });
 *
 * Levels:
 *   none  — no shadow (flat)
 *   xs    — 1dp  — subtle dividers, pills
 *   sm    — 2dp  — cards, chips
 *   md    — 4dp  — dropdowns, popovers
 *   lg    — 8dp  — bottom sheets, modals
 *   xl    — 16dp — FABs, nav bars
 */

import { Platform } from 'react-native';

// ---------------------------------------------------------------------------
// Shadow color
// ---------------------------------------------------------------------------

const SHADOW_COLOR = '#000000';

// ---------------------------------------------------------------------------
// Elevation levels
// ---------------------------------------------------------------------------

export const elevation = {
  none: Platform.select({
    ios: {
      shadowColor: SHADOW_COLOR,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0,
      shadowRadius: 0,
    },
    android: { elevation: 0 },
    default: {},
  }),

  xs: Platform.select({
    ios: {
      shadowColor: SHADOW_COLOR,
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 2,
    },
    android: { elevation: 1 },
    default: {},
  }),

  sm: Platform.select({
    ios: {
      shadowColor: SHADOW_COLOR,
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.08,
      shadowRadius: 4,
    },
    android: { elevation: 2 },
    default: {},
  }),

  md: Platform.select({
    ios: {
      shadowColor: SHADOW_COLOR,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.10,
      shadowRadius: 8,
    },
    android: { elevation: 4 },
    default: {},
  }),

  lg: Platform.select({
    ios: {
      shadowColor: SHADOW_COLOR,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.12,
      shadowRadius: 16,
    },
    android: { elevation: 8 },
    default: {},
  }),

  xl: Platform.select({
    ios: {
      shadowColor: SHADOW_COLOR,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.15,
      shadowRadius: 24,
    },
    android: { elevation: 16 },
    default: {},
  }),
} as const;

export type ElevationLevel = keyof typeof elevation;

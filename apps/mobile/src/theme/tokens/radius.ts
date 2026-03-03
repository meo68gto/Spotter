/**
 * Spotter Design System — Border Radius Tokens
 *
 * Usage:
 *
 *   import { radiusMd, radiusFull } from '../theme/tokens/radius';
 *
 *   const styles = StyleSheet.create({
 *     chip:   { borderRadius: radiusFull },
 *     card:   { borderRadius: radiusMd },
 *     button: { borderRadius: radiusSm },
 *   });
 */

/** 2dp — very subtle rounding (dividers, thin pills) */
export const radiusXs = 2;

/** 4dp — small rounding (tags, badges) */
export const radiusSm = 4;

/** 8dp — standard rounding (buttons, inputs) */
export const radiusMd = 8;

/** 12dp — medium rounding (cards, sheets) */
export const radiusLg = 12;

/** 16dp — large rounding (modals, hero cards) */
export const radiusXl = 16;

/** 24dp — extra large rounding (profile pictures, icon backgrounds) */
export const radius2Xl = 24;

/** 9999dp — fully round (circular elements, pills) */
export const radiusFull = 9999;

export const radius = {
  xs:   radiusXs,
  sm:   radiusSm,
  md:   radiusMd,
  lg:   radiusLg,
  xl:   radiusXl,
  '2xl': radius2Xl,
  full: radiusFull,
} as const;

export type RadiusToken = keyof typeof radius;

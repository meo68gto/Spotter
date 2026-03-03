/**
 * Spotter Design System — Spacing Tokens
 *
 * 4dp base grid. Named exports match Tailwind conventions (space-N).
 *
 * Usage:
 *
 *   import { space4, space8, spaceMd } from '../theme/tokens/spacing';
 *
 *   const styles = StyleSheet.create({
 *     container: { padding: spaceMd },
 *     row: { gap: space4 },
 *   });
 *
 * Named scale (t-shirt sizes) maps to the numeric grid:
 *   xs  = 4   (space4)
 *   sm  = 8   (space8)
 *   md  = 16  (space16)
 *   lg  = 24  (space24)
 *   xl  = 32  (space32)
 *   2xl = 48  (space48)
 *   3xl = 64  (space64)
 */

// Numeric scale (4dp base)
export const space2  =  2;
export const space4  =  4;
export const space6  =  6;
export const space8  =  8;
export const space12 = 12;
export const space16 = 16;
export const space20 = 20;
export const space24 = 24;
export const space32 = 32;
export const space40 = 40;
export const space48 = 48;
export const space64 = 64;

// T-shirt sizes
export const spaceXs  = space4;  //  4
export const spaceSm  = space8;  //  8
export const spaceMd  = space16; // 16
export const spaceLg  = space24; // 24
export const spaceXl  = space32; // 32
export const space2Xl = space48; // 48
export const space3Xl = space64; // 64

// Spacing object (for default import / namespace usage)
export const spacing = {
  2:   space2,
  4:   space4,
  6:   space6,
  8:   space8,
  12:  space12,
  16:  space16,
  20:  space20,
  24:  space24,
  32:  space32,
  40:  space40,
  48:  space48,
  64:  space64,

  // T-shirt aliases
  xs:  spaceXs,
  sm:  spaceSm,
  md:  spaceMd,
  lg:  spaceLg,
  xl:  spaceXl,
  '2xl': space2Xl,
  '3xl': space3Xl,
} as const;

export type SpacingToken = keyof typeof spacing;

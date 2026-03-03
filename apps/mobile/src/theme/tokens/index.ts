/**
 * Spotter Design System — Token Barrel Export
 *
 * Import all design tokens from this single entry point:
 *
 *   import { palette, spacing, radius, typography, elevationTokens, duration, easing } from '../theme/tokens';
 *
 * Or import specific tokens by name:
 *
 *   import { colors, space4, radiusMd, fontSizeMd } from '../theme/tokens';
 */

// Colors
export { colors, palette, semanticColors } from './colors';
export type { ColorToken } from './colors';

// Typography
export { typography, fontFamily, fontSize, fontWeight, lineHeight, letterSpacing } from './typography';
export type { TypographyToken } from './typography';

// Spacing
export {
  spacing,
  spaceXs, spaceSm, spaceMd, spaceLg, spaceXl, space2Xl, space3Xl,
  space2, space4, space6, space8, space12, space16, space20, space24, space32, space40, space48, space64,
} from './spacing';
export type { SpacingToken } from './spacing';

// Radius
export { radius, radiusXs, radiusSm, radiusMd, radiusLg, radiusXl, radiusFull } from './radius';
export type { RadiusToken } from './radius';

// Elevation
export { elevation } from './elevation';
export type { ElevationLevel } from './elevation';

// Motion
export {
  motion,
  duration, durationFast, durationNormal, durationSlow,
  easing, easingIn, easingOut, easingInOut,
} from './motion';

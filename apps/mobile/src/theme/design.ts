/**
 * Spotter Design System — Backward-Compatibility Re-export Layer
 *
 * This file provides the legacy `palette`, `spacing`, and `radius`
 * exports that existing screens and components import from `../theme/design`.
 *
 * All values now source from the new token files in `./tokens/`.
 * This file itself adds NO new values — it only re-maps token names
 * to the legacy API so existing imports continue to work unchanged.
 *
 * Migration path:
 *   - New code  → import directly from `./tokens/colors`, `./tokens/spacing`, etc.
 *   - Old code  → keep importing from `./design` until it's migrated
 *   - This file → delete after all imports are migrated to tokens
 *
 * @deprecated Use named token imports from ./tokens/* instead.
 */

import { colors } from './tokens/colors';
import {
  space2,  space4,  space6,  space8,
  space12, space16, space20, space24,
  space32, space40, space48, space64,
} from './tokens/spacing';
import { radius as radiusTokens } from './tokens/radius';

// ---------------------------------------------------------------------------
// palette — maps legacy color names to new token values
// ---------------------------------------------------------------------------

export const palette = {
  // Primary / brand
  navy50:   colors.navy50,
  navy100:  colors.navy100,
  navy200:  colors.navy200,
  navy300:  colors.navy300,
  navy400:  colors.navy400,
  navy500:  colors.navy500,
  navy600:  colors.navy600,
  navy700:  colors.navy700,
  navy800:  colors.navy800,
  navy900:  colors.navy900,

  // Accent / teal
  mint50:   colors.mint50,
  mint100:  colors.mint100,
  mint200:  colors.mint200,
  mint300:  colors.mint300,
  mint400:  colors.mint400,
  mint500:  colors.mint500,
  mint600:  colors.mint600,
  mint700:  colors.mint700,
  mint800:  colors.mint800,
  mint900:  colors.mint900,

  // Info blues
  sky50:    colors.sky50,
  sky100:   colors.sky100,
  sky200:   colors.sky200,
  sky300:   colors.sky300,
  sky400:   colors.sky400,
  sky500:   colors.sky500,

  // Neutral text
  ink50:    colors.ink50,
  ink100:   colors.ink100,
  ink200:   colors.ink200,
  ink300:   colors.ink300,
  ink400:   colors.ink400,
  ink500:   colors.ink500,
  ink600:   colors.ink600,
  ink700:   colors.ink700,
  ink800:   colors.ink800,
  ink900:   colors.ink900,

  // Surfaces
  white:    colors.white,
  gray50:   colors.gray50,
  gray100:  colors.gray100,
  gray200:  colors.gray200,

  // Semantic
  red50:    colors.red50,
  red500:   colors.red500,
  red600:   colors.red600,
  red700:   colors.red700,

  amber50:  colors.amber50,
  amber500: colors.amber500,
  amber600: colors.amber600,

  green50:  colors.green50,
  green500: colors.green500,
  green600: colors.green600,
} as const;

// ---------------------------------------------------------------------------
// spacing — maps legacy spacing names to new token values
// ---------------------------------------------------------------------------

export const spacing = {
  xs:  space2,
  sm:  space4,
  md:  space8,
  lg:  space12,
  xl:  space16,
  xxl: space24,
} as const;

// ---------------------------------------------------------------------------
// radius — maps legacy radius names to new token values
// ---------------------------------------------------------------------------

export const radius = {
  xs:   radiusTokens.xs,
  sm:   radiusTokens.sm,
  md:   radiusTokens.md,
  lg:   radiusTokens.lg,
  xl:   radiusTokens.xl,
  full: radiusTokens.full,
} as const;

// ---------------------------------------------------------------------------
// Re-export new token modules for gradual migration
// ---------------------------------------------------------------------------

export { colors }         from './tokens/colors';
export { typography }     from './tokens/typography';
export * as spacingTokens from './tokens/spacing';
export { radius as radiusTokens } from './tokens/radius';
export { elevation }      from './tokens/elevation';
export { motion }         from './tokens/motion';

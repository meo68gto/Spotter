/**
 * Spotter Design System — Typography Tokens
 *
 * Defines font families, sizes, weights, line heights, and letter spacing
 * for use across all components.
 *
 * Usage:
 *
 *   import { typography } from '../theme/tokens/typography';
 *
 *   // Use a preset text style:
 *   <Text style={typography.body}>Hello</Text>
 *
 *   // Or use individual tokens:
 *   import { fontSize, fontWeight, lineHeight } from '../theme/tokens/typography';
 *   const styles = StyleSheet.create({
 *     heading: {
 *       fontSize: fontSize.xl,
 *       fontWeight: fontWeight.bold,
 *       lineHeight: lineHeight.tight,
 *     }
 *   });
 */

import { Platform } from 'react-native';

// ---------------------------------------------------------------------------
// Font families
// ---------------------------------------------------------------------------

export const fontFamily = {
  /** Primary sans-serif: Inter (loaded via expo-font) */
  sans:  Platform.select({ ios: 'Inter', android: 'Inter', default: 'Inter, system-ui, sans-serif' }),
  /** Monospace: for code, debug info */
  mono:  Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
  /** System default (fallback before Inter loads) */
  system: Platform.select({ ios: 'System', android: 'Roboto', default: 'system-ui' }),
} as const;

// ---------------------------------------------------------------------------
// Font size scale (sp units — scales with system font size on Android)
// ---------------------------------------------------------------------------

export const fontSize = {
  xs:   10, //  — captions, timestamps
  sm:   12, //  — labels, helper text, badges
  md:   14, //  — body text (default)
  lg:   16, //  — body large, button labels
  xl:   18, //  — subheadings
  '2xl': 22, //  — headings
  '3xl': 26, //  — display
  '4xl': 32, //  — hero numbers
} as const;

// ---------------------------------------------------------------------------
// Font weight
// ---------------------------------------------------------------------------

export const fontWeight = {
  normal:   '400',
  medium:   '500',
  semibold: '600',
  bold:     '700',
  extrabold: '800',
} as const;

// ---------------------------------------------------------------------------
// Line height (multipliers applied as numeric values for RN)
// ---------------------------------------------------------------------------

export const lineHeight = {
  none:    1.0,   // tight — display text only
  tight:   1.25,  // headings
  snug:    1.375, // subheadings
  normal:  1.5,   // body text (default)
  relaxed: 1.625, // long-form text
  loose:   2.0,   // spacious labels
} as const;

// ---------------------------------------------------------------------------
// Letter spacing (tracking)
// ---------------------------------------------------------------------------

export const letterSpacing = {
  tighter: -0.8, // tight display
  tight:   -0.4, // headings
  normal:   0,   // default
  wide:     0.4, // body text
  wider:    0.8, // labels, captions
  widest:   1.6, // all-caps labels
} as const;

// ---------------------------------------------------------------------------
// Preset text styles
// ---------------------------------------------------------------------------

export const typography = {
  // Display
  displayLg: {
    fontSize: fontSize['4xl'],
    fontWeight: fontWeight.extrabold,
    lineHeight: fontSize['4xl'] * lineHeight.tight,
    letterSpacing: letterSpacing.tight,
  },
  display: {
    fontSize: fontSize['3xl'],
    fontWeight: fontWeight.extrabold,
    lineHeight: fontSize['3xl'] * lineHeight.tight,
    letterSpacing: letterSpacing.tight,
  },

  // Headings
  h1: {
    fontSize: fontSize['2xl'],
    fontWeight: fontWeight.bold,
    lineHeight: fontSize['2xl'] * lineHeight.tight,
    letterSpacing: letterSpacing.tight,
  },
  h2: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    lineHeight: fontSize.xl * lineHeight.snug,
    letterSpacing: letterSpacing.normal,
  },
  h3: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    lineHeight: fontSize.lg * lineHeight.snug,
    letterSpacing: letterSpacing.normal,
  },

  // Body
  bodyLg: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.normal,
    lineHeight: fontSize.lg * lineHeight.normal,
    letterSpacing: letterSpacing.normal,
  },
  body: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.normal,
    lineHeight: fontSize.md * lineHeight.normal,
    letterSpacing: letterSpacing.normal,
  },
  bodySm: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.normal,
    lineHeight: fontSize.sm * lineHeight.normal,
    letterSpacing: letterSpacing.normal,
  },

  // Labels
  labelLg: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    lineHeight: fontSize.lg * lineHeight.snug,
    letterSpacing: letterSpacing.normal,
  },
  label: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    lineHeight: fontSize.md * lineHeight.snug,
    letterSpacing: letterSpacing.normal,
  },
  labelSm: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    lineHeight: fontSize.sm * lineHeight.snug,
    letterSpacing: letterSpacing.wide,
  },

  // Captions & misc
  caption: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.normal,
    lineHeight: fontSize.xs * lineHeight.normal,
    letterSpacing: letterSpacing.wide,
  },
  overline: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    lineHeight: fontSize.xs * lineHeight.normal,
    letterSpacing: letterSpacing.widest,
  },

  // Code / mono
  code: {
    fontSize: fontSize.sm,
    fontFamily: fontFamily.mono,
    lineHeight: fontSize.sm * lineHeight.relaxed,
    letterSpacing: letterSpacing.normal,
  },
} as const;

export type TypographyToken = keyof typeof typography;

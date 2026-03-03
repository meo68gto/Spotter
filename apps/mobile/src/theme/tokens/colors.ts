/**
 * Spotter Design System — Color Tokens
 *
 * New palette from Section B spec. The old `palette` export is preserved
 * for backward compatibility but maps to the updated values.
 */

// ---------------------------------------------------------------------------
// Raw color values
// ---------------------------------------------------------------------------

export const colors = {
  // Primary navy
  navy50: '#E8EDF5',
  navy100: '#C5D0E2',
  navy200: '#9FB0CE',
  navy300: '#7890BA',
  navy400: '#5777AB',
  navy500: '#3A619F',
  navy600: '#1B2B4B', // ← updated from #0B3A53
  navy700: '#0F1B33', // ← updated from #082F43
  navy800: '#091324',
  navy900: '#040A14',

  // Mint / teal accent
  mint50: '#E0FFF5',   // new
  mint100: '#B3FFE8',
  mint200: '#80FFDA',
  mint300: '#4DFFCC',
  mint400: '#1AFFC0',
  mint500: '#2DD4A8', // ← updated from #2CB1BC
  mint600: '#00B38A',
  mint700: '#008066',
  mint800: '#004D3D',
  mint900: '#001A15',

  // Sky / info blues
  sky50: '#F0F9FF',
  sky100: '#E8F4FD', // ← updated from #EAF2F8
  sky200: '#C4E3F6', // ← updated from #D9E8F2
  sky300: '#8CC8ED', // ← updated from #BCCCDC
  sky400: '#52AADE',
  sky500: '#3B9DD4',

  // Ink / neutral text
  ink50: '#F8FAFC',
  ink100: '#F1F5F9',
  ink200: '#E2E8F0',
  ink300: '#CBD5E1',
  ink400: '#94A3B8',
  ink500: '#64748B', // ← updated from #627D98
  ink600: '#475569',
  ink700: '#334155', // ← updated from #334E68
  ink800: '#1E293B',
  ink900: '#0F172A', // ← updated from #102A43

  // Surfaces
  white: '#FFFFFF',
  gray50: '#F8FAFC',
  gray100: '#F1F5F9',
  gray200: '#E2E8F0',

  // Semantic
  red50: '#FEF2F2',
  red500: '#EF4444', // ← updated from #C53030
  red600: '#DC2626',
  red700: '#B91C1C',

  amber50: '#FFFBEB',
  amber500: '#F59E0B', // ← updated from #B7791F
  amber600: '#D97706',

  green50: '#F0FDF4',
  green500: '#22C55E', // ← updated from #2F855A
  green600: '#16A34A',
} as const;

export type ColorToken = keyof typeof colors;

// ---------------------------------------------------------------------------
// Semantic aliases (used in component library)
// ---------------------------------------------------------------------------

export const semanticColors = {
  // Brand
  brandPrimary:    colors.navy600,
  brandSecondary:  colors.mint500,
  brandAccent:     colors.sky400,

  // Text hierarchy
  textPrimary:     colors.ink900,
  textSecondary:   colors.ink700,
  textTertiary:    colors.ink500,
  textDisabled:    colors.ink300,
  textInverse:     colors.white,
  textLink:        colors.mint600,

  // Backgrounds
  bgBase:          colors.gray50,
  bgSurface:       colors.white,
  bgSubtle:        colors.gray100,
  bgMuted:         colors.gray200,
  bgOverlay:       'rgba(15, 23, 42, 0.6)',

  // Borders
  borderBase:      colors.ink200,
  borderSubtle:    colors.ink100,
  borderFocus:     colors.mint500,
  borderError:     colors.red500,

  // Status
  statusSuccess:   colors.green500,
  statusWarning:   colors.amber500,
  statusError:     colors.red500,
  statusInfo:      colors.sky400,

  // Interactive
  interactivePrimary:        colors.mint500,
  interactivePrimaryHover:   colors.mint600,
  interactivePrimaryPressed: colors.mint700,
  interactiveDestructive:    colors.red500,
} as const;

// ---------------------------------------------------------------------------
// Backward-compat palette export
// (Maps to the same values so old imports still work)
// ---------------------------------------------------------------------------

export const palette = colors;

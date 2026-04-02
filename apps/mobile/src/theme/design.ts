import { Platform } from 'react-native';
import { lightTokens } from './tokens';

export const palette = {
  ink900: lightTokens.text,
  ink800: '#22352d',
  ink700: lightTokens.textSecondary,
  ink600: '#56635d',
  ink500: lightTokens.textMuted,
  ink400: '#8b938c',
  ink300: '#c8c4b7',
  ink200: '#ddd8ca',
  ink100: '#eeeadf',
  ink50: '#f8f5ee',
  sky100: lightTokens.backgroundMuted,
  sky200: lightTokens.border,
  sky300: lightTokens.borderStrong,
  navy50: '#eef4f0',
  navy100: '#dce8e1',
  navy400: '#34624e',
  navy600: lightTokens.primary,
  navy700: '#102820',
  mint500: '#5d8f78',
  amber50: '#f8f1e5',
  amber100: '#efdfbe',
  green500: lightTokens.success,
  amber500: lightTokens.warning,
  amber700: '#7a5a29',
  red500: lightTokens.danger,
  error: lightTokens.danger,
  white: lightTokens.surface,
  sand100: '#f6f3ea',
  evergreen700: '#173528',
  gold400: '#bfa56a',
  overlay: lightTokens.overlay
};

export const spacing = {
  xs: 6,
  sm: 10,
  md: 14,
  lg: 18,
  xl: 24,
  xxl: 32
};

export const radius = {
  sm: 10,
  md: 14,
  lg: 18,
  xl: 24,
  pill: 999
};

export const font = {
  display: Platform.OS === 'web' ? 'Avenir Next, Avenir, system-ui, sans-serif' : 'System',
  body: Platform.OS === 'web' ? 'Avenir, system-ui, sans-serif' : 'System'
};

export const shadows = {
  card: {
    shadowColor: '#14261f',
    shadowOpacity: 0.07,
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 18,
    elevation: 2
  }
};

export const isWeb = Platform.OS === 'web';

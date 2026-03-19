import { Platform } from 'react-native';
import { lightTokens } from './tokens';

export const palette = {
  ink900: lightTokens.text,
  ink700: lightTokens.textSecondary,
  ink500: lightTokens.textMuted,
  sky100: lightTokens.backgroundMuted,
  sky200: lightTokens.border,
  sky300: lightTokens.borderStrong,
  navy600: lightTokens.primary,
  navy700: '#082F43',
  mint500: '#2CB1BC',
  green500: lightTokens.success,
  amber500: lightTokens.warning,
  red500: lightTokens.danger,
  white: lightTokens.surface
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
  pill: 999
};

export const font = {
  display: Platform.OS === 'web' ? 'Avenir Next, Avenir, system-ui, sans-serif' : 'System',
  body: Platform.OS === 'web' ? 'Avenir, system-ui, sans-serif' : 'System'
};

export const shadows = {
  card: {
    shadowColor: '#0B3A53',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 14,
    elevation: 2
  }
};

export const isWeb = Platform.OS === 'web';

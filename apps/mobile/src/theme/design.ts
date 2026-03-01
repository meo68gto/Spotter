import { Platform } from 'react-native';

export const palette = {
  ink900: '#102A43',
  ink700: '#334E68',
  ink500: '#627D98',
  sky100: '#EAF2F8',
  sky200: '#D9E8F2',
  sky300: '#BCCCDC',
  navy600: '#0B3A53',
  navy700: '#082F43',
  mint500: '#2CB1BC',
  green500: '#2F855A',
  amber500: '#B7791F',
  red500: '#C53030',
  white: '#FFFFFF'
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

export type ThemePreference = 'system' | 'light' | 'dark';

export type ThemeTokens = {
  background: string;
  backgroundElevated: string;
  backgroundMuted: string;
  surface: string;
  surfaceElevated: string;
  border: string;
  borderStrong: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  primary: string;
  primaryContrast: string;
  success: string;
  warning: string;
  danger: string;
  shadow: string;
  overlay: string;
};

export const lightTokens: ThemeTokens = {
  background: '#f6f9fc',
  backgroundElevated: '#ffffff',
  backgroundMuted: '#eaf2f8',
  surface: '#ffffff',
  surfaceElevated: '#ffffff',
  border: '#d9e2ec',
  borderStrong: '#bcccdc',
  text: '#102a43',
  textSecondary: '#334e68',
  textMuted: '#627d98',
  primary: '#0b3a53',
  primaryContrast: '#ffffff',
  success: '#2f855a',
  warning: '#b7791f',
  danger: '#c53030',
  shadow: '#0b3a53',
  overlay: 'rgba(11, 58, 83, 0.5)'
};

export const darkTokens: ThemeTokens = {
  background: '#0a1420',
  backgroundElevated: '#111e2d',
  backgroundMuted: '#162739',
  surface: '#162739',
  surfaceElevated: '#1c3046',
  border: '#27445f',
  borderStrong: '#345874',
  text: '#e6f1f8',
  textSecondary: '#c7d9e7',
  textMuted: '#9bb4c8',
  primary: '#4fc3e3',
  primaryContrast: '#06293b',
  success: '#6ed9a4',
  warning: '#f4c26d',
  danger: '#ff8c8c',
  shadow: '#03070b',
  overlay: 'rgba(0, 0, 0, 0.6)'
};

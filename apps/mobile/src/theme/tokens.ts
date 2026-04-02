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
  error: string;
  shadow: string;
  overlay: string;
};

export const lightTokens: ThemeTokens = {
  background: '#f3efe6',
  backgroundElevated: '#ffffff',
  backgroundMuted: '#ece7db',
  surface: '#ffffff',
  surfaceElevated: '#fffdf8',
  border: '#d9d2c1',
  borderStrong: '#bfae84',
  text: '#14261f',
  textSecondary: '#41524b',
  textMuted: '#6c786e',
  primary: '#173528',
  primaryContrast: '#ffffff',
  success: '#2e6b4b',
  warning: '#9e7441',
  danger: '#b2473d',
  error: '#b2473d',
  shadow: '#14261f',
  overlay: 'rgba(20, 38, 31, 0.5)'
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
  error: '#ff8c8c',
  shadow: '#03070b',
  overlay: 'rgba(0, 0, 0, 0.6)'
};

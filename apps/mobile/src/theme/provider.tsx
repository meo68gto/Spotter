import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react';
import { Appearance, ColorSchemeName, useColorScheme } from 'react-native';
import { darkTokens, lightTokens, ThemePreference, ThemeTokens } from './tokens';

const STORAGE_KEY = 'spotter:theme-preference';

type ThemeContextValue = {
  tokens: ThemeTokens;
  preference: ThemePreference;
  resolvedScheme: 'light' | 'dark';
  setPreference: (next: ThemePreference) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

const resolveScheme = (preference: ThemePreference, system: ColorSchemeName): 'light' | 'dark' => {
  if (preference === 'light') return 'light';
  if (preference === 'dark') return 'dark';
  return system === 'dark' ? 'dark' : 'light';
};

export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemScheme = useColorScheme();
  const [preference, setPreferenceState] = useState<ThemePreference>('system');

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((value) => {
        if (value === 'system' || value === 'light' || value === 'dark') {
          setPreferenceState(value);
        }
      })
      .catch(() => {
        // No-op: fall back to system preference.
      });
  }, []);

  useEffect(() => {
    const setColorScheme = (Appearance as { setColorScheme?: (scheme: 'light' | 'dark' | null) => void }).setColorScheme;
    if (typeof setColorScheme !== 'function') return;

    if (preference === 'system') {
      setColorScheme(null);
      return;
    }
    setColorScheme(preference);
  }, [preference]);

  const setPreference = (next: ThemePreference) => {
    setPreferenceState(next);
    AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {
      // No-op: preference still applies for this session.
    });
  };

  const value = useMemo<ThemeContextValue>(() => {
    const resolvedScheme = resolveScheme(preference, systemScheme);
    return {
      tokens: resolvedScheme === 'dark' ? darkTokens : lightTokens,
      preference,
      resolvedScheme,
      setPreference
    };
  }, [preference, systemScheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const value = useContext(ThemeContext);
  if (!value) throw new Error('useTheme must be used within ThemeProvider');
  return value;
}

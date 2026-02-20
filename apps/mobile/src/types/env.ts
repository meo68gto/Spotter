import { requireKeys } from '@spotter/env';

export const env = {
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? '',
  supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '',
  mapboxToken: process.env.EXPO_PUBLIC_MAPBOX_PUBLIC_TOKEN ?? '',
  apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL ?? '',
  posthogKey: process.env.EXPO_PUBLIC_POSTHOG_KEY ?? '',
  posthogHost: process.env.EXPO_PUBLIC_POSTHOG_HOST ?? 'https://app.posthog.com'
};

export const validateMobileEnv = (): string[] => {
  return requireKeys(
    {
      EXPO_PUBLIC_SUPABASE_URL: env.supabaseUrl,
      EXPO_PUBLIC_SUPABASE_ANON_KEY: env.supabaseAnonKey,
      EXPO_PUBLIC_API_BASE_URL: env.apiBaseUrl,
      EXPO_PUBLIC_MAPBOX_PUBLIC_TOKEN: env.mapboxToken
    },
    [
      'EXPO_PUBLIC_SUPABASE_URL',
      'EXPO_PUBLIC_SUPABASE_ANON_KEY',
      'EXPO_PUBLIC_API_BASE_URL',
      'EXPO_PUBLIC_MAPBOX_PUBLIC_TOKEN'
    ]
  );
};

import { requireKeys } from '@spotter/env';

export const env = {
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? '',
  supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '',
  mapboxToken: process.env.EXPO_PUBLIC_MAPBOX_PUBLIC_TOKEN ?? '',
  stripePublishableKey: process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? '',
  apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL ?? '',
  posthogKey: process.env.EXPO_PUBLIC_POSTHOG_KEY ?? '',
  posthogHost: process.env.EXPO_PUBLIC_POSTHOG_HOST ?? 'https://app.posthog.com',
  legalTosUrl: process.env.EXPO_PUBLIC_LEGAL_TOS_URL ?? '',
  legalPrivacyUrl: process.env.EXPO_PUBLIC_LEGAL_PRIVACY_URL ?? '',
  legalCookieUrl: process.env.EXPO_PUBLIC_LEGAL_COOKIE_URL ?? '',
  legalTosVersion: process.env.EXPO_PUBLIC_LEGAL_TOS_VERSION ?? '1.0',
  legalPrivacyVersion: process.env.EXPO_PUBLIC_LEGAL_PRIVACY_VERSION ?? '1.0',
  legalCookieVersion: process.env.EXPO_PUBLIC_LEGAL_COOKIE_VERSION ?? '1.0'
};

export const validateMobileEnv = (): string[] => {
  const missing = requireKeys(
    {
      EXPO_PUBLIC_SUPABASE_URL: env.supabaseUrl,
      EXPO_PUBLIC_SUPABASE_ANON_KEY: env.supabaseAnonKey,
      EXPO_PUBLIC_API_BASE_URL: env.apiBaseUrl,
      EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY: env.stripePublishableKey,
      EXPO_PUBLIC_LEGAL_TOS_URL: env.legalTosUrl,
      EXPO_PUBLIC_LEGAL_PRIVACY_URL: env.legalPrivacyUrl,
      EXPO_PUBLIC_LEGAL_COOKIE_URL: env.legalCookieUrl,
      EXPO_PUBLIC_LEGAL_TOS_VERSION: env.legalTosVersion,
      EXPO_PUBLIC_LEGAL_PRIVACY_VERSION: env.legalPrivacyVersion,
      EXPO_PUBLIC_LEGAL_COOKIE_VERSION: env.legalCookieVersion
    },
    [
      'EXPO_PUBLIC_SUPABASE_URL',
      'EXPO_PUBLIC_SUPABASE_ANON_KEY',
      'EXPO_PUBLIC_API_BASE_URL',
      'EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY',
      'EXPO_PUBLIC_LEGAL_TOS_URL',
      'EXPO_PUBLIC_LEGAL_PRIVACY_URL',
      'EXPO_PUBLIC_LEGAL_COOKIE_URL',
      'EXPO_PUBLIC_LEGAL_TOS_VERSION',
      'EXPO_PUBLIC_LEGAL_PRIVACY_VERSION',
      'EXPO_PUBLIC_LEGAL_COOKIE_VERSION'
    ]
  );

  const invalid: string[] = [];
  if (env.supabaseUrl.includes('example.supabase.co')) invalid.push('EXPO_PUBLIC_SUPABASE_URL');
  if (env.supabaseAnonKey.includes('placeholder')) invalid.push('EXPO_PUBLIC_SUPABASE_ANON_KEY');
  if (env.apiBaseUrl.includes('example.supabase.co')) invalid.push('EXPO_PUBLIC_API_BASE_URL');
  if (!/^https?:\/\//.test(env.apiBaseUrl)) invalid.push('EXPO_PUBLIC_API_BASE_URL');
  if (env.stripePublishableKey.includes('replace_me')) invalid.push('EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY');

  return [...new Set([...missing, ...invalid])];
};

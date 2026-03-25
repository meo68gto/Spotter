export const env = {
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? '',
  supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '',
  mapboxToken: process.env.EXPO_PUBLIC_MAPBOX_PUBLIC_TOKEN ?? '',
  stripePublishableKey: process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? '',
  sentryDsnMobile: process.env.EXPO_PUBLIC_SENTRY_DSN_MOBILE ?? '',
  appleWebClientId: process.env.EXPO_PUBLIC_APPLE_WEB_CLIENT_ID ?? '',
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
  const missing: string[] = [];

  // Read live from process.env at call time so that tests can set vars before calling.
  // This also ensures production always validates the actual current env state.
  const requiredVars: Array<{ key: string; value: string }> = [
    { key: 'EXPO_PUBLIC_SUPABASE_URL', value: process.env.EXPO_PUBLIC_SUPABASE_URL ?? '' },
    { key: 'EXPO_PUBLIC_SUPABASE_ANON_KEY', value: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '' },
    { key: 'EXPO_PUBLIC_API_BASE_URL', value: process.env.EXPO_PUBLIC_API_BASE_URL ?? '' },
    { key: 'EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY', value: process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? '' },
    { key: 'EXPO_PUBLIC_LEGAL_TOS_URL', value: process.env.EXPO_PUBLIC_LEGAL_TOS_URL ?? '' },
    { key: 'EXPO_PUBLIC_LEGAL_PRIVACY_URL', value: process.env.EXPO_PUBLIC_LEGAL_PRIVACY_URL ?? '' },
    { key: 'EXPO_PUBLIC_LEGAL_COOKIE_URL', value: process.env.EXPO_PUBLIC_LEGAL_COOKIE_URL ?? '' },
    { key: 'EXPO_PUBLIC_LEGAL_TOS_VERSION', value: process.env.EXPO_PUBLIC_LEGAL_TOS_VERSION ?? '' },
    { key: 'EXPO_PUBLIC_LEGAL_PRIVACY_VERSION', value: process.env.EXPO_PUBLIC_LEGAL_PRIVACY_VERSION ?? '' },
    { key: 'EXPO_PUBLIC_LEGAL_COOKIE_VERSION', value: process.env.EXPO_PUBLIC_LEGAL_COOKIE_VERSION ?? '' },
  ];

  for (const { key, value } of requiredVars) {
    if (!value) missing.push(key);
  }

  const invalid: string[] = [];
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
  const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';
  const apiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL ?? '';
  const stripeKey = process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? '';
  const appleWebClientId = process.env.EXPO_PUBLIC_APPLE_WEB_CLIENT_ID ?? '';

  if (supabaseUrl.includes('example.supabase.co')) invalid.push('EXPO_PUBLIC_SUPABASE_URL');
  if (supabaseAnonKey.includes('placeholder')) invalid.push('EXPO_PUBLIC_SUPABASE_ANON_KEY');
  if (apiBaseUrl.includes('example.supabase.co')) invalid.push('EXPO_PUBLIC_API_BASE_URL');
  if (apiBaseUrl && !/^https:\/\/.+/.test(apiBaseUrl)) invalid.push('EXPO_PUBLIC_API_BASE_URL');
  if (stripeKey.includes('replace_me')) invalid.push('EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY');
  if (appleWebClientId && !appleWebClientId.includes('.')) invalid.push('EXPO_PUBLIC_APPLE_WEB_CLIENT_ID');

  return [...new Set([...missing, ...invalid])];
};

import { readFile } from 'node:fs/promises';

const required = [
  'EXPO_PUBLIC_SUPABASE_URL',
  'EXPO_PUBLIC_SUPABASE_ANON_KEY',
  'EXPO_PUBLIC_API_BASE_URL',
  'EXPO_PUBLIC_MAPBOX_PUBLIC_TOKEN',
  'EXPO_PUBLIC_SENTRY_DSN_MOBILE',
  'EXPO_PUBLIC_POSTHOG_KEY',
  'EXPO_PUBLIC_POSTHOG_HOST',
  'EXPO_PUBLIC_LEGAL_TOS_URL',
  'EXPO_PUBLIC_LEGAL_PRIVACY_URL',
  'EXPO_PUBLIC_LEGAL_COOKIE_URL',
  'EXPO_PUBLIC_LEGAL_TOS_VERSION',
  'EXPO_PUBLIC_LEGAL_PRIVACY_VERSION',
  'EXPO_PUBLIC_LEGAL_COOKIE_VERSION',
  'SUPABASE_PROJECT_ID',
  'SUPABASE_ACCESS_TOKEN',
  'SUPABASE_DB_PASSWORD',
  'ADMIN_DELETION_TOKEN',
  'VIDEO_WORKER_TOKEN',
  'FLAG_ENVIRONMENT',
  'POSTHOG_PROJECT_API_KEY',
  'POSTHOG_HOST',
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'STRIPE_CONNECT_REFRESH_URL',
  'STRIPE_CONNECT_RETURN_URL',
  'STRIPE_PLATFORM_FEE_BPS',
  'DAILY_API_KEY',
  'DAILY_WEBHOOK_SECRET',
  'RESEND_API_KEY',
  'RESEND_FROM_EMAIL',
  'SENTRY_DSN_MOBILE',
  'SENTRY_DSN_FUNCTIONS',
  'LEGAL_TOS_URL',
  'LEGAL_PRIVACY_URL',
  'LEGAL_COOKIE_URL',
  'LEGAL_TOS_VERSION',
  'LEGAL_PRIVACY_VERSION',
  'LEGAL_COOKIE_VERSION'
];

const files = ['.env.example', '.env.staging.example', '.env.production.example'];

for (const file of files) {
  const text = await readFile(new URL(`../../${file}`, import.meta.url), 'utf8');
  const missing = required.filter((key) => !new RegExp(`^${key}=`, 'm').test(text));
  if (missing.length) {
    console.error(`${file} missing keys: ${missing.join(', ')}`);
    process.exit(1);
  }
}

console.log('Environment template validation passed.');

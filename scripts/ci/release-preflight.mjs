const requiredRuntime = [
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'STRIPE_CONNECT_REFRESH_URL',
  'STRIPE_CONNECT_RETURN_URL',
  'DAILY_API_KEY',
  'DAILY_WEBHOOK_SECRET',
  'SUPABASE_FUNCTIONS_URL',
  'POSTHOG_PROJECT_API_KEY',
  'POSTHOG_HOST',
  'ADMIN_DELETION_TOKEN',
  'SENTRY_DSN_MOBILE',
  'SENTRY_DSN_FUNCTIONS',
  'FLAG_ENVIRONMENT'
];

const missing = requiredRuntime.filter((key) => !process.env[key]);
if (missing.length > 0) {
  console.error(`Missing required runtime env vars: ${missing.join(', ')}`);
  process.exit(1);
}

const env = process.env.FLAG_ENVIRONMENT;
const stripe = process.env.STRIPE_SECRET_KEY ?? '';

if (env === 'production' && !stripe.startsWith('sk_live_')) {
  console.error('Production preflight failed: STRIPE_SECRET_KEY must be a live key (sk_live_...)');
  process.exit(1);
}

if (env !== 'production' && stripe.startsWith('sk_live_')) {
  console.error('Non-production preflight failed: live Stripe keys are not allowed outside production');
  process.exit(1);
}

const stripeWebhook = process.env.STRIPE_WEBHOOK_SECRET ?? '';
if (!stripeWebhook.startsWith('whsec_')) {
  console.error('Preflight failed: STRIPE_WEBHOOK_SECRET must start with whsec_');
  process.exit(1);
}

const functionsUrl = process.env.SUPABASE_FUNCTIONS_URL ?? '';
if (!/^https?:\/\//.test(functionsUrl) || !functionsUrl.includes('/functions/v1')) {
  console.error('Preflight failed: SUPABASE_FUNCTIONS_URL must include protocol and /functions/v1 path');
  process.exit(1);
}

const dailyWebhookSecret = process.env.DAILY_WEBHOOK_SECRET ?? '';
if (dailyWebhookSecret.length < 16) {
  console.error('Preflight failed: DAILY_WEBHOOK_SECRET must be at least 16 characters');
  process.exit(1);
}

console.log('Release preflight passed.');

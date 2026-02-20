const requiredRuntime = [
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'DAILY_API_KEY',
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

console.log('Release preflight passed.');

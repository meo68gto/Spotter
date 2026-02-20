const ensure = (key: string): string => {
  const value = Deno.env.get(key);
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
};

export const getRuntimeEnv = () => ({
  supabaseUrl: ensure('SUPABASE_URL'),
  serviceRoleKey: ensure('SUPABASE_SERVICE_ROLE_KEY'),
  bucketRaw: Deno.env.get('VIDEOS_RAW_BUCKET') ?? 'videos-raw',
  adminDeletionToken: Deno.env.get('ADMIN_DELETION_TOKEN') ?? '',
  posthogHost: Deno.env.get('POSTHOG_HOST') ?? '',
  posthogKey: Deno.env.get('POSTHOG_PROJECT_API_KEY') ?? '',
  flagEnvironment: Deno.env.get('FLAG_ENVIRONMENT') ?? 'local',
  stripeSecretKey: Deno.env.get('STRIPE_SECRET_KEY') ?? '',
  stripeWebhookSecret: Deno.env.get('STRIPE_WEBHOOK_SECRET') ?? '',
  stripeConnectRefreshUrl: Deno.env.get('STRIPE_CONNECT_REFRESH_URL') ?? '',
  stripeConnectReturnUrl: Deno.env.get('STRIPE_CONNECT_RETURN_URL') ?? '',
  stripePlatformFeeBps: Number(Deno.env.get('STRIPE_PLATFORM_FEE_BPS') ?? '2500'),
  dailyApiKey: Deno.env.get('DAILY_API_KEY') ?? '',
  dailyWebhookSecret: Deno.env.get('DAILY_WEBHOOK_SECRET') ?? '',
  resendApiKey: Deno.env.get('RESEND_API_KEY') ?? '',
  resendFromEmail: Deno.env.get('RESEND_FROM_EMAIL') ?? '',
  legalTosVersion: Deno.env.get('LEGAL_TOS_VERSION') ?? '1.0',
  legalPrivacyVersion: Deno.env.get('LEGAL_PRIVACY_VERSION') ?? '1.0',
  legalCookieVersion: Deno.env.get('LEGAL_COOKIE_VERSION') ?? '1.0',
  legalTosUrl: Deno.env.get('LEGAL_TOS_URL') ?? '',
  legalPrivacyUrl: Deno.env.get('LEGAL_PRIVACY_URL') ?? '',
  legalCookieUrl: Deno.env.get('LEGAL_COOKIE_URL') ?? '',
  sentryDsnFunctions: Deno.env.get('SENTRY_DSN_FUNCTIONS') ?? ''
});

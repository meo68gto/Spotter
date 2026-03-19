# Environment Configuration Guide

## Overview

This document describes all environment variables required for Spotter production deployment.

## Production Environment Variables

### Supabase Configuration

| Variable | Description | Required | Example |
|----------|-------------|----------|---------|
| `EXPO_PUBLIC_SUPABASE_URL` | Supabase project URL | Yes | `https://abc123.supabase.co` |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Public anon key for client-side | Yes | `eyJhbG...` |
| `SUPABASE_PROJECT_ID` | Project reference ID | Yes | `abc123` |
| `SUPABASE_ACCESS_TOKEN` | Service role token for deployments | Yes | `sbp_...` |
| `SUPABASE_DB_PASSWORD` | Database password for migrations | Yes | `secure-password` |

### API Configuration

| Variable | Description | Required | Example |
|----------|-------------|----------|---------|
| `EXPO_PUBLIC_API_BASE_URL` | Base URL for API calls | Yes | `https://api.spotter.app` |

### Third-Party Services

| Variable | Description | Required | Example |
|----------|-------------|----------|---------|
| `EXPO_PUBLIC_MAPBOX_PUBLIC_TOKEN` | Mapbox public token | Yes | `pk.eyJ...` |
| `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe publishable key | Yes | `pk_live_...` |
| `EXPO_PUBLIC_APPLE_WEB_CLIENT_ID` | Apple Sign-In client ID | Yes | `com.spotter.app` |

### Analytics

| Variable | Description | Required | Example |
|----------|-------------|----------|---------|
| `EXPO_PUBLIC_POSTHOG_KEY` | PostHog project key | Yes | `phc_...` |
| `EXPO_PUBLIC_POSTHOG_HOST` | PostHog host URL | Yes | `https://app.posthog.com` |
| `EXPO_PUBLIC_SENTRY_DSN_MOBILE` | Sentry DSN for mobile | Yes | `https://...@sentry.io/...` |
| `POSTHOG_PROJECT_API_KEY` | Server-side PostHog key | Yes | `phc_...` |
| `POSTHOG_HOST` | Server-side PostHog host | Yes | `https://app.posthog.com` |
| `SENTRY_DSN_FUNCTIONS` | Sentry DSN for edge functions | Yes | `https://...@sentry.io/...` |

### Stripe (Server-Side)

| Variable | Description | Required | Example |
|----------|-------------|----------|---------|
| `STRIPE_SECRET_KEY` | Stripe secret key | Yes | `sk_live_...` |
| `STRIPE_WEBHOOK_SECRET` | Webhook endpoint secret | Yes | `whsec_...` |
| `STRIPE_CONNECT_REFRESH_URL` | Connect refresh URL | Yes | `https://spotter.app/stripe/refresh` |
| `STRIPE_CONNECT_RETURN_URL` | Connect return URL | Yes | `https://spotter.app/stripe/return` |
| `STRIPE_PLATFORM_FEE_BPS` | Platform fee basis points | Yes | `2500` (25%) |

### Daily.co (Video Calls)

| Variable | Description | Required | Example |
|----------|-------------|----------|---------|
| `DAILY_API_KEY` | Daily.co API key | Yes | `...` |
| `DAILY_WEBHOOK_SECRET` | Daily.co webhook secret | Yes | `...` |

### Email (Resend)

| Variable | Description | Required | Example |
|----------|-------------|----------|---------|
| `RESEND_API_KEY` | Resend API key | Yes | `re_...` |
| `RESEND_FROM_EMAIL` | From email address | Yes | `notifications@spotter.app` |

### Edge Functions Configuration

| Variable | Description | Required | Example |
|----------|-------------|----------|---------|
| `VIDEOS_RAW_BUCKET` | S3 bucket for raw videos | Yes | `videos-raw` |
| `ADMIN_DELETION_TOKEN` | Token for admin deletion | Yes | `secure-token` |
| `VIDEO_WORKER_TOKEN` | Token for video workers | Yes | `worker-token` |
| `FLAG_ENVIRONMENT` | Environment flag | Yes | `production` |

### Feature Flags (Client-Side)

All feature flags use the `EXPO_PUBLIC_FLAG_*` prefix:

| Flag | Description | Default |
|------|-------------|---------|
| `EXPO_PUBLIC_FLAG_MATCHING_V2` | Enable matching v2 engine | `false` |
| `EXPO_PUBLIC_FLAG_VIDEO_PIPELINE` | Enable video processing | `true` |
| `EXPO_PUBLIC_FLAG_ENGAGEMENT_ASYNC_ANSWERS` | Async Q&A feature | `true` |
| `EXPO_PUBLIC_FLAG_ENGAGEMENT_GUEST_CHECKOUT` | Guest checkout | `true` |
| `EXPO_PUBLIC_FLAG_ENGAGEMENT_PUBLIC_FEED` | Public feed | `true` |
| `EXPO_PUBLIC_FLAG_ENGAGEMENT_VIDEO_CALL_DAILY` | Daily.co integration | `true` |
| `EXPO_PUBLIC_FLAG_INBOX_V2` | Inbox v2 UI | `true` |
| `EXPO_PUBLIC_FLAG_PROFILE_V2` | Profile v2 UI | `true` |
| `EXPO_PUBLIC_FLAG_COACHING_PART2` | Coaching part 2 | `true` |

### Legal URLs

| Variable | Description | Required | Example |
|----------|-------------|----------|---------|
| `EXPO_PUBLIC_LEGAL_TOS_URL` | Terms of Service URL | Yes | `https://spotter.app/terms` |
| `EXPO_PUBLIC_LEGAL_PRIVACY_URL` | Privacy Policy URL | Yes | `https://spotter.app/privacy` |
| `EXPO_PUBLIC_LEGAL_COOKIE_URL` | Cookie Policy URL | Yes | `https://spotter.app/cookies` |
| `EXPO_PUBLIC_LEGAL_TOS_VERSION` | ToS version | Yes | `1.0` |
| `EXPO_PUBLIC_LEGAL_PRIVACY_VERSION` | Privacy version | Yes | `1.0` |
| `EXPO_PUBLIC_LEGAL_COOKIE_VERSION` | Cookie version | Yes | `1.0` |

### App URL

| Variable | Description | Required | Example |
|----------|-------------|----------|---------|
| `APP_URL` | Main app URL | Yes | `https://spotter.app` |

## Secrets Management

### GitHub Actions Secrets

The following secrets must be configured in GitHub repository settings:

1. **SUPABASE_PROJECT_ID** - Your Supabase project reference
2. **SUPABASE_ACCESS_TOKEN** - Service role token for deployments
3. **STRIPE_SECRET_KEY** - Live Stripe secret key
4. **STRIPE_WEBHOOK_SECRET** - Stripe webhook secret
5. **STRIPE_CONNECT_REFRESH_URL** - OAuth refresh URL
6. **STRIPE_CONNECT_RETURN_URL** - OAuth return URL
7. **DAILY_API_KEY** - Daily.co API key
8. **DAILY_WEBHOOK_SECRET** - Daily.co webhook secret
9. **POSTHOG_PROJECT_API_KEY** - PostHog API key
10. **POSTHOG_HOST** - PostHog host
11. **SENTRY_DSN_FUNCTIONS** - Sentry DSN for functions
12. **SENTRY_DSN_MOBILE** - Sentry DSN for mobile
13. **ADMIN_DELETION_TOKEN** - Admin deletion token

### Local Development

For local development, copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

Fill in the values from your development/staging environment.

### Production Environment

For production, copy `.env.production.example` to `.env.production`:

```bash
cp .env.production.example .env.production
```

**⚠️ WARNING:** Never commit `.env.production` to version control. It should be populated via:

1. GitHub Actions secrets for CI/CD
2. Vercel environment variables for web deployment
3. Expo EAS secrets for mobile builds

## Verification

To verify environment configuration:

```bash
# Validate environment variables
node scripts/ci/validate-env.mjs

# Check production environment
./scripts/deploy-production.sh --help
```

## Rotation Schedule

| Secret | Rotation Frequency | Procedure |
|--------|-------------------|-----------|
| Stripe webhook secret | Quarterly | Regenerate in Stripe Dashboard |
| Daily.co webhook secret | Quarterly | Regenerate in Daily.co Dashboard |
| Admin tokens | Annually | Generate new, update GitHub secrets |
| API keys | As needed | Rotate immediately if compromised |

## Security Best Practices

1. **Never commit secrets** - All `.env.*` files are in `.gitignore`
2. **Use different keys per environment** - Never reuse staging keys in production
3. **Rotate regularly** - Follow the rotation schedule above
4. **Audit access** - Review who has access to secrets quarterly
5. **Use least privilege** - Grant minimum required permissions to each key

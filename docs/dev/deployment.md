# Deployment Guide

How to deploy the Spotter platform to production.

## Overview

Spotter deployment targets:
- **Mobile App**: EAS (Expo Application Services)
- **Backend**: Supabase Cloud
- **Edge Functions**: Supabase Functions
- **Database**: Supabase PostgreSQL

## Prerequisites

### Required Accounts

- [Expo](https://expo.dev) account (for mobile builds)
- [Supabase](https://supabase.com) project
- [Stripe](https://stripe.com) account (payments)
- [GitHub](https://github.com) (CI/CD)

### Environment Setup

```bash
# Install CLI tools
npm install -g @supabase/cli
npm install -g eas-cli

# Login
supabase login
eas login
```

## Deployment Environments

| Environment | URL | Purpose |
|-------------|-----|---------|
| **Local** | localhost | Development |
| **Staging** | staging.spotter.golf | Testing |
| **Production** | spotter.golf | Live app |

## Mobile App Deployment

### Build Configuration

`apps/mobile/eas.json`:

```json
{
  "cli": {
    "version": ">= 5.0.0"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "preview": {
      "distribution": "internal",
      "channel": "preview"
    },
    "production": {
      "channel": "production"
    }
  },
  "submit": {
    "production": {
      "ios": {
        "ascAppId": "1234567890",
        "ascTeamId": "ABC123DEF"
      },
      "android": {
        "serviceAccountKeyPath": "./service-account.json"
      }
    }
  }
}
```

### Environment Variables

`apps/mobile/.env.production`:

```bash
SUPABASE_URL=https://<project>.supabase.co
SUPABASE_ANON_KEY=<production_anon_key>
API_URL=https://<project>.supabase.co/functions/v1
```

### Build Commands

```bash
cd apps/mobile

# Development build
pnpm build:dev

# Preview build (TestFlight/Internal Testing)
pnpm build:preview

# Production build
pnpm build:production
```

### Deploy to App Stores

#### iOS (App Store)

```bash
# Build and submit
eas build --platform ios --profile production
eas submit --platform ios --profile production

# Or combined
eas build --platform ios --profile production --auto-submit
```

#### Android (Google Play)

```bash
# Build and submit
eas build --platform android --profile production
eas submit --platform android --profile production
```

### OTA Updates

Push updates without app store review:

```bash
# Publish update
cd apps/mobile
pnpm update:production

# Force update (immediate)
pnpm update:production -- --force

# Check update status
eas update:list --branch production
```

## Backend Deployment

### Supabase Configuration

`supabase/config.toml`:

```toml
[project]
name = "spotter"
port = 54321

[api]
enabled = true
port = 54321
schemas = ["public", "storage"]

[db]
port = 54322
shadow_port = 54320
major_version = 15

[realtime]
enabled = true

[studio]
enabled = true
port = 54323

[inbucket]
enabled = true
port = 54324

[storage]
enabled = true

[auth]
enabled = true
port = 54325
```

### Deploy Database Migrations

```bash
# Link to project
supabase link --project-ref <project-ref>

# Deploy migrations
supabase db push

# Deploy with dry run (check first)
supabase db push --dry-run
```

### Deploy Edge Functions

```bash
# Deploy all functions
supabase functions deploy

# Deploy specific function
supabase functions deploy tier-assignment

# Deploy with secrets
supabase secrets set --env-file ./supabase/.env.production

# Verify deployment
supabase functions list
```

### Function Secrets

Set production secrets:

```bash
# Set individually
supabase secrets set STRIPE_SECRET_KEY=sk_live_...
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...

# Or from file
supabase secrets set --env-file .env.production
```

Required secrets:

| Secret | Description |
|--------|-------------|
| `STRIPE_SECRET_KEY` | Stripe API key |
| `STRIPE_PUBLISHABLE_KEY` | Stripe publishable key |
| `STRIPE_WEBHOOK_SECRET` | Webhook signing secret |
| `SMTP_HOST` | Email server host |
| `SMTP_USER` | Email username |
| `SMTP_PASS` | Email password |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key |

## Production Checklist

### Before First Deploy

- [ ] Supabase project created
- [ ] Stripe account configured
- [ ] DNS configured (custom domain)
- [ ] SSL certificates installed
- [ ] App store accounts set up
- [ ] Environment variables configured

### Database

- [ ] Migrations run successfully
- [ ] RLS policies enabled
- [ ] Indexes created
- [ ] Seed data loaded
- [ ] Backup configured

### Security

- [ ] Production Stripe keys
- [ ] Webhook secrets configured
- [ ] JWT secrets rotated
- [ ] API rate limiting enabled
- [ ] CORS configured

### Monitoring

- [ ] Error tracking (Sentry)
- [ ] Analytics (Mixpanel/Amplitude)
- [ ] Logging configured
- [ ] Alerts set up

## CI/CD Pipeline

### GitHub Actions Workflow

`.github/workflows/deploy.yml`:

```yaml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: pnpm install
      
      - name: Run tests
        run: pnpm test
      
      - name: Run smoke tests
        run: pnpm smoke:local

  deploy-backend:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Supabase CLI
        uses: supabase/setup-cli@v1
      
      - name: Deploy migrations
        run: supabase db push
        env:
          SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}
      
      - name: Deploy functions
        run: supabase functions deploy
        env:
          SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}

  deploy-mobile:
    needs: [test, deploy-backend]
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup EAS
        uses: expo/expo-github-action@v8
        with:
          eas-version: latest
          token: ${{ secrets.EXPO_TOKEN }}
      
      - name: Build and submit
        run: |
          cd apps/mobile
          eas build --platform all --profile production --auto-submit
```

## Rollback Strategy

### Database Rollback

```bash
# Check migration status
supabase migrations list

# Rollback specific migration
supabase db rollback <migration_name>

# Or restore from backup
supabase db restore <backup_id>
```

### Function Rollback

```bash
# Redeploy previous version
git checkout <previous-commit>
supabase functions deploy

# Or disable function temporarily
supabase functions delete <function_name>
```

### Mobile Rollback

```bash
# Rollback OTA update
cd apps/mobile
eas update:rollback --branch production

# App store rollback requires new submission
```

## Monitoring

### Health Checks

```bash
# API health
curl https://<project>.supabase.co/functions/v1/health

# Database health
supabase db health

# Function health
supabase functions list
```

### Logs

```bash
# Function logs
supabase functions logs tier-assignment --tail

# Database logs
supabase logs postgres --tail
```

### Metrics

Monitor via Supabase Dashboard:
- Database connections
- Function invocations
- Error rates
- Response times

## SSL/TLS Configuration

### Custom Domain

```bash
# Add custom domain
supabase domains create --project-ref <ref> --custom-hostname api.spotter.golf

# Verify DNS
dig api.spotter.golf

# Activate SSL
supabase domains activate --project-ref <ref>
```

### Certificate Renewal

- Automatic with Supabase managed SSL
- Manual renewal for self-managed certificates

## Environment Variables Reference

### Production Required

```bash
# Supabase
SUPABASE_URL=https://<project>.supabase.co
SUPABASE_ANON_KEY=<production_anon_key>
SUPABASE_SERVICE_ROLE_KEY=<production_service_key>

# Stripe (Live Mode)
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Email (Production)
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=<sendgrid_api_key>
SMTP_FROM=noreply@spotter.golf

# App
APP_URL=https://spotter.golf
API_URL=https://<project>.supabase.co/functions/v1

# Monitoring
SENTRY_DSN=https://...
MIXPANEL_TOKEN=
```

## Troubleshooting

### Deployment Failures

**Migration fails:**
```bash
# Check migration status
supabase migrations list

# Fix conflicts manually
supabase db reset  # Local only
```

**Function deployment fails:**
```bash
# Check function size
supabase functions build --analyze

# Bundle size limit: 20MB
```

**App store rejection:**
- Check metadata completeness
- Verify screenshots
- Review app guidelines compliance
- Check for beta features in production

### Post-Deploy Verification

```bash
# Smoke test production
pnpm smoke:production

# Verify critical paths
pnpm e2e:production
```

## Support

Deployment issues?
- Supabase: https://supabase.com/support
- Expo: https://expo.dev/support
- Stripe: https://support.stripe.com

## Related Documentation

- [Architecture](./architecture.md)
- [Testing Guide](./testing.md)
- [Contributing](./contributing.md)

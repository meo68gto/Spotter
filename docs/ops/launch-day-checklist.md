# Launch Day Checklist

## Owners
- Incident commander:
- Backend owner:
- Mobile owner:
- Data/compliance owner:
- Support owner:

## T-120 minutes
1. Confirm freeze is active on `main`.
2. Confirm latest tag is the approved RC.
3. Confirm staging and production `Ops Verify` artifacts exist and are green.
4. Confirm all required secrets present in GitHub environments.

## T-90 minutes (final config lock)
1. Confirm launch feature flags in `public.feature_flags`.
2. Capture final flag values for production in release notes.
3. Verify legal URLs and versions:
   - `LEGAL_TOS_URL`
   - `LEGAL_PRIVACY_URL`
   - `LEGAL_COOKIE_URL`
   - `LEGAL_*_VERSION`

## T-60 minutes (external integrations)
1. Stripe:
   - live key loaded
   - webhook endpoint healthy
   - test webhook replay succeeds
2. Daily:
   - API key loaded
   - webhook secret loaded
   - webhook test event succeeds
3. Supabase:
   - migrations up-to-date
   - auth providers enabled
   - storage buckets present

## T-30 minutes (deploy readiness)
1. Run:
   - `pnpm release:preflight`
   - `pnpm qa:stock-photo-audit`
2. Trigger:
   - `Ops Verify` workflow in production
   - `Mobile RC QA Gate` for the approved RC tag
3. Verify:
   - no new Sentry critical errors
   - recurring jobs workflow healthy
   - QA artifact bundle attached:
     - Detox logs/screenshots
     - Lighthouse report
     - Accessibility sheet
     - Bundle report

## T-0 (go live)
1. Push or dispatch production deploy workflow from approved tag.
2. Confirm `health` endpoint success.
3. Validate first-user path:
   - auth -> consent -> onboarding -> engagement create
4. Record launch timestamp in incident channel.

## T+15 minutes
1. Verify PostHog event flow for core funnel.
2. Verify Stripe `payment_intent.succeeded` and failure paths.
3. Verify Daily call start/end and billing events.

## T+60 minutes
1. Run rollback decision checkpoint:
   - If P0 exists, execute rollback checklist in:
     - `/Users/brucewayne/Documents/Spotter/docs/ops/backup-and-rollback.md`
2. If healthy, continue 24h monitoring plan:
   - `/Users/brucewayne/Documents/Spotter/docs/ops/post-launch-monitoring.md`

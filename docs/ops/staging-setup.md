# Staging Setup Runbook

## 1) Supabase project
- Create project in US region.
- Enable extensions via migration (`postgis`, `pgcrypto`, `uuid-ossp`, `vector`).

## 2) Storage buckets
- Create private buckets:
  - `videos-raw`
  - `videos-processed`

## 3) Auth providers
- Enable Email/Password and Magic Link.
- Configure OAuth providers:
  - Apple
  - Google
- Allowed redirect URLs:
  - `spotter://auth/callback`
  - Expo development callback URL from `expo start` output

## 4) Realtime
- Ensure publication includes:
  - `matches`
  - `sessions`
  - `messages`

## 5) GitHub secrets
Set in repository settings:
- `SUPABASE_PROJECT_ID`
- `SUPABASE_ACCESS_TOKEN`
- `ADMIN_DELETION_TOKEN`
- `SUPABASE_URL`
- `SUPABASE_FUNCTIONS_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_CONNECT_REFRESH_URL`
- `STRIPE_CONNECT_RETURN_URL`
- `DAILY_API_KEY`
- `DAILY_WEBHOOK_SECRET`
- `POSTHOG_PROJECT_API_KEY`
- `POSTHOG_HOST`
- `SENTRY_DSN_MOBILE`
- `SENTRY_DSN_FUNCTIONS`

## 6) Deploy
- Merge to `main` to trigger staging workflow.
- Validate endpoint: `GET /functions/v1/health`.

## 7) Verification
- Run auth flow on simulator/device.
- Confirm onboarding write to `users` and `skill_profiles`.
- Confirm map screen renders with location permissions.
- Confirm `matching-request`, `sessions-confirm`, and `chat-send` function flows.
- Run staging integration smoke script from repo root:
  - `pnpm smoke:staging`
  - Required env vars: `SUPABASE_URL`, `SUPABASE_FUNCTIONS_URL` (or `FUNCTIONS_URL`), `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
  - Optional for full feed moderation path: `ADMIN_DELETION_TOKEN`
  - Optional for Daily webhook reconcile path: `DAILY_WEBHOOK_SECRET`
- Run one-command cutover verifier to capture artifacts:
  - `pnpm ops:verify`
  - Artifacts are written to `.artifacts/ops-cutover/<timestamp>/`
  - GitHub Actions alternative: run `Ops Verify` workflow and download artifact `ops-cutover-<run_id>`

## 8) Launch control references
- RC process:
  - `/Users/brucewayne/Documents/Spotter/docs/ops/release-candidate-runbook.md`
- Launch-day execution:
  - `/Users/brucewayne/Documents/Spotter/docs/ops/launch-day-checklist.md`
- Incident handling:
  - `/Users/brucewayne/Documents/Spotter/docs/ops/incident-playbook.md`
- 24h/72h post-launch monitoring:
  - `/Users/brucewayne/Documents/Spotter/docs/ops/post-launch-monitoring.md`

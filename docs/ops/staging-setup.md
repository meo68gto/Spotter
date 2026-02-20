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

## 6) Deploy
- Merge to `main` to trigger staging workflow.
- Validate endpoint: `GET /functions/v1/health`.

## 7) Verification
- Run auth flow on simulator/device.
- Confirm onboarding write to `users` and `skill_profiles`.
- Confirm map screen renders with location permissions.
- Confirm `matching-request`, `sessions-confirm`, and `chat-send` function flows.

# Device E2E Checklist (Staging)

## Preconditions
- Mobile app is launched from `/Users/brucewayne/Documents/Spotter/apps/mobile`.
- Staging env is loaded (`EXPO_PUBLIC_*` values point to staging).
- Apple and Google OAuth providers are enabled in Supabase with redirect:
  - `spotter://auth/callback`

## OAuth checks
1. Sign in with Google from a cold app launch.
2. Kill app, relaunch, confirm session restore.
3. Sign out and sign in with Apple.
4. Confirm callback returns to app without browser dead-end.

## Registered engagement checks
1. Complete legal consent prompt.
2. Create text answer request from `Ask`.
3. As coach, accept and respond.
4. Toggle public visibility.
5. Confirm request appears in `My Requests` and (after moderation) in `Feed`.

## Guest checkout checks
1. Create request in guest mode with email.
2. Verify guest token flow returns request status.
3. Confirm guest cannot access non-owned private rows.

## Video call checks
1. Create `video_call` request.
2. Accept as coach.
3. Start and end call from `Call Room`.
4. Confirm billed minutes are rounded up (`ceil(seconds/60)`).
5. Confirm payment status transitions to `paid` or deterministic failure state.

## Operational checks
1. Trigger `pnpm smoke:staging` and record run output artifact.
2. Confirm no new Sentry errors for auth/call/payment paths.
3. Confirm PostHog events for:
   - `engagement_created`
   - `engagement_accepted`
   - `engagement_completed`
   - `guest_checkout_started`
   - `guest_checkout_verified`
   - `video_call_started`
   - `video_call_ended`
   - `video_call_billed`

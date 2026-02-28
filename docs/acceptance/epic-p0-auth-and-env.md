# Epic P0: Auth and Environment Hardening

## Objective
Ship reliable, secure authentication across iOS/Android/Web with deterministic startup behavior in staging and production.

## User-visible outcome
1. User can sign in with email, Google, and LinkedIn.
2. App restores session on cold launch.
3. App never shows blank screen from missing env; user sees guided fallback.

## API and DB contract
1. Functions protected by `requireUser` return `401` with envelope `{ error, code, details? }` when token is missing/invalid.
2. `POST /functions/v1/legal-consent` persists consent versions.
3. `GET /functions/v1/legal-status` returns `{ accepted: boolean }`.
4. OAuth callbacks configured for:
   - iOS: `spotter://auth/callback`
   - Android: app scheme callback
   - Web: staging/prod HTTPS callback URLs

## Security and RLS rules
1. No service-role key in mobile runtime.
2. All user tables have RLS enabled and user-scoped policies.
3. Cross-user reads/writes are denied for private rows.

## Telemetry events
1. `auth_sign_in`
2. `auth_sign_up`
3. `auth_oauth_start`
4. `auth_oauth_success`
5. `auth_oauth_failure`
6. `session_restore_success`
7. `session_restore_failure`

## Test cases
1. Email signup/login/logout happy path on staging.
2. Google OAuth success for new and returning user.
3. LinkedIn OAuth success for new and returning user.
4. Invalid bearer token yields `401` from protected endpoint.
5. Cold launch restores valid session.
6. Missing env shows fallback UI (not crash/blank).

## Definition of done
1. OAuth providers pass on iOS, Android, and web staging.
2. Auth-related tests pass in CI.
3. Error envelope is consistent on auth failures.
4. Startup behavior validated with env validation gate in CI.

## Non-goals
1. SSO enterprise connectors.
2. Passwordless beyond current planned scope.

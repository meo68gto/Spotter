# Spotter Auth Production Readiness

## Code status
1. Mobile env is synced from root `.env.local` before launch.
2. API function URL path normalization handles both base forms:
   - `https://<project>.supabase.co`
   - `https://<project>.supabase.co/functions/v1`
3. OAuth telemetry and session-restore telemetry are instrumented.
4. Launcher reuses existing Metro and no longer fails on occupied port.

## Required Supabase dashboard configuration
1. Auth -> URL Configuration
   - Site URL: staging/prod app URL
   - Additional Redirect URLs:
     - `spotter://auth/callback`
     - staging web callback URL
     - production web callback URL
2. Auth -> Providers
   - Email enabled
   - Google enabled with correct client ID/secret
   - LinkedIn OIDC enabled with correct client ID/secret
3. Auth email confirmation policy as desired (`enable_confirmations` behavior).

## Required environment values (mobile)
1. `EXPO_PUBLIC_SUPABASE_URL`
2. `EXPO_PUBLIC_SUPABASE_ANON_KEY`
3. `EXPO_PUBLIC_API_BASE_URL`
4. `EXPO_PUBLIC_LEGAL_TOS_URL`
5. `EXPO_PUBLIC_LEGAL_PRIVACY_URL`
6. `EXPO_PUBLIC_LEGAL_COOKIE_URL`

## Required environment values (functions)
1. `SUPABASE_URL`
2. `SUPABASE_SERVICE_ROLE_KEY`
3. `STRIPE_SECRET_KEY`
4. `STRIPE_WEBHOOK_SECRET`
5. `LEGAL_TOS_VERSION`
6. `LEGAL_PRIVACY_VERSION`
7. `LEGAL_COOKIE_VERSION`

## Verification checklist
1. Email sign up/sign in works on iOS, Android, web.
2. Google OAuth works on iOS, Android, web.
3. LinkedIn OAuth works on iOS, Android, web.
4. Cold launch restores session.
5. Protected function call succeeds after sign in (`GET legal-status`).
6. Invalid token returns `401` with standard error envelope.

## Local run order
1. `pnpm local:up`
2. `pnpm functions:serve`
3. `pnpm mobile:launch:all`

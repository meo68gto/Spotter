# Spotter Auth Callback Matrix

Last updated: 2026-02-28

## Runtime callback targets
1. iOS native callback: `spotter://auth/callback`
2. Android native callback: `spotter://auth/callback`
3. Web local callback base: `http://localhost:8081`
4. Supabase local auth site URL: `http://localhost:8081`

## Supabase config mapping
Source: `/Users/brucewayne/Documents/Spotter/apps/functions/supabase/config.toml`

1. `site_url = "http://localhost:8081"`
2. `additional_redirect_urls = ["spotter://auth/callback"]`

## Expo app mapping
Source: `/Users/brucewayne/Documents/Spotter/apps/mobile/app.json`

1. `scheme = "spotter"`
2. iOS bundle id: `com.spotter.app`
3. Android package: `com.spotter.app`

## OAuth providers
1. Google OAuth
   - Allowed redirect URI must include Supabase callback URL for deployed project.
   - Native app deep-link callback handled through Supabase PKCE + app scheme.
2. LinkedIn OAuth (`linkedin_oidc`)
   - Provider enabled in Supabase Auth dashboard.
   - Redirect URI list must include deployed Supabase auth callback and local callback for test.
3. Apple OAuth (if re-enabled)
   - Service ID configured with the same redirect callback domain as Supabase project.

## Staging and production required values
Set these per environment (not placeholders):
1. `EXPO_PUBLIC_SUPABASE_URL`
2. `EXPO_PUBLIC_SUPABASE_ANON_KEY`
3. `EXPO_PUBLIC_API_BASE_URL`
4. Legal URLs (`EXPO_PUBLIC_LEGAL_*`)
5. Supabase Auth: staging/prod `site_url` and `additional_redirect_urls`

## Validation checklist
1. iOS simulator: Google login -> callback -> session established.
2. Android emulator/device: Google login -> callback -> session established.
3. Web staging: Google login -> callback -> session established.
4. iOS simulator: LinkedIn login -> callback -> session established.
5. Android emulator/device: LinkedIn login -> callback -> session established.
6. Web staging: LinkedIn login -> callback -> session established.
7. Cold launch restores session on all three platforms.

## Known constraints
1. OAuth provider verification still requires manual dashboard configuration and live callback run per environment.
2. Local-only callback success does not prove staging/prod callback correctness.

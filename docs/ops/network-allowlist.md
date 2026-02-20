# Network and CSP Allowlist

## Mobile outbound allowlist

- Supabase project URL (`EXPO_PUBLIC_SUPABASE_URL`)
- Edge functions base URL (`EXPO_PUBLIC_API_BASE_URL`)
- Mapbox APIs
- PostHog host (`EXPO_PUBLIC_POSTHOG_HOST`)
- Stripe client-side domains where applicable

## Edge functions outbound allowlist

- Stripe API (`https://api.stripe.com`)
- Resend API (`https://api.resend.com`)
- PostHog ingest (`POSTHOG_HOST`)
- Supabase internal APIs/storage

## Principle

Only allow explicit vendor domains required for Spotter runtime.

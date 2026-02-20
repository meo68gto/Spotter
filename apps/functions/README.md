# @spotter/functions

Supabase Edge Functions for Spotter.

## Functions

- `health`
- `onboarding-profile`
- `matching-candidates`
- `matching-request`
- `matching-accept`
- `matching-reject`
- `sessions-propose`
- `sessions-confirm`
- `sessions-cancel`
- `sessions-feedback`
- `chat-send`
- `videos-presign`
- `videos-analysis`
- `videos-enqueue-processing`
- `videos-process-next`
- `videos-enqueue-processing`
- `videos-process-next`
- `progress-generate`
- `progress-snapshots`
- `admin-process-deletion`

## Local dev

1. Install Supabase CLI.
2. Start stack:
   - `pnpm --filter @spotter/functions supabase:start`
3. Serve functions:
   - `pnpm --filter @spotter/functions dev`

## Local verification

1. Start/reset local stack from repo root:
   - `pnpm local:up`
2. In another terminal, serve functions:
   - `pnpm functions:serve`
3. Export env from Supabase local status:
   - `eval "$(cd apps/functions && supabase status -o env)"`
4. Run smoke checks:
   - `pnpm smoke:local`

## Staging verification

1. Export staging credentials:
   - `SUPABASE_URL`
   - `SUPABASE_FUNCTIONS_URL` (or `FUNCTIONS_URL`)
   - `SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
2. Run integration smoke checks:
   - `pnpm smoke:staging`

## Staging setup checklist

1. Create Supabase project and set secrets:
   - `SUPABASE_PROJECT_ID`
   - `SUPABASE_ACCESS_TOKEN`
2. Enable auth providers in Supabase dashboard:
   - Email
   - Apple OAuth
   - Google OAuth
3. Create private storage buckets:
   - `videos-raw`
   - `videos-processed`
4. Set redirect URLs:
   - `spotter://auth/callback`
   - Expo development callback URL
5. Apply migrations:
   - `supabase db push --include-all`
6. Deploy functions:
   - `supabase functions deploy health`
   - `supabase functions deploy onboarding-profile`
   - `supabase functions deploy matching-candidates`
   - `supabase functions deploy matching-request`
   - `supabase functions deploy matching-accept`
   - `supabase functions deploy matching-reject`
   - `supabase functions deploy sessions-propose`
   - `supabase functions deploy sessions-confirm`
   - `supabase functions deploy sessions-cancel`
   - `supabase functions deploy sessions-feedback`
   - `supabase functions deploy chat-send`
   - `supabase functions deploy videos-presign`
   - `supabase functions deploy videos-analysis`
   - `supabase functions deploy videos-enqueue-processing`
   - `supabase functions deploy videos-process-next`
   - `supabase functions deploy progress-generate`
   - `supabase functions deploy progress-snapshots`
   - `supabase functions deploy admin-process-deletion`

# Spotter

Monorepo for Spotter mobile app, backend functions, and shared packages.

## Quickstart

1. Install dependencies:
   - `pnpm install`
2. Copy env file:
   - `cp .env.example .env.local`
3. Start mobile app:
   - `pnpm mobile:dev`
   - or launch web + iOS simulator + Android emulator browser:
     - `pnpm mobile:launch:all`
4. Run Supabase local stack (if Supabase CLI installed):
   - `pnpm --filter @spotter/functions supabase:start`

## Local end-to-end workflow

1. Bootstrap local Supabase and seed data:
   - `pnpm local:up`
2. Serve edge functions:
   - `pnpm functions:serve`
3. Export local keys:
   - `eval "$(cd apps/functions && supabase status -o env)"`
4. Run smoke tests:
   - `pnpm smoke:local`
5. Stop local stack:
   - `pnpm local:down`

## Tests

- All workspaces: `pnpm test`
- Mobile tests only: `pnpm --filter @spotter/mobile test`
- Functions tests only: `pnpm --filter @spotter/functions test`
- Env template checks: `pnpm env:validate`

## Core APIs implemented

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
- `progress-generate`
- `progress-snapshots`
- `mcp-booking-plan`
- `networking-invite-send`
- `sponsors-event-create`
- `sponsors-event-list`
- `sponsors-event-invite-locals`
- `sponsors-event-rsvp`

## Demo Mode

If required env vars are missing, the app now offers `Continue in Demo Mode` so you can validate UI flows for:
- Networking recommendations
- Sponsored event creation/listing
- Local invite + RSVP actions

## Auth reliability notes

1. Mobile runtime env is synced from root `.env.local` before launch via:
   - `/Users/brucewayne/Documents/Spotter/scripts/local/sync-mobile-env.sh`
2. `EXPO_PUBLIC_API_BASE_URL` can be either:
   - `http://127.0.0.1:54321`
   - or `http://127.0.0.1:54321/functions/v1`
   Function URL construction is normalized at runtime.

## Workspace layout

- `apps/mobile`: Expo React Native app
- `apps/functions`: Supabase Edge Functions + config
- `apps/web-admin`: Next.js placeholder for coach portal
- `packages/db`: SQL migrations, seeds, and RLS checks
- `packages/types`: Shared TypeScript contracts
- `docs/adr`: Architecture Decision Records
- `docs/research`: Research memos

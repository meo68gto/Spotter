# Local Development Workflow

## Prerequisites
- Docker Desktop running
- Supabase CLI installed
- `pnpm install` completed

## Start local stack
- `pnpm local:up`

This runs:
- `supabase start`
- `supabase db reset` (applies migrations and seed)

## Serve Edge Functions
In a second terminal:
- `pnpm functions:serve`

## Run reproducible smoke tests
In a third terminal:
1. Export local credentials from Supabase CLI:
   - `eval "$(cd apps/functions && supabase status -o env)"`
2. Run smoke checks:
   - `pnpm smoke:local`

The smoke suite validates:
- Auth signup/token flow
- `onboarding-profile`
- `matching-candidates` + `matching-request` + `matching-accept`
- `sessions-propose` + `sessions-confirm`
- `chat-send`

## Video queue worker simulation
1. Set worker token in env:
   - `export VIDEO_WORKER_TOKEN=dev-worker-token`
2. Call worker function:
   - `curl -X POST \"$SUPABASE_URL/functions/v1/videos-process-next\" -H \"x-worker-token: $VIDEO_WORKER_TOKEN\" -H \"Content-Type: application/json\" -d '{\"mode\":\"simulate_success\"}'`

## Stop stack
- `pnpm local:down`

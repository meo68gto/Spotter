# Spotter Coaching Beta

Mobile-first coaching marketplace. Find coaches, book paid sessions, and manage your coaching relationships.

## What's in the Beta

- **Home** - Dashboard with quick actions
- **Coaching** - Browse coaches and coaching hub
- **Ask** - Get quick answers from coaches
- **Requests** - Incoming and outgoing coaching requests
- **Sessions** - Upcoming and past coaching sessions
- **Profile** - Your account and preferences

## Quickstart

```bash
pnpm install
cp .env.example .env.local
pnpm mobile:dev
```

## Local Development

```bash
# Start Supabase local stack
pnpm local:up

# Serve edge functions
pnpm functions:serve

# Run smoke tests
pnpm smoke:local
```

## Release

Build via EAS: `cd apps/mobile && eas build`

## Workspace

- `apps/mobile` - Expo React Native app
- `apps/functions` - Supabase Edge Functions
- `packages/db` - Database migrations
- `packages/types` - Shared TypeScript types

## Future Scope (Not in Beta)

- Networking and matching features
- Events and sponsored events
- Video pipeline and progress tracking
- Expert console and call room

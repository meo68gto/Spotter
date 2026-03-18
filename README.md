# Spotter Coaching Beta

Mobile-first coaching marketplace. Find coaches, book paid sessions, and manage your coaching relationships.

## What's in the Beta

- **Home** - Quick actions and session overview
- **Discover** - Browse coaches with filters
- **Coaching** - Your coaching hub
- **Requests** - Incoming and outgoing requests
- **Sessions** - Upcoming and past sessions
- **Inbox** - Messages with coaches
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

## Release Setup

Before building for distribution:

1. Create EAS project: `cd apps/mobile && eas init`
2. Update `app.json` with the real `projectId`
3. Configure signing certificates in EAS

## Workspace

- `apps/mobile` - Expo React Native app
- `apps/functions` - Supabase Edge Functions
- `apps/web-admin` - Coach portal (placeholder)
- `packages/db` - Database migrations
- `packages/types` - Shared TypeScript types

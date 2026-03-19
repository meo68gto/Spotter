# Spotter Web App

Web application for Spotter Organizer Portal and admin functions.

## Overview

Next.js web application providing:
- Organizer Dashboard
- Event management
- Registration management
- Analytics
- Admin functions

**Status:** In development

## Planned Features

### Organizer Portal

- Dashboard with statistics
- Event creation and management
- Registration tracking
- Check-in functionality
- Analytics and reports

### Admin Functions

- User management
- Tier management
- Course management
- System settings

## Tech Stack (Planned)

- **Framework**: Next.js 14
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **State**: Zustand/React Query
- **Auth**: Supabase Auth

## Project Structure (Planned)

```
apps/web/
├── app/                 # Next.js App Router
│   ├── (auth)/         # Auth group
│   │   ├── login/
│   │   └── register/
│   │
│   ├── (organizer)/    # Organizer portal
│   │   ├── dashboard/
│   │   ├── events/
│   │   ├── registrations/
│   │   └── analytics/
│   │
│   └── (admin)/        # Admin functions
│       ├── users/
│       ├── courses/
│       └── settings/
│
├── components/          # Shared components
├── lib/                # Utilities
└── package.json
```

## Development

```bash
# Install dependencies
pnpm install

# Start development server
pnpm dev

# Build
pnpm build

# Type check
pnpm typecheck
```

## API Integration

Uses same Supabase backend as mobile app:
- Supabase client
- Edge functions
- Realtime subscriptions

## Related

- [Mobile App](../mobile/)
- [API Documentation](../../docs/api/)
- [Root README](../../README.md)

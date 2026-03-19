# Spotter Types

Shared TypeScript types for Spotter.

## Overview

Centralized type definitions used across:
- Mobile app
- Edge functions
- Web app (future)

## Project Structure

```
packages/types/
└── src/
    ├── index.ts              # Main exports
    ├── tier.ts               # Tier system types
    ├── profile.ts            # Profile types
    ├── organizer.ts          # Organizer types
    ├── golf.ts               # Golf types
    ├── connections.ts        # Connection types
    ├── reputation.ts         # Reputation types
    ├── events.ts             # Event types
    └── inbox.ts              # Inbox types
```

## Usage

```bash
# Install in app/package
pnpm add @spotter/types

# Import
import { UserProfile, MembershipTier } from '@spotter/types';
```

## Key Types

### Tier System

```typescript
// tier.ts
export type TierSlug = 'free' | 'select' | 'summit';

export interface MembershipTier {
  id: string;
  name: string;
  slug: TierSlug;
  priceCents: number;
  billingInterval: 'monthly' | 'annual' | 'lifetime';
  features: TierFeatures;
}

export interface TierFeatures {
  maxConnections: number | null;
  maxRoundsPerMonth: number | null;
  canCreateRounds: boolean;
  canSendIntros: boolean;
  priorityBoosts: boolean;
}
```

### Profile

```typescript
// profile.ts
export interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  bio: string | null;
  professionalIdentity: ProfessionalIdentity;
  golfIdentity: GolfIdentity;
  tier: MembershipTier;
  reputation: ReputationScore;
}

export interface ProfessionalIdentity {
  company: string | null;
  title: string | null;
  industry: string | null;
  yearsExperience: number | null;
}

export interface GolfIdentity {
  handicap: number | null;
  homeCourseId: string | null;
  homeCourseName: string | null;
  playingFrequency: string | null;
  yearsPlaying: number | null;
}
```

### Golf

```typescript
// golf.ts
export interface GolfCourse {
  id: string;
  name: string;
  city: string;
  state: string;
  parTotal: number;
  courseRating: number;
  slopeRating: number;
  difficulty: 'easy' | 'moderate' | 'challenging' | 'expert';
}

export interface GolfRound {
  id: string;
  courseId: string;
  organizerId: string;
  roundDate: string;
  teeTime: string;
  format: GolfRoundFormat;
  status: GolfRoundStatus;
  totalSpots: number;
  spotsAvailable: number;
}
```

## Constants

### Tier Definitions

```typescript
export const TIERS: Record<TierSlug, TierConfig> = {
  free: {
    maxConnections: 50,
    maxRoundsPerMonth: 0,
    canCreateRounds: false,
  },
  select: {
    maxConnections: 500,
    maxRoundsPerMonth: 4,
    canCreateRounds: true,
  },
  summit: {
    maxConnections: null, // unlimited
    maxRoundsPerMonth: null, // unlimited
    canCreateRounds: true,
  },
};
```

### Enums

```typescript
export const CONNECTION_TYPES = [
  'played_together',
  'introduced',
  'met_offline',
  'online_only',
] as const;

export type ConnectionType = typeof CONNECTION_TYPES[number];
```

## Type Guards

```typescript
// tier.ts
export function isValidTier(tier: string): tier is TierSlug {
  return ['free', 'select', 'summit'].includes(tier);
}

export function canUpgrade(from: TierSlug, to: TierSlug): boolean {
  const order = { free: 0, select: 1, summit: 2 };
  return order[to] > order[from];
}
```

## Development

```bash
# Install dependencies
pnpm install

# Build
pnpm build

# Type check
pnpm typecheck

# Test
pnpm test

# Watch mode
pnpm dev
```

## Publishing

```bash
# Build
pnpm build

# Publish
pnpm publish

# Or version + publish
pnpm version patch
pnpm publish
```

## Adding New Types

1. Create file in `src/`
2. Export from `index.ts`
3. Add tests
4. Update documentation

Example:

```typescript
// src/new-feature.ts
export interface NewFeature {
  id: string;
  name: string;
}

// src/index.ts
export * from './new-feature';
```

## Related

- [Database Schema](../../packages/db/)
- [API Documentation](../../docs/api/)
- [Root README](../../README.md)

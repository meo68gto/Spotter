# Spotter Mobile App

Expo React Native app for Spotter Golf Networking.

## Overview

Mobile app for iOS and Android providing:
- User authentication (OTP)
- Profile management
- Golf round discovery and creation
- Connection networking
- Event registration
- Inbox messaging

## Tech Stack

- **Framework**: Expo ~50.0.0
- **Platform**: React Native 0.73
- **Language**: TypeScript ^5.3
- **Navigation**: React Navigation ^6.1
- **State**: Zustand ^4.4
- **Data Fetching**: React Query ^5.0
- **Styling**: NativeWind ^4.0 (Tailwind for RN)

## Project Structure

```
apps/mobile/
├── src/
│   ├── screens/        # Screen components
│   │   ├── HomeScreen.tsx
│   │   ├── ProfileScreen.tsx
│   │   ├── GolfScreen.tsx
│   │   ├── NetworkScreen.tsx
│   │   └── ...
│   │
│   ├── components/     # Shared components
│   │   ├── Button.tsx
│   │   ├── Card.tsx
│   │   ├── Input.tsx
│   │   └── ...
│   │
│   ├── hooks/          # Custom React hooks
│   │   ├── useAuth.ts
│   │   ├── useProfile.ts
│   │   ├── useRounds.ts
│   │   └── ...
│   │
│   ├── stores/         # Zustand stores
│   │   ├── authStore.ts
│   │   ├── profileStore.ts
│   │   └── ...
│   │
│   ├── api/            # API client
│   │   ├── client.ts
│   │   ├── auth.ts
│   │   ├── profile.ts
│   │   └── ...
│   │
│   ├── utils/          # Utilities
│   │   ├── constants.ts
│   │   ├── helpers.ts
│   │   └── ...
│   │
│   └── theme.ts        # Theme/styling
│
├── App.tsx             # Entry point
├── app.json            # Expo config
├── eas.json            # EAS build config
└── package.json
```

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm 8+
- iOS Simulator (Mac) or Android Emulator

### Installation

```bash
# From repo root
pnpm install

# Or from this directory
cd apps/mobile
pnpm install
```

### Environment Setup

Create `.env.local`:

```bash
SUPABASE_URL=http://localhost:54321
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIs...
```

Get the anon key from your local Supabase (see root README).

### Running

```bash
# Start development server
pnpm dev

# iOS
pnpm dev:ios

# Android
pnpm dev:android
```

Scan QR code with:
- **iOS**: Camera app → Expo Go
- **Android**: Expo Go app → Scan QR

## Key Features

### Authentication

- OTP-based login (no passwords)
- Automatic FREE tier assignment
- Session management with refresh tokens

### Profile

- Extended profile with professional + golf identity
- Profile completeness tracking
- Reputation score display

### Golf

- Browse available rounds
- Create rounds (SELECT+)
- Join rounds
- Course discovery

### Networking

- Connection requests
- Same-tier visibility
- Introductions (SELECT+)
- Connection management

### Events

- Event browsing
- Registration (SELECT+)
- Ticket management

## State Management

Using Zustand for global state:

```typescript
// stores/authStore.ts
import { create } from 'zustand';

interface AuthState {
  session: Session | null;
  user: User | null;
  setSession: (session: Session) => void;
  signOut: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  user: null,
  setSession: (session) => set({ session, user: session.user }),
  signOut: () => set({ session: null, user: null }),
}));
```

## API Integration

Using React Query for data fetching:

```typescript
// hooks/useProfile.ts
import { useQuery } from '@tanstack/react-query';

export function useProfile(userId?: string) {
  return useQuery({
    queryKey: ['profile', userId],
    queryFn: () => api.profile.get(userId),
  });
}
```

## Navigation

Stack + Tab navigation structure:

```
Root Stack
├── Auth Stack (when logged out)
│   ├── Welcome
│   ├── EmailInput
│   └── OTPVerify
│
└── Main Tabs (when logged in)
    ├── Home
    ├── Golf
    ├── Network
    └── Profile
```

## Testing

```bash
# Unit tests
pnpm test

# With coverage
pnpm test --coverage

# E2E tests
pnpm e2e

# Specific platform
pnpm e2e:ios
pnpm e2e:android
```

## Building

```bash
# Development build
pnpm build:dev

# Preview build (TestFlight/Internal)
pnpm build:preview

# Production build
pnpm build:production
```

## Deployment

```bash
# OTA update
pnpm update:production

# Build and submit to stores
pnpm deploy:production
```

## Code Style

- ESLint + Prettier configured
- TypeScript strict mode
- Component props typed
- Custom hooks for logic

```bash
# Lint
pnpm lint

# Format
pnpm format

# Type check
pnpm typecheck
```

## Troubleshooting

### Metro bundler issues

```bash
# Clear cache
pnpm clean
watchman watch-del-all
```

### iOS build fails

```bash
# Reset simulator
xcrun simctl erase all
```

### Android build fails

```bash
# Clean gradle
cd android && ./gradlew clean
```

See [Troubleshooting](../../docs/TROUBLESHOOTING.md) for more.

## Related

- [API Documentation](../../docs/api/)
- [Architecture](../../docs/dev/architecture.md)
- [Root README](../../README.md)

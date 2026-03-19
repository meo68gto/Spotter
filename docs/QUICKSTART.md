# Quick Start Guide

Get the Spotter platform running locally in 5 minutes.

## Prerequisites

- **Node.js** 18+ ([download](https://nodejs.org))
- **pnpm** 8+ (`npm install -g pnpm`)
- **Docker** ([download](https://docker.com))
- **iOS Simulator** (Mac) or **Android Emulator**

## 5-Minute Setup

### 1. Clone and Install (1 minute)

```bash
# Clone repository
git clone https://github.com/spotter-golf/spotter.git
cd spotter

# Install dependencies
pnpm install
```

### 2. Start Local Supabase (2 minutes)

```bash
# Start local Supabase stack
pnpm local:up

# Wait for "Started supabase local development setup"
```

This starts:
- PostgreSQL database
- Supabase Studio (http://localhost:54323)
- Edge Functions runtime
- Auth service
- Storage

### 3. Verify Installation (1 minute)

```bash
# Run smoke tests
pnpm smoke:local
```

You should see:
```
✓ Database connected
✓ Auth service responding
✓ Edge functions deployed
✓ All smoke tests passed
```

### 4. Start Mobile App (1 minute)

```bash
# Start Expo development server
pnpm mobile:dev
```

QR code appears. Scan with:
- **iOS**: Camera app → Expo Go
- **Android**: Expo Go app → Scan QR

App opens on device/simulator!

## First Steps

### Create Test Account

1. Open app → Tap "Get Started"
2. Enter email: `test@spotter.local`
3. Check Supabase Studio → Inbucket (http://localhost:54324)
4. Find OTP email → Use code to verify
5. You're in! FREE tier assigned automatically.

### Explore Features

**Home Tab:**
- Dashboard with quick actions

**Golf Tab:**
- Browse seeded courses (10 Arizona courses)
- View sample rounds (if created)

**Network Tab:**
- Your connections (empty for new user)
- Discover other test users

**Profile Tab:**
- View/edit profile
- Check tier status (FREE)

### Create Test Data

```bash
# Seed additional test data
pnpm db:seed:local

# Creates:
# - 5 test users (FREE, SELECT, SUMMIT tiers)
# - Sample rounds
# - Sample connections
```

## Common Commands

```bash
# Start services
pnpm local:up          # Supabase stack
pnpm mobile:dev        # Mobile app
pnpm functions:serve   # Functions only

# Testing
pnpm smoke:local       # Quick health check
pnpm test             # Unit tests
pnpm e2e              # E2E tests

# Database
pnpm db:reset         # Reset local DB
pnpm db:seed          # Add seed data
pnpm db:migrate       # Run migrations

# Code quality
pnpm lint             # ESLint
pnpm typecheck        # TypeScript
pnpm format           # Prettier
```

## Project Structure

```
spotter/
├── apps/
│   ├── mobile/          # React Native app
│   │   ├── src/
│   │   │   ├── screens/     # Screen components
│   │   │   ├── components/  # Shared UI
│   │   │   └── stores/      # State management
│   │   └── App.tsx
│   │
│   └── functions/       # Supabase Edge Functions
│       └── supabase/functions/
│           ├── auth-otp/        # Authentication
│           ├── profile-get/     # Profile API
│           ├── tier-assignment/ # Tier management
│           └── ...
│
├── packages/
│   ├── db/              # Database migrations
│   │   └── migrations/
│   └── types/           # Shared TypeScript types
│
└── docs/                # Documentation
```

## Development Workflow

### Making Changes

1. **Start local stack:**
```bash
pnpm local:up
```

2. **Make code changes**

3. **Test changes:**
```bash
pnpm smoke:local
```

4. **Create PR** (follow [Contributing Guide](./dev/contributing.md))

### Hot Reload

- **Mobile**: Changes refresh automatically
- **Functions**: `pnpm functions:serve` auto-reloads
- **Database**: Migrations require restart

## Troubleshooting

### Port Conflicts

```bash
# Supabase uses these ports by default:
# 54321 - API
# 54322 - Database
# 54323 - Studio
# 54324 - Inbucket (email)

# If ports in use:
pkill -f supabase
pnpm local:up
```

### Mobile App Won't Start

```bash
# Clear cache
pnpm clean

# Reinstall dependencies
rm -rf node_modules
pnpm install

# Restart
pnpm mobile:dev
```

### Database Connection Failed

```bash
# Check Docker is running
docker ps

# Reset local stack
pnpm local:stop
pnpm local:up

# Full reset
pnpm local:reset
```

### Functions Not Working

```bash
# Redeploy functions
pnpm functions:deploy:local

# Check logs
supabase functions logs
```

## Next Steps

### Learn More

- [API Documentation](./api/README.md) - API reference
- [Architecture Guide](./dev/architecture.md) - System design
- [Database Schema](./dev/database.md) - Data model

### Customize

- Edit `apps/mobile/src/theme.ts` for styling
- Modify `packages/db/migrations/` for schema changes
- Add new functions in `apps/functions/`

### Deploy

- [Deployment Guide](./dev/deployment.md) - Production setup
- [Testing Guide](./dev/testing.md) - Testing procedures

## Support

Stuck? Try these resources:

- **Documentation**: `/docs` folder
- **Issues**: GitHub Issues
- **Discord**: [Join our community](https://discord.gg/spotter)

## Environment Overview

| Service | Local URL | Credentials |
|---------|-----------|-------------|
| **App** | Metro dev server | N/A |
| **API** | http://localhost:54321 | anon key in `.env` |
| **Database** | postgresql://localhost:54322 | postgres/postgres |
| **Studio** | http://localhost:54323 | No auth |
| **Email** | http://localhost:54324 | View emails in UI |

Happy coding! 🏌️

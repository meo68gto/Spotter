# Spotter

Spotter is a mobile-first golf networking platform with tier-based membership. Find golf partners, track your game, and build your golf network.

## Features

- **Tier-Based Membership** - FREE, SELECT, and SUMMIT tiers with different features
- **Same-Tier Networking** - Connect with golfers in your tier
- **Golf Rounds** - Create and join golf rounds (SELECT+)
- **Tournaments** - Register for events (SELECT+)
- **Reputation System** - Build trust through ratings and activity
- **Organizer Portal** - Bronze/Silver/Gold tiers for tournament management
- **Coaching Marketplace** - Book sessions with golf coaches (SELECT+)

## Tech Stack

- **Mobile**: Expo React Native
- **Backend**: Supabase (PostgreSQL + Edge Functions)
- **Auth**: OTP-based (no passwords)
- **Payments**: Stripe
- **Realtime**: Supabase Realtime

## Quick Start

```bash
# 1. Clone and install
git clone https://github.com/spotter-golf/spotter.git
cd spotter
pnpm install

# 2. Start local Supabase
pnpm local:up

# 3. Verify installation
pnpm smoke:local

# 4. Start mobile app
pnpm mobile:dev
```

[Full Quick Start Guide](./docs/QUICKSTART.md)

## Project Structure

```
spotter/
├── apps/
│   ├── mobile/              # Expo React Native app
│   └── functions/           # Supabase Edge Functions
├── packages/
│   ├── db/                  # Database migrations
│   └── types/               # Shared TypeScript types
└── docs/                    # Documentation
```

## Documentation

- [Quick Start](./docs/QUICKSTART.md) - Get running in 5 minutes
- [API Documentation](./docs/api/) - API reference
- [User Guides](./docs/guides/) - Member and organizer guides
- [Developer Docs](./docs/dev/) - Architecture, testing, deployment
- [Troubleshooting](./docs/TROUBLESHOOTING.md) - Common issues

## Development

```bash
# Start local stack
pnpm local:up

# Run smoke tests
pnpm smoke:local

# Run unit tests
pnpm test

# Type check
pnpm typecheck

# Lint
pnpm lint
```

See [Contributing Guide](./docs/dev/contributing.md) for development workflow.

## Architecture

**Same-Tier Visibility** - Members can only see and connect with other members in their tier. Enforced at the database level via RLS policies.

**Membership Tiers:**
- **FREE** - Basic features, 50 connections max
- **SELECT** ($1,000/year) - Extended profile, unlimited discovery, create rounds
- **SUMMIT** ($10,000 lifetime) - Unlimited everything, priority features

See [Architecture Guide](./docs/dev/architecture.md) for detailed system design.

## Deployment

- **Mobile**: EAS (Expo Application Services)
- **Backend**: Supabase Cloud
- **Edge Functions**: Supabase Functions
- **Database**: Supabase PostgreSQL

See [Deployment Guide](./docs/dev/deployment.md) for production setup.

## Environment Variables

```bash
# Supabase
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Stripe
STRIPE_SECRET_KEY=
STRIPE_PUBLISHABLE_KEY=
STRIPE_WEBHOOK_SECRET=

# Email
SMTP_HOST=
SMTP_USER=
SMTP_PASS=
```

## Testing

```bash
# Smoke tests
pnpm smoke:local

# Unit tests
pnpm test

# Integration tests
pnpm functions:test

# E2E tests
pnpm e2e
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests
5. Submit a pull request

See [Contributing Guide](./docs/dev/contributing.md) for details.

## Support

- Documentation: [docs.spotter.golf](https://docs.spotter.golf)
- Issues: GitHub Issues
- Discord: [discord.gg/spotter](https://discord.gg/spotter)
- Email: hello@spotter.golf

## License

Proprietary. All rights reserved.

---

Built with ❤️ for golfers everywhere.

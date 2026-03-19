# System Architecture

Technical overview of the Spotter platform architecture.

## Overview

Spotter is a mobile-first golf networking platform built with:
- **Frontend**: Expo React Native (mobile)
- **Backend**: Supabase (PostgreSQL + Edge Functions)
- **Auth**: Supabase Auth (OTP-based)
- **Payments**: Stripe
- **Realtime**: Supabase Realtime

## System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLIENT LAYER                           │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │  iOS App     │  │  Android App   │  │  Web (Future)│          │
│  │  (Expo)      │  │  (Expo)        │  │              │          │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘          │
└─────────┼─────────────────┼─────────────────┼───────────────────┘
          │                 │                 │
          └─────────────────┼─────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────────┐
│                      API GATEWAY LAYER                             │
│                    (Supabase Edge Functions)                     │
├──────────────────────────────────────────────────────────────────┤
│  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐    │
│  │ auth-otp   │ │ profile-*  │ │ tier-*     │ │ round-*    │    │
│  │            │ │            │ │            │ │            │    │
│  └────────────┘ └────────────┘ └────────────┘ └────────────┘    │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐    │
│  │ connection │ │ event-*    │ │ organizer-*│ │ inbox-*    │    │
│  │            │ │            │ │            │ │            │    │
│  └────────────┘ └────────────┘ └────────────┘ └────────────┘    │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐                   │
│  │ stripe-web │ │ reputation │ │ search     │                   │
│  │ hook       │ │            │ │            │                   │
│  └────────────┘ └────────────┘ └────────────┘                   │
└─────────────────────────────────────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────────┐
│                      DATA LAYER                                  │
│                      (Supabase PostgreSQL)                       │
├──────────────────────────────────────────────────────────────────┤
│  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐   │
│  │ users      │ │ membership │ │ golf_      │ │ golf_rounds│   │
│  │            │ │ _tiers     │ │ courses    │ │            │   │
│  └────────────┘ └────────────┘ └────────────┘ └────────────┘   │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐   │
│  │ round_     │ │ connections│ │ reputation │ │ events     │   │
│  │ participants│ │            │ │ _scores    │ │            │   │
│  └────────────┘ └────────────┘ └────────────┘ └────────────┘   │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐   │
│  │ event_     │ │ organizers │ │ inbox_     │ │ tier_      │   │
│  │ registrations│ │            │ │ threads    │ │ history    │   │
│  └────────────┘ └────────────┘ └────────────┘ └────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────────┐
│                   EXTERNAL SERVICES                              │
├──────────────────────────────────────────────────────────────────┤
│  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐  │
│  │ Stripe     │ │ SendGrid   │ │ Supabase   │ │ Expo       │  │
│  │ (Payments) │ │ (Email)    │ │ Auth       │ │ Push       │  │
│  └────────────┘ └────────────┘ └────────────┘ └────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

## Technology Stack

### Frontend

| Technology | Purpose | Version |
|------------|---------|---------|
| Expo | React Native framework | ~50.0.0 |
| React Native | Mobile UI | 0.73 |
| TypeScript | Type safety | ^5.3 |
| React Navigation | Navigation | ^6.1 |
| React Query | Data fetching | ^5.0 |
| Zustand | State management | ^4.4 |
| NativeWind | Tailwind for RN | ^4.0 |

### Backend

| Technology | Purpose | Version |
|------------|---------|---------|
| Supabase | Backend-as-a-Service | ^2.39 |
| PostgreSQL | Database | 15 |
| Deno | Edge Functions | 1.39 |
| PostgREST | Auto-generated API | Latest |
| Realtime | WebSocket subscriptions | Latest |

### Infrastructure

| Service | Purpose |
|---------|---------|
| Supabase Cloud | Database + Functions |
| Stripe | Payment processing |
| SendGrid | Transactional email |
| Expo EAS | Build + OTA updates |
| GitHub Actions | CI/CD |

## Project Structure

```
spotter/
├── apps/
│   ├── mobile/              # Expo React Native app
│   │   ├── src/
│   │   │   ├── screens/   # Screen components
│   │   │   ├── components/ # Reusable components
│   │   │   ├── hooks/     # Custom React hooks
│   │   │   ├── stores/    # Zustand stores
│   │   │   ├── api/       # API client
│   │   │   └── utils/     # Utilities
│   │   ├── App.tsx
│   │   └── package.json
│   │
│   └── functions/           # Supabase Edge Functions
│       └── supabase/
│           └── functions/
│               ├── _shared/ # Shared utilities
│               ├── auth-otp/
│               ├── profile-get/
│               ├── tier-assignment/
│               ├── round-create/
│               ├── connection-request/
│               ├── stripe-webhook/
│               └── ...
│
├── packages/
│   ├── db/                  # Database migrations
│   │   └── migrations/
│   │       ├── 0001_initial.sql
│   │       ├── 0014_tier_system.sql
│   │       ├── 0015_golf_schema.sql
│   │       ├── 0016_login_system.sql
│   │       └── 0017_profile_networking.sql
│   │
│   └── types/               # Shared TypeScript types
│       └── src/
│           ├── index.ts
│           ├── tier.ts
│           ├── profile.ts
│           ├── organizer.ts
│           └── ...
│
├── docs/                    # Documentation
│   ├── api/
│   ├── guides/
│   └── dev/
│
├── package.json            # Root workspace config
├── pnpm-workspace.yaml     # PNPM workspace
└── turbo.json              # Turbo build config
```

## Data Flow

### Authentication Flow

```
1. User enters email
2. Client → POST /auth-otp (action: signup/signin)
3. Edge Function → Supabase Auth
4. Supabase Auth → SendGrid (OTP email)
5. User enters OTP
6. Client → POST /auth-otp (action: verify)
7. Edge Function → Supabase Auth (verify)
8. Supabase Auth → Returns session
9. Edge Function → tier-assignment (assign FREE tier)
10. Returns user + session to client
```

### Profile Fetch Flow

```
1. Client → GET /profile/get (with JWT)
2. Edge Function → Verify JWT
3. Edge Function → Query users table
4. Edge Function → Query professional_identity
5. Edge Function → Query golf_identity
6. Edge Function → Query reputation_scores
7. Edge Function → Check tier visibility
8. Returns aggregated profile to client
```

### Round Creation Flow (SELECT+)

```
1. Client → POST /round-create (with JWT)
2. Edge Function → Verify JWT
3. Edge Function → Check tier (SELECT+)
4. Edge Function → Check rounds per month limit
5. Edge Function → Insert into golf_rounds
6. Edge Function → Insert organizer as participant
7. Database Trigger → Update spots_available
8. Returns round data to client
9. Realtime → Broadcast to same-tier members
```

## Database Architecture

### Schema Design Principles

1. **Same-Tier Visibility**: Enforced via RLS policies
2. **Soft Deletes**: Use status fields, not DELETE
3. **Audit Trails**: History tables for important changes
4. **Computed Fields**: Triggers for calculated values
5. **JSONB Flexibility**: For extensible data

### Key Tables

#### users
- Core user data
- Tier assignment
- Profile completeness tracking

#### membership_tiers
- Tier definitions (FREE, SELECT, SUMMIT)
- Feature flags
- Pricing

#### golf_courses
- Course information
- Location (PostGIS)
- Amenities

#### golf_rounds
- Round details
- Organizer reference
- Spots management
- Status tracking

#### connections
- Member networking
- Status (pending, accepted, declined, blocked)
- Tier at connection time

#### reputation_scores
- Calculated reputation
- Component scores
- Recalculation tracking

### RLS Policies

Row Level Security enforces same-tier visibility:

```sql
-- Example: Users can only see same-tier profiles
CREATE POLICY users_select_same_tier ON users
  FOR SELECT USING (
    auth.uid() = id
    OR tier_id = (
      SELECT tier_id FROM users WHERE id = auth.uid()
    )
  );
```

## Edge Functions Architecture

### Function Categories

| Category | Functions | Auth |
|----------|-----------|------|
| **Auth** | auth-otp | None |
| **Profile** | profile-get, profile-update | JWT |
| **Tier** | tier-assignment, tier-upgrade | JWT/Service |
| **Golf** | round-create, round-join, round-list | JWT |
| **Network** | connection-request, connection-respond | JWT |
| **Events** | event-register, event-list | JWT |
| **Organizer** | organizer-create, organizer-event-create | JWT |
| **Inbox** | inbox-send, inbox-list | JWT |
| **Webhooks** | stripe-webhook | Signature |

### Shared Code

Common utilities in `functions/_shared/`:
- `cors.ts` - CORS headers
- `tier-gate.ts` - Tier validation
- `supabase.ts` - Client initialization
- `errors.ts` - Error handling

## Realtime Subscriptions

### Use Cases

- New rounds in your tier
- Connection requests
- Round participant updates
- Inbox messages
- Event registration updates

### Implementation

```typescript
// Client subscribes to changes
const subscription = supabase
  .channel('golf_rounds')
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'golf_rounds'
  }, (payload) => {
    // Handle new round
  })
  .subscribe();
```

## Security Architecture

### Authentication

- JWT tokens (Supabase Auth)
- OTP-based (no passwords)
- Automatic session refresh
- Device tracking

### Authorization

- RLS policies at database level
- Tier checks in Edge Functions
- Same-tier visibility enforcement
- Role-based access (organizers)

### Data Protection

- Encryption at rest (Supabase)
- TLS in transit
- No sensitive data in logs
- PII minimization

## Scalability Considerations

### Database

- Read replicas for queries
- Connection pooling
- Query optimization
- Indexing strategy

### Edge Functions

- Stateless design
- No local storage
- Idempotent operations
- Rate limiting

### Caching

- React Query for client caching
- Supabase caching for API
- CDN for static assets

## Monitoring & Observability

### Logging

- Edge Function logs (Supabase)
- Client error tracking (Sentry)
- Database query logs

### Metrics

- Function execution time
- Database query performance
- API error rates
- User engagement

### Alerting

- Error rate thresholds
- Performance degradation
- Database connection limits

## Deployment

### Mobile App

```bash
# Development
pnpm mobile:dev

# Build
cd apps/mobile && eas build

# OTA Updates
pnpm mobile:update
```

### Edge Functions

```bash
# Local development
pnpm functions:serve

# Deploy
pnpm functions:deploy
```

### Database Migrations

```bash
# Local
pnpm db:migrate

# Production
pnpm db:deploy
```

## Environment Configuration

### Required Variables

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

# App
APP_URL=
API_URL=
```

## Related Documentation

- [Database Schema](./database.md)
- [Testing Guide](./testing.md)
- [Deployment Guide](./deployment.md)

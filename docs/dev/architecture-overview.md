# Architecture Overview

High-level technical architecture of the Spotter platform.

## System Overview

Spotter is a mobile-first golf networking platform built on a modern, serverless architecture. The system prioritizes scalability, security, and rapid development.

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLIENT LAYER                            │
│                    ┌─────────────────────┐                      │
│                    │   React Native App  │                      │
│                    │   (Expo + TypeScript)│                      │
│                    │   iOS / Android     │                      │
│                    └──────────┬──────────┘                      │
└─────────────────────────────┼───────────────────────────────────┘
                              │
                              │ HTTPS / WebSocket
                              │
┌─────────────────────────────▼───────────────────────────────────┐
│                      API GATEWAY LAYER                            │
│                    (Supabase Edge Functions)                      │
│                                                                   │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐   │
│  │  auth-otp  │ │ profile-*  │ │ tier-*     │ │ round-*    │   │
│  │  (auth)    │ │  (user)    │ │ (billing)  │ │  (golf)    │   │
│  └────────────┘ └────────────┘ └────────────┘ └────────────┘   │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐   │
│  │ connection │ │  event-*   │ │ organizer-*│ │ inbox-*    │   │
│  │ (network)  │ │ (events)   │ │ (portal)   │ │ (chat)     │   │
│  └────────────┘ └────────────┘ └────────────┘ └────────────┘   │
│  ┌────────────┐ ┌────────────┐                                  │
│  │stripe-web  │ │ reputation │                                  │
│  │  (payments)│ │  (scoring) │                                  │
│  └────────────┘ └────────────┘                                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ SQL / Realtime
                              │
┌─────────────────────────────▼───────────────────────────────────┐
│                      DATA LAYER                                   │
│                      (Supabase PostgreSQL)                        │
│                                                                   │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐   │
│  │   users    │ │ membership │ │ golf_      │ │ golf_rounds│   │
│  │            │ │   _tiers   │ │  courses   │ │            │   │
│  └────────────┘ └────────────┘ └────────────┘ └────────────┘   │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐   │
│  │  round_    │ │connection  │ │reputation  │ │   events   │   │
│  │participants│ │            │ │  _scores   │ │            │   │
│  └────────────┘ └────────────┘ └────────────┘ └────────────┘   │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐   │
│  │  event_    │ │ organizers │ │ inbox_     │ │  tier_     │   │
│  │registrations│ │            │ │  threads   │ │  history   │   │
│  └────────────┘ └────────────┘ └────────────┘ └────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ API / Webhooks
                              │
┌─────────────────────────────▼───────────────────────────────────┐
│                   EXTERNAL SERVICES                               │
│                                                                   │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐   │
│  │   Stripe   │ │  SendGrid  │ │  Supabase  │ │   Expo     │   │
│  │ (Payments) │ │  (Email)   │ │    Auth    │ │  (Push)    │   │
│  └────────────┘ └────────────┘ └────────────┘ └────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

## Design Principles

### 1. Same-Tier Visibility

Core business logic enforced at every layer:
- **Database**: RLS policies prevent cross-tier data access
- **API**: Edge functions validate tier membership
- **Client**: UI shows appropriate features per tier

### 2. Serverless-First

- **No server management**: Supabase handles infrastructure
- **Auto-scaling**: Functions scale with demand
- **Pay-per-use**: Cost proportional to usage
- **Edge deployment**: Low latency globally

### 3. Type Safety

- **TypeScript**: Full type coverage
- **Shared types**: Packages/types shared across apps
- **Generated types**: Database types from schema
- **API contracts**: End-to-end type safety

### 4. Security by Design

- **RLS policies**: Row-level security in PostgreSQL
- **JWT validation**: Every request authenticated
- **Service roles**: Internal functions use elevated privileges
- **Webhook signatures**: Stripe webhooks verified

## Technology Stack

### Frontend

| Technology | Purpose | Rationale |
|------------|---------|-----------|
| **Expo** | React Native framework | Cross-platform, OTA updates |
| **React Native** | Mobile UI | Native performance |
| **TypeScript** | Type safety | Catch errors at compile time |
| **React Navigation** | Navigation | Industry standard |
| **React Query** | Data fetching | Caching, synchronization |
| **Zustand** | State management | Simple, effective |
| **NativeWind** | Styling | Tailwind for React Native |

### Backend

| Technology | Purpose | Rationale |
|------------|---------|-----------|
| **Supabase** | Backend-as-a-Service | Database + Auth + Functions |
| **PostgreSQL** | Database | Robust, full-featured |
| **Deno** | Edge Functions | Modern runtime, TypeScript native |
| **PostgREST** | Auto-generated API | Instant REST API |
| **Realtime** | WebSocket subscriptions | Live updates |

### Infrastructure

| Technology | Purpose | Rationale |
|------------|---------|-----------|
| **Supabase Cloud** | Hosting | Managed, scalable |
| **Stripe** | Payments | Industry standard |
| **SendGrid** | Email | Deliverability, templates |
| **Expo EAS** | Mobile builds | CI/CD for mobile |

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
3. Edge Function → Query users table (RLS enforced)
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
3. Edge Function → Check tier (SELECT+) via tier-gate.ts
4. Edge Function → Check rounds per month limit
5. Edge Function → Insert into golf_rounds
6. Edge Function → Insert organizer as participant
7. Database Trigger → Update spots_available
8. Returns round data to client
9. Realtime → Broadcast to same-tier members
```

### Stripe Payment Flow

```
1. Client → POST /tier-upgrade (target tier)
2. Edge Function → Create Stripe Checkout Session
3. Edge Function → Return checkout URL
4. User completes payment on Stripe
5. Stripe → POST /stripe-webhook (payment.success)
6. Edge Function → Verify signature
7. Edge Function → Update user tier
8. Edge Function → Insert tier_history record
9. Realtime → Notify client of tier change
```

## Database Architecture

### Schema Design

See [Database Schema](./database-schema.md) for complete details.

### Key Design Patterns

1. **RLS Policies**: Every table has RLS enforcing same-tier visibility
2. **Soft Deletes**: Status fields instead of DELETE
3. **Audit Tables**: History tracking for tier changes, etc.
4. **Computed Fields**: Triggers for calculated values
5. **JSONB Flexibility**: Extensible data without schema changes

### RLS Example

```sql
-- Users can only see same-tier profiles
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

| Category | Functions | Auth Required |
|----------|-----------|---------------|
| **Auth** | auth-otp | No |
| **Profile** | profile-get, profile-update | JWT |
| **Tier** | tier-assignment, tier-upgrade | JWT/Service |
| **Golf** | round-create, round-join, round-list | JWT |
| **Network** | connection-request, connection-respond | JWT |
| **Events** | event-register, event-list | JWT |
| **Organizer** | organizer-create, organizer-event-create | JWT |
| **Inbox** | inbox-send, inbox-list | JWT |
| **Webhooks** | stripe-webhook | Signature |

### Shared Code

```
functions/_shared/
├── cors.ts          # CORS headers for all functions
├── errors.ts        # Error handling utilities
├── supabase.ts      # Supabase client initialization
├── tier-gate.ts     # Tier validation functions
└── types.ts         # Shared TypeScript types
```

### Function Template

```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import { corsHeaders } from '../_shared/cors.ts';
import { TierGate } from '../_shared/tier-gate.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Validate auth
    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');
    
    if (!token) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: corsHeaders }
      );
    }

    // Verify JWT and get user
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: corsHeaders }
      );
    }

    // Check tier requirements
    const tierGate = new TierGate(supabase);
    const hasAccess = await tierGate.check(user.id, 'select');
    if (!hasAccess) {
      return new Response(
        JSON.stringify({ error: 'Tier upgrade required' }),
        { status: 403, headers: corsHeaders }
      );
    }

    // Process request
    const body = await req.json();
    // ... implementation

    return new Response(
      JSON.stringify({ data: result }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Function error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: corsHeaders }
    );
  }
});
```

## Realtime Architecture

### Use Cases

- **New rounds**: Instant notification to same-tier members
- **Connection requests**: Real-time updates
- **Round updates**: Spot availability changes
- **Inbox messages**: Live chat
- **Event registration**: Availability updates

### Implementation

```typescript
// Client subscription
const subscription = supabase
  .channel('golf_rounds')
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'golf_rounds'
  }, (payload) => {
    // Handle new round
    showNotification('New round available!', payload.new);
  })
  .subscribe();

// Cleanup
return () => {
  subscription.unsubscribe();
};
```

### Security

Realtime respects RLS policies:
- Client only receives changes they have SELECT permission for
- Same-tier visibility enforced automatically
- No additional auth needed (uses existing JWT)

## Scalability Considerations

### Database

- **Read replicas**: For heavy query loads
- **Connection pooling**: Supabase manages this
- **Query optimization**: Indexes on foreign keys, search fields
- **Caching**: React Query client-side, Supabase edge caching

### Edge Functions

- **Stateless design**: No local storage
- **No dependencies on execution environment**
- **Idempotent operations**: Safe to retry
- **Rate limiting**: Built into Supabase

### Mobile App

- **Offline support**: React Query cache
- **Optimistic updates**: UI updates before server response
- **Pagination**: Never load entire datasets
- **Image optimization**: Proper sizing, caching

## Security Architecture

### Authentication

- **JWT tokens**: Supabase Auth issued
- **Automatic refresh**: Token rotation
- **OTP-based**: No passwords to manage
- **Device tracking**: Session management

### Authorization

- **RLS policies**: Database-level enforcement
- **Tier checks**: Function-level validation
- **Role-based**: Organizer, admin roles
- **Resource ownership**: Users can only modify their data

### Data Protection

- **Encryption at rest**: Supabase PostgreSQL
- **TLS in transit**: All API calls HTTPS
- **No sensitive data in logs**: PII redacted
- **Webhook signatures**: Stripe HMAC verification

## Monitoring & Observability

### Logging

- **Edge Function logs**: Supabase dashboard
- **Client errors**: Sentry integration
- **Database logs**: Query performance
- **Audit log**: User actions tracked

### Metrics

- **Function execution time**: Performance tracking
- **Database query performance**: Slow query identification
- **API error rates**: Reliability monitoring
- **User engagement**: Business metrics

### Alerting

- **Error rate thresholds**: PagerDuty integration
- **Performance degradation**: Response time alerts
- **Database connection limits**: Capacity planning

## Deployment Architecture

### Environments

| Environment | Purpose | URL Pattern |
|-------------|---------|-------------|
| **Local** | Development | localhost:3000 |
| **Staging** | Testing | *.staging.spotter.golf |
| **Production** | Live | *.spotter.golf |

### Mobile App Deployment

```
Development → Preview → Production
     ↓           ↓          ↓
   Expo Go   TestFlight   App Store
             Play Console  Play Store
```

### Backend Deployment

```
Local → Staging → Production
  ↓         ↓          ↓
CLI    GitHub Actions   Production
```

## Related Documentation

- [Database Schema](./database-schema.md) - Complete schema reference
- [Testing Guide](./testing-guide.md) - Testing strategies
- [Deployment Guide](./deployment-guide.md) - Production deployment
- [API Documentation](../api/) - API reference

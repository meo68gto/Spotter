# Sprint 4 Complete: Tournament Organizer Portal (B2B)

**Status:** ✅ COMPLETE  
**Date:** 2026-03-18  
**Runtime:** ~5 minutes (parallel execution)

---

## Deliverables Summary

| Component | Files | Lines | Status |
|-----------|-------|-------|--------|
| **Database** | `0018_organizer_portal.sql` | 1,032 | ✅ Complete |
| **Types** | `organizer.ts` | 1,154 | ✅ Complete |
| **Edge Functions** | 7 functions | 3,503 | ✅ Complete |

**Total:** 5,689 lines of code

---

## Database Schema

### organizer_accounts - B2B Organizer Accounts
- `id`, `name`, `slug` (unique)
- `tier`: 'bronze' | 'silver' | 'gold'
- `contact_email`, `contact_phone`
- `website_url`, `logo_url`
- `billing_email`, `stripe_customer_id`
- `monthly_event_quota` (1, 5, or unlimited)
- `events_used_this_month`, `quota_resets_at`
- `is_active`, `is_verified`

### organizer_members - Staff Management
- `id`, `organizer_id`, `user_id`
- `role`: 'owner' | 'admin' | 'manager' | 'viewer'
- `permissions` (jsonb)
- `invited_at`, `joined_at`, `is_active`

### organizer_events - Event Management
- `id`, `organizer_id`, `name`, `slug`
- `event_type`: 'tournament' | 'scramble' | 'charity' | 'corporate' | 'social'
- `status`: 'draft' | 'published' | 'registration_open' | 'full' | 'in_progress' | 'completed' | 'cancelled'
- `course_id` (FK to golf_courses)
- `date`, `start_time`, `end_time`
- `max_participants`, `current_participants`
- `registration_opens_at`, `registration_closes_at`
- `price_cents`, `price_currency`
- `is_private`, `invite_only`
- `target_tiers` (jsonb) - which member tiers can see this

### organizer_event_registrations - Member Registrations
- `id`, `event_id`, `user_id`
- `status`: 'registered' | 'waitlisted' | 'confirmed' | 'checked_in' | 'no_show' | 'cancelled'
- `registered_at`, `confirmed_at`, `checked_in_at`
- `payment_status`: 'pending' | 'paid' | 'waived' | 'refunded'
- `payment_intent_id` (stripe)
- `notes`, `handicap_at_registration`

### organizer_invites - Direct Invites to Members
- `id`, `organizer_id`, `event_id` (nullable)
- `sender_id`, `recipient_email`, `recipient_user_id`
- `status`: 'pending' | 'accepted' | 'declined' | 'expired'
- `message`, `sent_at`, `responded_at`
- `invite_quota_used`

### organizer_analytics - Aggregated Metrics
- `id`, `organizer_id`, `event_id` (nullable)
- `date_range_start`, `date_range_end`
- `metric_type`: 'registration' | 'attendance' | 'revenue' | 'engagement'
- `data` (jsonb) - flexible metric storage
- `calculated_at`

### organizer_api_keys - API Access (Gold Tier)
- `id`, `organizer_id`
- `key_hash`, `key_prefix` (last 4 chars)
- `name`, `permissions` (jsonb)
- `last_used_at`, `expires_at`, `is_active`

### Indexes
- `idx_organizer_accounts_slug`, `idx_organizer_accounts_tier`
- `idx_organizer_members_organizer`, `idx_organizer_members_user`
- `idx_organizer_events_organizer`, `idx_organizer_events_status`, `idx_organizer_events_date`
- `idx_organizer_registrations_event`, `idx_organizer_registrations_user`
- `idx_organizer_invites_organizer`, `idx_organizer_invites_status`

### RLS Policies
- **Organizers**: only own staff can see
- **Events**: visible to target tiers + organizer staff
- **Registrations**: user sees own, organizer sees event registrations
- **Invites**: organizer staff only

---

## TypeScript Types

### Organizer Account Types
```typescript
OrganizerAccount {
  id: string;
  name: string;
  slug: string;
  tier: OrganizerTier;
  contactEmail: string;
  contactPhone?: string;
  websiteUrl?: string;
  logoUrl?: string;
  billingEmail: string;
  stripeCustomerId?: string;
  monthlyEventQuota: number;
  eventsUsedThisMonth: number;
  quotaResetsAt: string;
  isActive: boolean;
  isVerified: boolean;
}

type OrganizerTier = 'bronze' | 'silver' | 'gold';
```

### Organizer Member Types
```typescript
OrganizerMember {
  id: string;
  organizerId: string;
  userId: string;
  role: OrganizerRole;
  permissions: OrganizerPermissions;
  invitedAt: string;
  joinedAt?: string;
  isActive: boolean;
}

type OrganizerRole = 'owner' | 'admin' | 'manager' | 'viewer';
```

### Event Types
```typescript
OrganizerEvent {
  id: string;
  organizerId: string;
  name: string;
  slug: string;
  description?: string;
  eventType: EventType;
  status: EventStatus;
  courseId?: string;
  date: string;
  startTime?: string;
  endTime?: string;
  maxParticipants: number;
  currentParticipants: number;
  registrationOpensAt?: string;
  registrationClosesAt?: string;
  priceCents: number;
  priceCurrency: string;
  isPrivate: boolean;
  inviteOnly: boolean;
  targetTiers: string[];
}

type EventType = 'tournament' | 'scramble' | 'charity' | 'corporate' | 'social';
type EventStatus = 'draft' | 'published' | 'registration_open' | 'full' | 'in_progress' | 'completed' | 'cancelled';
```

### Registration Types
```typescript
EventRegistration {
  id: string;
  eventId: string;
  userId: string;
  status: RegistrationStatus;
  registeredAt: string;
  confirmedAt?: string;
  checkedInAt?: string;
  paymentStatus: PaymentStatus;
  paymentIntentId?: string;
  notes?: string;
  handicapAtRegistration?: number;
}

type RegistrationStatus = 'registered' | 'waitlisted' | 'confirmed' | 'checked_in' | 'no_show' | 'cancelled';
type PaymentStatus = 'pending' | 'paid' | 'waived' | 'refunded';
```

### Invite Types
```typescript
OrganizerInvite {
  id: string;
  organizerId: string;
  eventId?: string;
  senderId: string;
  recipientEmail: string;
  recipientUserId?: string;
  status: InviteStatus;
  message?: string;
  sentAt: string;
  respondedAt?: string;
  inviteQuotaUsed: boolean;
}

type InviteStatus = 'pending' | 'accepted' | 'declined' | 'expired';
```

### Analytics Types
```typescript
OrganizerAnalytics {
  id: string;
  organizerId: string;
  eventId?: string;
  dateRangeStart: string;
  dateRangeEnd: string;
  metricType: AnalyticsMetricType;
  data: Record<string, unknown>;
  calculatedAt: string;
}

type AnalyticsMetricType = 'registration' | 'attendance' | 'revenue' | 'engagement';
```

### API Key Types
```typescript
OrganizerApiKey {
  id: string;
  organizerId: string;
  keyHash: string;
  keyPrefix: string;
  name: string;
  permissions: Record<string, unknown>;
  lastUsedAt?: string;
  expiresAt?: string;
  isActive: boolean;
}
```

### Input Types
- `CreateOrganizerInput`
- `UpdateOrganizerInput`
- `CreateEventInput`
- `UpdateEventInput`
- `RegisterForEventInput`
- `SendInviteInput`
- `CreateApiKeyInput`

### Constants
- `ORGANIZER_TIERS` - Bronze/Silver/Gold with pricing
- `EVENT_TYPES` - All event types
- `EVENT_STATUSES` - All statuses
- `ORGANIZER_ROLES` - Role definitions with permissions
- `REGISTRATION_STATUSES` - Registration states
- `ANALYTICS_METRICS` - Available metrics

---

## Edge Functions

### organizer-auth (344 lines)
- `POST /organizer/auth/register` - Register new organizer
  - Check: user is SELECT or SUMMIT tier
  - Create organizer account
  - Create owner membership
  - Set up Stripe customer
- `POST /organizer/auth/login` - Get organizer context
  - Returns: all organizers user belongs to with roles
- `GET /organizer/auth/check` - Check if user can create organizer
  - Returns: tier check result, pricing info

### organizer-events (682 lines)
- `POST /organizer/events/create` - Create new event
  - Check: user has permission
  - Check: within monthly quota
  - Create event with target tiers
  - Update quota usage
- `GET /organizer/events/list` - List organizer's events
  - Filter: status, date range
  - Include: registration counts
  - Pagination
- `GET /organizer/events/get/:id` - Get event details
  - Include: registrations, analytics
- `POST /organizer/events/update` - Update event
  - Check: user has edit permission
- `POST /organizer/events/publish` - Publish event
  - Check: all required fields
  - Make visible to target tiers
- `POST /organizer/events/cancel` - Cancel event
  - Notify registered members
  - Handle refunds if needed

### organizer-registrations (618 lines)
- `POST /organizer/registrations/register` - Member registers
  - Check: event is open
  - Check: member tier in target_tiers
  - Check: not already registered
  - Create registration
  - Handle payment if required
- `POST /organizer/registrations/cancel` - Member cancels
  - Update status
  - Handle refund if applicable
- `GET /organizer/registrations/list` - List registrations
  - Check: user has permission
  - Include: user data, payment status
- `POST /organizer/registrations/check-in` - Check in member
  - Check: user has permission
  - Update status, timestamp

### organizer-invites (452 lines)
- `POST /organizer/invites/send` - Send invite to member
  - Check: user has permission
  - Check: within invite quota
  - Create invite record
  - Send notification/email
- `POST /organizer/invites/respond` - Member responds
  - Accept: create registration
  - Decline: update status
- `GET /organizer/invites/list` - List invites sent
  - Filter: status, event

### organizer-analytics (506 lines)
- `GET /organizer/analytics/dashboard` - Get dashboard data
  - Check: user has permission
  - Aggregate: registrations, attendance, revenue
  - Time ranges: 7d, 30d, 90d, 1y
- `GET /organizer/analytics/event/:id` - Event analytics
  - Registration funnel
  - Attendance rate
  - Revenue breakdown
- `POST /organizer/analytics/export` - Export data (Gold tier)
  - CSV/JSON export
  - Date range filtering

### organizer-members (479 lines)
- `POST /organizer/members/invite` - Invite staff member
  - Check: user is owner/admin
  - Send invite with role
- `POST /organizer/members/update-role` - Update role
  - Check: user has permission
- `POST /organizer/members/remove` - Remove member
  - Check: not removing owner
- `GET /organizer/members/list` - List staff members

### organizer-api (422 lines)
- `GET /organizer/api/keys` - List API keys
- `POST /organizer/api/keys/create` - Create new key
- `POST /organizer/api/keys/revoke` - Revoke key
- `GET /organizer/api/usage` - Get API usage stats

---

## Pricing Tiers

| Tier | Price | Event Quota | Target Tiers | API Access |
|------|-------|-------------|--------------|------------|
| **Bronze** | $500/mo | 1 event/month | Select/Summit only | ❌ |
| **Silver** | $1,500/mo | 5 events/month | All tiers | ❌ |
| **Gold** | $5,000/mo | Unlimited | All tiers + analytics | ✅ |

---

## Security Features

✅ **Tier checks** - Only SELECT/SUMMIT can create organizers  
✅ **Permission system** - Role-based access (owner/admin/manager/viewer)  
✅ **Quota enforcement** - Monthly event limits per tier  
✅ **Target tier visibility** - Events only visible to specified tiers  
✅ **RLS policies** - Database-level access control  
✅ **API key management** - Gold tier only  

---

## Testing

### Test Organizer Flow
```bash
# 1. Check if user can create organizer
curl /functions/v1/organizer-auth/check

# 2. Register new organizer
curl -X POST /functions/v1/organizer-auth/register \
  -d '{"name": "PGA Tour Events", "tier": "gold"}'

# 3. Create event
curl -X POST /functions/v1/organizer-events/create \
  -d '{"name": "Spring Championship", "event_type": "tournament", "max_participants": 120}'

# 4. List events
curl /functions/v1/organizer-events/list

# 5. Member registers
curl -X POST /functions/v1/organizer-registrations/register \
  -d '{"event_id": "event-uuid"}'

# 6. Send invite
curl -X POST /functions/v1/organizer-invites/send \
  -d '{"recipient_email": "golfer@example.com", "message": "Join our tournament!"}'

# 7. Get analytics
curl /functions/v1/organizer-analytics/dashboard
```

---

## Next Steps

1. ✅ **Sprint 4 Complete** - Tournament Organizer Portal (B2B)
2. ⏳ **Sprint 5** - Mobile UI Implementation
3. ⏳ **Sprint 6** - Testing + Polish

---

## Files Created

```
packages/db/migrations/0018_organizer_portal.sql
packages/types/src/organizer.ts
apps/functions/supabase/functions/organizer-auth/index.ts
apps/functions/supabase/functions/organizer-auth/config.toml
apps/functions/supabase/functions/organizer-events/index.ts
apps/functions/supabase/functions/organizer-events/config.toml
apps/functions/supabase/functions/organizer-registrations/index.ts
apps/functions/supabase/functions/organizer-registrations/config.toml
apps/functions/supabase/functions/organizer-invites/index.ts
apps/functions/supabase/functions/organizer-invites/config.toml
apps/functions/supabase/functions/organizer-analytics/index.ts
apps/functions/supabase/functions/organizer-analytics/config.toml
apps/functions/supabase/functions/organizer-members/index.ts
apps/functions/supabase/functions/organizer-members/config.toml
apps/functions/supabase/functions/organizer-api/index.ts
apps/functions/supabase/functions/organizer-api/config.toml
```

---

**Sprint 4 Complete! Ready for Sprint 5: Mobile UI Implementation.**

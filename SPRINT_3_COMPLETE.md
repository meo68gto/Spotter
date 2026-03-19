# Sprint 3 Complete: Profile + Networking

**Status:** ✅ COMPLETE  
**Date:** 2026-03-18  
**Runtime:** ~4 minutes (parallel execution)

---

## Deliverables Summary

| Component | Files | Lines | Status |
|-----------|-------|-------|--------|
| **Database** | `0017_profile_networking.sql` | 653 | ✅ Complete |
| **Types** | `profile.ts` | 527 | ✅ Complete |
| **Edge Functions** | 6 functions | 2,534 | ✅ Complete |

**Total:** 3,714 lines of code

---

## Database Schema

### Extended Users Table
Added columns to `public.users`:
- **Professional Identity:**
  - `current_role` (text) - "Partner at Andreessen Horowitz"
  - `company` (text)
  - `company_verified` (boolean)
  - `industry` (text)
  - `linkedin_url` (text)
  - `years_of_experience` (integer)

- **Golf Identity:**
  - `handicap` (numeric(4,1))
  - `handicap_verified` (boolean)
  - `home_course_id` (uuid, FK to golf_courses)
  - `play_frequency` ('weekly' | 'biweekly' | 'monthly' | 'occasionally')
  - `preferred_tee_times` (jsonb)
  - `years_playing` (integer)

- **Login/Status:**
  - `is_active`, `is_verified`, `is_admin`
  - `last_login_at`, `login_count`
  - `failed_login_attempts`, `locked_until`

### New Tables

**connections**
- `id`, `requester_id`, `addressee_id`
- `status`: 'pending' | 'accepted' | 'declined' | 'blocked'
- `requested_at`, `responded_at`
- `tier_at_connection` (text)
- `connection_type`: 'played_together' | 'introduced' | 'met_offline' | 'online_only'

**connection_intros**
- `id`, `connection_id`, `introducer_id`
- `status`: 'pending' | 'accepted' | 'declined' | 'expired'
- `message`, `intro_credits_used`

**reputation_scores**
- `id`, `member_id`
- `overall_score` (0-100)
- Component scores:
  - `completion_rate` (30%)
  - `ratings_average` (25%)
  - `network_size` (15%)
  - `referrals_count` (15%)
  - `profile_completeness` (10%)
  - `attendance_rate` (5%)
- `calculated_at`, `recalculate_at`

**reputation_events**
- `id`, `member_id`, `event_type`
- `points_change`, `reason`, `created_at`

**user_sessions**
- `id`, `user_id`, `access_token`, `refresh_token`
- `device_info`, `ip_address`, `expires_at`

**login_audit**
- `id`, `user_id`, `email_attempted`, `success`
- `failure_reason`, `ip_address`, `user_agent`

**password_resets**
- `id`, `user_id`, `token`, `expires_at`, `used_at`

### Indexes
- `idx_connections_requester`, `idx_connections_addressee`
- `idx_connections_status`
- `idx_reputation_member`, `idx_reputation_score`
- `idx_sessions_user`, `idx_sessions_token`
- `idx_audit_user`, `idx_audit_attempted`

### RLS Policies
- **connections**: Same-tier visibility enforced
- **reputation_scores**: Public read for same tier
- **user_sessions**: Users only see own sessions
- **login_audit**: Users only see own history

---

## TypeScript Types

### Professional Identity
```typescript
ProfessionalIdentity {
  currentRole: string;
  company: string;
  companyVerified: boolean;
  industry: string;
  linkedinUrl: string;
  yearsExperience: number;
}
```

### Golf Identity
```typescript
GolfIdentity {
  handicap: number;
  handicapVerified: boolean;
  homeCourseId: string;
  playFrequency: PlayFrequency;
  preferredTeeTimes: TeeTimePreference[];
  yearsPlaying: number;
}

type PlayFrequency = 'weekly' | 'biweekly' | 'monthly' | 'occasionally';
type TeeTimePreference = 'early_bird' | 'mid_morning' | 'afternoon' | 'twilight';
```

### Connection Types
```typescript
Connection {
  id: string;
  requesterId: string;
  addresseeId: string;
  status: ConnectionStatus;
  requestedAt: string;
  respondedAt?: string;
  tierAtConnection: string;
  connectionType: ConnectionType;
}

type ConnectionStatus = 'pending' | 'accepted' | 'declined' | 'blocked';
type ConnectionType = 'played_together' | 'introduced' | 'met_offline' | 'online_only';
```

### Introduction Types
```typescript
ConnectionIntro {
  id: string;
  connectionId: string;
  introducerId: string;
  status: IntroStatus;
  message: string;
  introCreditsUsed: number;
}

type IntroStatus = 'pending' | 'accepted' | 'declined' | 'expired';
```

### Reputation Types
```typescript
ReputationScore {
  id: string;
  memberId: string;
  overallScore: number;
  completionRate: number;
  ratingsAverage: number;
  networkSize: number;
  referralsCount: number;
  profileCompleteness: number;
  attendanceRate: number;
  calculatedAt: string;
}

ReputationEvent {
  id: string;
  memberId: string;
  eventType: ReputationEventType;
  pointsChange: number;
  reason: string;
  createdAt: string;
}
```

### Input Types
- `UpdateProfileInput`
- `SendConnectionRequestInput`
- `RespondToConnectionInput`
- `RequestIntroInput`

### Constants
- `PLAY_FREQUENCIES` - All options with labels
- `CONNECTION_STATUSES` - All statuses
- `REPUTATION_WEIGHTS` - Score calculation weights
- `PROFILE_SECTIONS` - Sections for completeness

---

## Edge Functions

### profile-get (266 lines)
- `GET /profile/get` - Get current user's extended profile
- `GET /profile/get/:id` - Get another user's profile (same-tier only)
- Returns: user + professional identity + golf identity + reputation

### profile-update (445 lines)
- `POST /profile/update` - Update profile fields
- Validates: which fields user can update based on tier
- Updates profile_completeness score
- Returns: updated profile

### connections-request (453 lines)
- `POST /connections/request` - Send connection request
  - Check: same-tier only (FREE can't send)
  - Check: not already connected
  - Check: recipient allows connections
  - Create pending connection
  - Send notification
- `POST /connections/respond` - Accept/decline request
  - Update status
  - Notify requester
  - Calculate reputation on accept

### connections-list (349 lines)
- `GET /connections/list` - List user's connections
  - Filter: accepted, pending_sent, pending_received
  - Include: member data, connection date
  - Pagination
- `GET /connections/mutual` - Find mutual connections with another user
  - For introduction paths

### connections-intro (605 lines)
- `POST /connections/intro` - Request introduction via mutual connection
  - Check: has mutual connection
  - Check: has intro credits (tier check)
  - Create introduction request
  - Notify introducer
- `POST /connections/intro/respond` - Introducer accepts/declines
  - If accepted: connect both parties
  - Consume intro credits
  - Notify both parties

### reputation-calculate (416 lines)
- `POST /reputation/calculate` - Calculate reputation for user
  - completion_rate: rounds completed vs scheduled (30%)
  - ratings_average: average ratings from other players (25%)
  - network_size: number of connections (15%)
  - referrals_count: introductions made (15%)
  - profile_completeness: % of profile filled (10%)
  - attendance_rate: showed up vs registered (5%)
  - Weighted calculation for overall score
- `GET /reputation/get/:id` - Get user's reputation

---

## Security Features

✅ **Same-tier visibility** - Enforced at database level  
✅ **RLS policies** - Users only see authorized data  
✅ **Tier gating** - FREE users can't send connections  
✅ **Intro credits** - Checked before allowing introductions  
✅ **Account locking** - After 5 failed login attempts  
✅ **Audit logging** - All login attempts logged  

---

## Testing

### Test Connection Flow
```bash
# 1. Get profile
curl /functions/v1/profile-get

# 2. Update profile
curl -X POST /functions/v1/profile-update \
  -d '{"current_role": "Partner", "company": "Andreessen Horowitz"}'

# 3. Send connection request
curl -X POST /functions/v1/connections-request \
  -d '{"addressee_id": "user-uuid", "connection_type": "played_together"}'

# 4. List connections
curl /functions/v1/connections-list

# 5. Request introduction
curl -X POST /functions/v1/connections-intro \
  -d '{"target_id": "user-uuid", "message": "Would love to meet"}'

# 6. Calculate reputation
curl -X POST /functions/v1/reputation-calculate
```

---

## Next Steps

1. ✅ **Sprint 3 Complete** - Profile + Networking
2. ⏳ **Sprint 4** - Tournament Organizer Portal (B2B)
3. ⏳ **Sprint 5** - Mobile UI Implementation
4. ⏳ **Sprint 6** - Testing + Polish

---

## Files Created

```
packages/db/migrations/0017_profile_networking.sql
packages/types/src/profile.ts
apps/functions/supabase/functions/profile-get/index.ts
apps/functions/supabase/functions/profile-get/config.toml
apps/functions/supabase/functions/profile-update/index.ts
apps/functions/supabase/functions/profile-update/config.toml
apps/functions/supabase/functions/connections-request/index.ts
apps/functions/supabase/functions/connections-request/config.toml
apps/functions/supabase/functions/connections-list/index.ts
apps/functions/supabase/functions/connections-list/config.toml
apps/functions/supabase/functions/connections-intro/index.ts
apps/functions/supabase/functions/connections-intro/config.toml
apps/functions/supabase/functions/reputation-calculate/index.ts
apps/functions/supabase/functions/reputation-calculate/config.toml
```

---

**Sprint 3 Complete! Ready for Sprint 4: Tournament Organizer Portal.**

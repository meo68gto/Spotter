# Database Schema Documentation

Complete reference for the Spotter database schema.

## Overview

Spotter uses PostgreSQL with Supabase. Schema includes:
- **15+ tables** for core functionality
- **20+ enum types** for type safety
- **RLS policies** for same-tier visibility
- **Triggers** for computed fields
- **Indexes** for performance

## Schema Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        CORE TABLES                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐    │
│  │    users     │────>│membership_   │<────│ tier_history │    │
│  │              │     │   tiers      │     │              │    │
│  └──────┬───────┘     └──────────────┘     └──────────────┘    │
│         │                                                       │
│         │         ┌──────────────┐     ┌──────────────┐        │
│         └────────>│   connections│<────│reputation_   │        │
│                   │              │     │   scores     │        │
│                   └──────────────┘     └──────────────┘        │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                       GOLF TABLES                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐    │
│  │golf_courses  │<────│golf_rounds   │────>│round_        │    │
│  │              │     │              │     │participants  │    │
│  └──────────────┘     └──────┬───────┘     └──────────────┘    │
│                              │                                 │
│                              │     ┌──────────────┐            │
│                              └────>│ round_invites│            │
│                                    └──────────────┘            │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                     ORGANIZER TABLES                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐    │
│  │  organizers  │────>│   events     │────>│event_        │    │
│  │              │     │              │     │registrations │    │
│  └──────────────┘     └──────┬───────┘     └──────────────┘    │
│                              │                                  │
│                              │     ┌──────────────┐            │
│                              └────>│organizer_    │            │
│                                    │  invites     │            │
│                                    └──────────────┘            │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                      INBOX TABLES                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────┐     ┌──────────────┐                          │
│  │inbox_threads │<────│inbox_messages│                          │
│  │              │     │              │                          │
│  └──────────────┘     └──────────────┘                          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Core Tables

### users

Central user table with tier assignment.

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  display_name TEXT,
  avatar_url TEXT,
  bio TEXT,
  timezone TEXT,
  
  -- Tier assignment
  tier_id UUID REFERENCES membership_tiers(id),
  tier_enrolled_at TIMESTAMPTZ,
  tier_expires_at TIMESTAMPTZ,
  tier_status TEXT DEFAULT 'active',
  
  -- Professional identity
  current_role TEXT,
  company TEXT,
  company_verified BOOLEAN DEFAULT FALSE,
  industry TEXT,
  linkedin_url TEXT,
  years_of_experience INTEGER,
  
  -- Golf identity
  handicap NUMERIC(4,1),
  handicap_verified BOOLEAN DEFAULT FALSE,
  home_course_id UUID REFERENCES golf_courses(id),
  play_frequency TEXT,
  preferred_tee_times JSONB DEFAULT '[]',
  years_playing INTEGER,
  
  -- Metadata
  profile_completeness INTEGER DEFAULT 0,
  is_organizer BOOLEAN DEFAULT FALSE,
  organizer_tier TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**RLS Policies:**
- Users can see their own profile
- Users can see same-tier profiles
- Users can update their own profile

### membership_tiers

Tier definitions and feature flags.

```sql
CREATE TABLE membership_tiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  
  -- Pricing
  price_cents INTEGER NOT NULL,
  billing_interval TEXT, -- 'monthly', 'annual', 'lifetime'
  
  -- Features (JSONB for flexibility)
  features JSONB NOT NULL DEFAULT '{}',
  
  -- UI
  card_color TEXT DEFAULT '#94A3B8',
  sort_order INTEGER DEFAULT 0,
  
  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Default Tiers:**

| slug | name | price_cents | billing_interval |
|------|------|-------------|------------------|
| free | Free | 0 | annual |
| select | Select | 100000 | annual |
| summit | Summit | 1000000 | lifetime |

### connections

Member networking connections.

```sql
CREATE TYPE connection_status AS ENUM (
  'pending', 'accepted', 'declined', 'blocked'
);

CREATE TYPE connection_type AS ENUM (
  'played_together', 'introduced', 'met_offline', 'online_only'
);

CREATE TABLE connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  addressee_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  status connection_status NOT NULL DEFAULT 'pending',
  connection_type connection_type NOT NULL DEFAULT 'online_only',
  
  -- Context
  tier_at_connection TEXT NOT NULL,
  notes TEXT,
  
  -- Timestamps
  requested_at TIMESTAMPTZ DEFAULT NOW(),
  responded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT different_users CHECK (requester_id != addressee_id),
  CONSTRAINT unique_connection UNIQUE (requester_id, addressee_id)
);
```

**RLS Policies:**
- Users can see connections they're part of
- Same-tier visibility enforced
- Users can create requests
- Involved parties can update status

### reputation_scores

Calculated reputation for each member.

```sql
CREATE TABLE reputation_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Component scores (0-100)
  overall_score INTEGER NOT NULL DEFAULT 50,
  completion_rate INTEGER NOT NULL DEFAULT 50,
  ratings_average INTEGER NOT NULL DEFAULT 50,
  network_size INTEGER NOT NULL DEFAULT 0,
  referrals_count INTEGER NOT NULL DEFAULT 0,
  profile_completeness INTEGER NOT NULL DEFAULT 0,
  attendance_rate INTEGER NOT NULL DEFAULT 100,
  
  -- Calculation tracking
  calculated_at TIMESTAMPTZ DEFAULT NOW(),
  recalculate_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT score_range CHECK (overall_score BETWEEN 0 AND 100),
  CONSTRAINT unique_member UNIQUE (member_id)
);
```

**RLS Policies:**
- Users can see their own score
- Users can see scores of same-tier members

### tier_history

Audit trail for tier changes.

```sql
CREATE TABLE tier_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Tier change
  previous_tier_id UUID REFERENCES membership_tiers(id),
  new_tier_id UUID REFERENCES membership_tiers(id),
  new_status TEXT,
  change_reason TEXT,
  
  -- Stripe references
  stripe_checkout_session_id TEXT,
  stripe_payment_intent_id TEXT,
  stripe_subscription_id TEXT,
  
  -- Metadata
  metadata JSONB DEFAULT '{}',
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

## Golf Tables

### golf_courses

Golf course information.

```sql
CREATE TYPE course_difficulty AS ENUM (
  'easy', 'moderate', 'challenging', 'expert'
);

CREATE TABLE golf_courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  address TEXT,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  country TEXT DEFAULT 'US',
  postal_code TEXT,
  
  -- Location
  location GEOGRAPHY(POINT, 4326),
  latitude NUMERIC(10, 8),
  longitude NUMERIC(11, 8),
  
  -- Contact
  phone TEXT,
  website TEXT,
  email TEXT,
  
  -- Course details
  par_total INTEGER,
  course_rating NUMERIC(4, 1),
  slope_rating INTEGER,
  difficulty course_difficulty,
  
  -- Amenities and media
  amenities JSONB DEFAULT '{}',
  images JSONB DEFAULT '[]',
  
  -- Status
  is_verified BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### golf_rounds

Golf rounds/foursomes.

```sql
CREATE TYPE golf_round_format AS ENUM (
  'stroke_play', 'match_play', 'scramble', 'best_ball', 'shamble'
);

CREATE TYPE golf_round_status AS ENUM (
  'draft', 'open', 'full', 'in_progress', 'completed', 'cancelled'
);

CREATE TABLE golf_rounds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES golf_courses(id),
  organizer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Round details
  round_date DATE NOT NULL,
  tee_time TIME,
  duration_minutes INTEGER DEFAULT 240,
  format golf_round_format DEFAULT 'stroke_play',
  status golf_round_status DEFAULT 'draft',
  
  -- Spots
  total_spots INTEGER NOT NULL DEFAULT 4,
  spots_available INTEGER NOT NULL DEFAULT 4,
  
  -- Visibility
  is_private BOOLEAN DEFAULT FALSE,
  
  -- Filters
  min_handicap NUMERIC(4, 1),
  max_handicap NUMERIC(4, 1),
  
  -- Additional
  notes TEXT,
  weather_conditions TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT valid_spots CHECK (total_spots BETWEEN 2 AND 4),
  CONSTRAINT valid_handicap_range CHECK (
    min_handicap IS NULL OR 
    max_handicap IS NULL OR 
    min_handicap <= max_handicap
  )
);
```

**RLS Policies:**
- Organizer can always see their rounds
- Participants can see rounds they're in
- Same-tier members can see open/public rounds
- Private rounds visible to invitees

### round_participants

Participants in golf rounds.

```sql
CREATE TYPE participant_status AS ENUM (
  'invited', 'confirmed', 'declined', 'waitlisted', 'checked_in', 'no_show'
);

CREATE TYPE participant_role AS ENUM (
  'organizer', 'participant'
);

CREATE TABLE round_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id UUID NOT NULL REFERENCES golf_rounds(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  status participant_status DEFAULT 'invited',
  role participant_role DEFAULT 'participant',
  
  -- Timestamps
  invited_at TIMESTAMPTZ DEFAULT NOW(),
  confirmed_at TIMESTAMPTZ,
  checked_in_at TIMESTAMPTZ,
  
  -- Scoring
  score_gross INTEGER,
  score_net INTEGER,
  handicap_used NUMERIC(4, 1),
  
  notes TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT unique_participant UNIQUE (round_id, member_id)
);
```

## Organizer Tables

### organizers

Organizer accounts for tournament management.

```sql
CREATE TYPE organizer_tier AS ENUM (
  'bronze', 'silver', 'gold'
);

CREATE TYPE organizer_status AS ENUM (
  'pending', 'active', 'suspended', 'cancelled'
);

CREATE TABLE organizers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  website TEXT,
  email TEXT NOT NULL,
  phone TEXT,
  
  -- Address
  address JSONB,
  
  -- Tier
  tier organizer_tier NOT NULL,
  status organizer_status DEFAULT 'pending',
  
  -- Branding
  logo_url TEXT,
  
  -- Owner
  owner_id UUID NOT NULL REFERENCES users(id),
  
  -- Subscription
  subscription_expires_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### events

Tournament events.

```sql
CREATE TYPE event_type AS ENUM (
  'tournament', 'scramble', 'charity', 'corporate', 'social'
);

CREATE TYPE event_status AS ENUM (
  'draft', 'published', 'registration_open', 'full', 
  'in_progress', 'completed', 'cancelled'
);

CREATE TABLE events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organizer_id UUID NOT NULL REFERENCES organizers(id),
  
  -- Event details
  title TEXT NOT NULL,
  description TEXT,
  type event_type NOT NULL,
  status event_status DEFAULT 'draft',
  
  -- Location
  course_id UUID REFERENCES golf_courses(id),
  course_name TEXT, -- cached
  
  -- Timing
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  registration_opens_at TIMESTAMPTZ,
  registration_closes_at TIMESTAMPTZ,
  
  -- Capacity
  max_participants INTEGER NOT NULL,
  registration_count INTEGER DEFAULT 0,
  waitlist_count INTEGER DEFAULT 0,
  
  -- Pricing
  entry_fee_cents INTEGER,
  currency TEXT DEFAULT 'USD',
  
  -- Visibility
  is_public BOOLEAN DEFAULT TRUE,
  target_tiers JSONB DEFAULT '[]',
  
  -- Media
  image_url TEXT,
  
  -- Settings
  format_settings JSONB DEFAULT '{}',
  custom_fields JSONB DEFAULT '[]',
  tags JSONB DEFAULT '[]',
  
  -- Audit
  created_by_user_id UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### event_registrations

Event participant registrations.

```sql
CREATE TYPE registration_status AS ENUM (
  'registered', 'waitlisted', 'confirmed', 
  'checked_in', 'no_show', 'cancelled'
);

CREATE TYPE payment_status AS ENUM (
  'pending', 'paid', 'waived', 'refunded'
);

CREATE TABLE event_registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id),
  
  -- Registrant
  user_id UUID REFERENCES users(id),
  guest_email TEXT,
  guest_name TEXT,
  
  -- Status
  status registration_status DEFAULT 'registered',
  payment_status payment_status DEFAULT 'pending',
  
  -- Payment
  amount_paid_cents INTEGER,
  stripe_payment_intent_id TEXT,
  stripe_checkout_session_id TEXT,
  
  -- Timestamps
  registered_at TIMESTAMPTZ DEFAULT NOW(),
  confirmed_at TIMESTAMPTZ,
  checked_in_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  
  -- Additional
  custom_field_responses JSONB DEFAULT '{}',
  dietary_restrictions TEXT,
  team_name TEXT,
  handicap_at_registration NUMERIC(4, 1),
  marketing_opt_in BOOLEAN DEFAULT FALSE,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

## Inbox Tables

### inbox_threads

Message threads.

```sql
CREATE TYPE thread_type AS ENUM (
  'direct', 'round', 'event', 'support'
);

CREATE TYPE thread_status AS ENUM (
  'open', 'closed', 'archived'
);

CREATE TABLE inbox_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type thread_type NOT NULL,
  
  -- Participants
  participant_ids UUID[] NOT NULL,
  
  -- Content
  title TEXT NOT NULL,
  status thread_status DEFAULT 'open',
  
  -- Last activity
  last_message_at TIMESTAMPTZ,
  last_message_preview TEXT,
  
  -- Related entities
  round_id UUID REFERENCES golf_rounds(id),
  event_id UUID REFERENCES events(id),
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### inbox_messages

Individual messages.

```sql
CREATE TABLE inbox_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID NOT NULL REFERENCES inbox_threads(id),
  
  -- Sender
  sender_id UUID NOT NULL REFERENCES users(id),
  
  -- Content
  message TEXT NOT NULL,
  
  -- Metadata
  client_message_id TEXT, -- for deduplication
  metadata JSONB DEFAULT '{}',
  
  -- Read status
  read_by UUID[] DEFAULT '{}',
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

## Indexes

### Performance Indexes

```sql
-- Users
CREATE INDEX idx_users_tier ON users(tier_id);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_created ON users(created_at DESC);

-- Connections
CREATE INDEX idx_connections_requester ON connections(requester_id);
CREATE INDEX idx_connections_addressee ON connections(addressee_id);
CREATE INDEX idx_connections_status ON connections(status);

-- Golf Rounds
CREATE INDEX idx_rounds_date_status ON golf_rounds(round_date, status);
CREATE INDEX idx_rounds_course ON golf_rounds(course_id);
CREATE INDEX idx_rounds_organizer ON golf_rounds(organizer_id);

-- Events
CREATE INDEX idx_events_organizer ON events(organizer_id);
CREATE INDEX idx_events_status ON events(status);
CREATE INDEX idx_events_start_time ON events(start_time);

-- Geospatial
CREATE INDEX idx_courses_location ON golf_courses USING GIST(location);
```

## Triggers

### Auto-update timestamps

```sql
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all tables
CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
```

### Update round spots available

```sql
CREATE OR REPLACE FUNCTION update_round_spots_available()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE golf_rounds
  SET spots_available = total_spots - (
    SELECT COUNT(*) FROM round_participants
    WHERE round_id = COALESCE(NEW.round_id, OLD.round_id)
    AND status = 'confirmed'
  )
  WHERE id = COALESCE(NEW.round_id, OLD.round_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_spots
  AFTER INSERT OR UPDATE OR DELETE ON round_participants
  FOR EACH ROW EXECUTE FUNCTION update_round_spots_available();
```

## RLS Policy Examples

### Same-tier visibility for users

```sql
CREATE POLICY users_select_same_tier ON users
  FOR SELECT USING (
    auth.uid() = id
    OR EXISTS (
      SELECT 1 FROM users current_user
      WHERE current_user.id = auth.uid()
      AND current_user.tier_id = users.tier_id
    )
  );
```

### Connection visibility

```sql
CREATE POLICY connections_select_involved ON connections
  FOR SELECT USING (
    auth.uid() = requester_id 
    OR auth.uid() = addressee_id
  );
```

## Migrations

Migrations are stored in `packages/db/migrations/`:

| File | Description |
|------|-------------|
| `0001_initial.sql` | Initial schema |
| `0014_tier_system.sql` | Tier system |
| `0015_golf_schema.sql` | Golf tables |
| `0016_login_system.sql` | Login system |
| `0017_profile_networking.sql` | Profile + networking |

## Related Documentation

- [Architecture](./architecture.md)
- [API Endpoints](../api/endpoints.md)
- [Testing Guide](./testing.md)

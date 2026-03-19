# Database Schema Documentation

Complete reference for the Spotter PostgreSQL database schema.

## Overview

The Spotter database is built on PostgreSQL with Supabase, featuring:
- **20+ tables** for core functionality
- **15+ enum types** for type safety
- **Row Level Security (RLS)** policies for same-tier visibility
- **Triggers** for computed fields and audit trails
- **Indexes** for query performance
- **PostGIS** for geospatial queries

## Schema Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                       CORE TABLES                               │
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
│                       GOLF TABLES                              │
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
│                     ORGANIZER TABLES                           │
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
│  ┌──────────────┐     ┌──────────────┐                        │
│  │inbox_threads │<────│inbox_messages│                        │
│  │              │     │              │                        │
│  └──────────────┘     └──────────────┘                        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Core Tables

### users

Central user table with tier assignment and identity information.

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  display_name TEXT,
  avatar_url TEXT,
  bio TEXT,
  timezone TEXT DEFAULT 'America/New_York',
  
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
  home_course_id UUID REFERENCES golf_courses(id),
  play_frequency TEXT, -- 'daily', 'weekly', 'biweekly', 'monthly', 'occasionally'
  years_playing INTEGER,
  preferred_tee_time_start TIME,
  preferred_tee_time_end TIME,
  
  -- Profile tracking
  profile_completeness INTEGER DEFAULT 0,
  
  -- Location (for discovery)
  location_city TEXT,
  location_state TEXT,
  location_country TEXT DEFAULT 'US',
  location_point GEOGRAPHY(POINT), -- PostGIS
  
  -- Preferences
  searchable BOOLEAN DEFAULT TRUE,
  receive_notifications BOOLEAN DEFAULT TRUE,
  
  -- Auth
  supabase_auth_id UUID UNIQUE,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_active_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX idx_users_tier ON users(tier_id);
CREATE INDEX idx_users_location ON users(location_city, location_state);
CREATE INDEX idx_users_searchable ON users(searchable) WHERE searchable = TRUE;
CREATE INDEX idx_users_geography ON users USING GIST(location_point);
```

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
  billing_interval TEXT NOT NULL, -- 'monthly', 'annual', 'lifetime'
  stripe_price_id TEXT,
  
  -- Features (stored as JSONB for flexibility)
  features JSONB NOT NULL DEFAULT '{}',
  
  -- Visual
  card_color TEXT,
  icon_url TEXT,
  
  -- Ordering
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Initial tiers
INSERT INTO membership_tiers (name, slug, price_cents, billing_interval, features, card_color, display_order) VALUES
('Free', 'free', 0, 'annual', '{"maxConnections": 50, "maxSearchResults": 20, "canCreateRounds": false, "canBookCoaching": false, "canRegisterEvents": false}', '#6B7280', 1),
('Select', 'select', 100000, 'annual', '{"maxConnections": 500, "maxSearchResults": null, "canCreateRounds": true, "maxRoundsPerMonth": 4, "canBookCoaching": true, "canRegisterEvents": true, "canSendIntros": true}', '#F59E0B', 2),
('Summit', 'summit', 1000000, 'lifetime', '{"maxConnections": null, "maxSearchResults": null, "canCreateRounds": true, "maxRoundsPerMonth": null, "canBookCoaching": true, "canRegisterEvents": true, "canSendIntros": true, "priorityBoosts": true}', '#7C3AED', 3);
```

### tier_history

Audit trail of tier changes.

```sql
CREATE TABLE tier_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  previous_tier_id UUID REFERENCES membership_tiers(id),
  new_tier_id UUID NOT NULL REFERENCES membership_tiers(id),
  change_reason TEXT NOT NULL, -- 'signup', 'stripe_checkout_completed', 'admin_override', 'expiration'
  changed_by UUID REFERENCES users(id), -- NULL for system changes
  stripe_checkout_session_id TEXT,
  stripe_subscription_id TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_tier_history_user ON tier_history(user_id);
CREATE INDEX idx_tier_history_created ON tier_history(created_at);
```

### connections

Member networking and relationships.

```sql
CREATE TYPE connection_status AS ENUM ('pending', 'accepted', 'declined', 'blocked');
CREATE TYPE connection_type AS ENUM ('played_together', 'business', 'social', 'coaching', 'other');

CREATE TABLE connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  receiver_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status connection_status DEFAULT 'pending',
  connection_type connection_type NOT NULL,
  message TEXT,
  response_message TEXT,
  
  -- Tier at time of connection (for audit)
  requester_tier_id UUID REFERENCES membership_tiers(id),
  receiver_tier_id UUID REFERENCES membership_tiers(id),
  
  requested_at TIMESTAMPTZ DEFAULT NOW(),
  responded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(requester_id, receiver_id)
);

CREATE INDEX idx_connections_requester ON connections(requester_id);
CREATE INDEX idx_connections_receiver ON connections(receiver_id);
CREATE INDEX idx_connections_status ON connections(status);
```

### reputation_scores

Calculated reputation for each member.

```sql
CREATE TABLE reputation_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  
  -- Component scores (0-100)
  profile_completeness_score INTEGER DEFAULT 0,
  completion_rate_score INTEGER DEFAULT 0,
  ratings_average_score INTEGER DEFAULT 0,
  network_size_score INTEGER DEFAULT 0,
  referrals_score INTEGER DEFAULT 0,
  attendance_rate_score INTEGER DEFAULT 0,
  
  -- Overall score (weighted average)
  overall_score INTEGER DEFAULT 50,
  
  -- Raw data
  rounds_completed INTEGER DEFAULT 0,
  rounds_no_show INTEGER DEFAULT 0,
  ratings_count INTEGER DEFAULT 0,
  ratings_average NUMERIC(3,2) DEFAULT 5.0,
  connections_count INTEGER DEFAULT 0,
  successful_referrals INTEGER DEFAULT 0,
  
  -- Tracking
  last_calculated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_reputation_overall ON reputation_scores(overall_score DESC);
```

## Golf Tables

### golf_courses

Golf course information with geospatial data.

```sql
CREATE TABLE golf_courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE,
  
  -- Location
  address TEXT,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  zip_code TEXT,
  country TEXT DEFAULT 'US',
  location_point GEOGRAPHY(POINT), -- PostGIS
  
  -- Contact
  phone TEXT,
  email TEXT,
  website TEXT,
  
  -- Course details
  par_total INTEGER,
  course_rating NUMERIC(4,1),
  slope_rating INTEGER,
  yardage INTEGER,
  difficulty TEXT, -- 'beginner', 'intermediate', 'advanced', 'expert'
  
  -- Amenities (JSONB for flexibility)
  amenities JSONB DEFAULT '{}', -- {driving_range: true, pro_shop: true, restaurant: true, bar: true}
  
  -- Media
  images TEXT[],
  cover_image_url TEXT,
  
  -- Metadata
  is_verified BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  external_id TEXT, -- Reference to external course database
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_golf_courses_location ON golf_courses(city, state);
CREATE INDEX idx_golf_courses_geography ON golf_courses USING GIST(location_point);
CREATE INDEX idx_golf_courses_active ON golf_courses(is_active) WHERE is_active = TRUE;
```

### golf_rounds

Golf rounds created by members.

```sql
CREATE TYPE round_format AS ENUM ('stroke_play', 'match_play', 'scramble', 'shamble', 'best_ball');
CREATE TYPE round_status AS ENUM ('open', 'full', 'in_progress', 'completed', 'cancelled');

CREATE TABLE golf_rounds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organizer_id UUID NOT NULL REFERENCES users(id),
  course_id UUID NOT NULL REFERENCES golf_courses(id),
  
  -- Round details
  round_date DATE NOT NULL,
  tee_time TIME NOT NULL,
  format round_format DEFAULT 'stroke_play',
  
  -- Capacity
  total_spots INTEGER NOT NULL DEFAULT 4,
  spots_filled INTEGER DEFAULT 1, -- Organizer counts as 1
  spots_available INTEGER GENERATED ALWAYS AS (total_spots - spots_filled) STORED,
  
  -- Settings
  is_private BOOLEAN DEFAULT FALSE,
  invite_code TEXT,
  require_approval BOOLEAN DEFAULT FALSE,
  target_tiers UUID[], -- Which tiers can see this round
  
  -- Content
  notes TEXT,
  
  -- Status
  status round_status DEFAULT 'open',
  
  -- Completion
  completed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  cancellation_reason TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_golf_rounds_organizer ON golf_rounds(organizer_id);
CREATE INDEX idx_golf_rounds_course ON golf_rounds(course_id);
CREATE INDEX idx_golf_rounds_date ON golf_rounds(round_date);
CREATE INDEX idx_golf_rounds_status ON golf_rounds(status);
CREATE INDEX idx_golf_rounds_available ON golf_rounds(status, spots_available) WHERE status = 'open';
```

### round_participants

Members participating in rounds.

```sql
CREATE TYPE participant_status AS ENUM ('confirmed', 'pending', 'declined', 'removed');

CREATE TABLE round_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id UUID NOT NULL REFERENCES golf_rounds(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  status participant_status DEFAULT 'confirmed',
  is_organizer BOOLEAN DEFAULT FALSE,
  
  -- Request details (if required approval)
  request_message TEXT,
  response_message TEXT,
  
  -- Scores (after round completion)
  gross_score INTEGER,
  net_score INTEGER,
  putts INTEGER,
  fairways_hit INTEGER,
  greens_in_regulation INTEGER,
  
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  left_at TIMESTAMPTZ,
  
  UNIQUE(round_id, user_id)
);

CREATE INDEX idx_round_participants_round ON round_participants(round_id);
CREATE INDEX idx_round_participants_user ON round_participants(user_id);
```

## Organizer Tables

### organizers

Organizer accounts for event management.

```sql
CREATE TYPE organizer_tier AS ENUM ('bronze', 'silver', 'gold');
CREATE TYPE organizer_status AS ENUM ('pending', 'active', 'suspended');

CREATE TABLE organizers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID NOT NULL UNIQUE REFERENCES users(id),
  
  -- Profile
  name TEXT NOT NULL,
  slug TEXT UNIQUE,
  description TEXT,
  website TEXT,
  email TEXT NOT NULL,
  phone TEXT,
  
  -- Location
  address TEXT,
  city TEXT,
  state TEXT,
  zip_code TEXT,
  country TEXT DEFAULT 'US',
  
  -- Media
  logo_url TEXT,
  cover_image_url TEXT,
  
  -- Tier & Status
  tier organizer_tier DEFAULT 'bronze',
  status organizer_status DEFAULT 'pending',
  
  -- Limits (based on tier)
  events_limit INTEGER DEFAULT 5,
  registrations_limit INTEGER DEFAULT 500,
  
  -- Usage
  events_used INTEGER DEFAULT 0,
  registrations_used INTEGER DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_organizers_status ON organizers(status);
```

### events

Events/tournaments created by organizers.

```sql
CREATE TYPE event_type AS ENUM ('tournament', 'clinic', 'social', 'charity', 'corporate');
CREATE TYPE event_status AS ENUM ('draft', 'published', 'registration_open', 'registration_closed', 'in_progress', 'completed', 'cancelled');

CREATE TABLE events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organizer_id UUID NOT NULL REFERENCES organizers(id),
  course_id UUID REFERENCES golf_courses(id),
  
  -- Basic info
  title TEXT NOT NULL,
  description TEXT,
  type event_type NOT NULL,
  
  -- Timing
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ,
  registration_opens_at TIMESTAMPTZ,
  registration_closes_at TIMESTAMPTZ,
  
  -- Capacity
  max_participants INTEGER,
  spots_filled INTEGER DEFAULT 0,
  waitlist_count INTEGER DEFAULT 0,
  
  -- Pricing
  entry_fee_cents INTEGER DEFAULT 0,
  stripe_product_id TEXT,
  
  -- Settings
  is_public BOOLEAN DEFAULT TRUE,
  target_tiers UUID[],
  require_approval BOOLEAN DEFAULT FALSE,
  
  -- Status
  status event_status DEFAULT 'draft',
  
  -- Media
  images TEXT[],
  cover_image_url TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_events_organizer ON events(organizer_id);
CREATE INDEX idx_events_status ON events(status);
CREATE INDEX idx_events_date ON events(start_time);
```

## Inbox Tables

### inbox_threads

Message threads for rounds and connections.

```sql
CREATE TYPE thread_type AS ENUM ('round', 'connection', 'event', 'support');

CREATE TABLE inbox_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type thread_type NOT NULL,
  
  -- Reference to parent entity
  round_id UUID REFERENCES golf_rounds(id),
  connection_id UUID REFERENCES connections(id),
  event_id UUID REFERENCES events(id),
  
  -- Thread metadata
  title TEXT NOT NULL,
  status TEXT DEFAULT 'open', -- 'open', 'closed'
  
  -- Last message tracking
  last_message_at TIMESTAMPTZ,
  last_message_preview TEXT,
  last_message_user_id UUID REFERENCES users(id),
  
  -- Participants (simplified - could be separate table for group chats)
  participant_ids UUID[] NOT NULL,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  CHECK (
    (type = 'round' AND round_id IS NOT NULL) OR
    (type = 'connection' AND connection_id IS NOT NULL) OR
    (type = 'event' AND event_id IS NOT NULL) OR
    (type = 'support')
  )
);

CREATE INDEX idx_inbox_threads_participants ON inbox_threads USING GIN(participant_ids);
CREATE INDEX idx_inbox_threads_round ON inbox_threads(round_id);
CREATE INDEX idx_inbox_threads_last_message ON inbox_threads(last_message_at DESC);
```

### inbox_messages

Individual messages within threads.

```sql
CREATE TABLE inbox_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID NOT NULL REFERENCES inbox_threads(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES users(id),
  
  content TEXT NOT NULL,
  
  -- Client-side deduplication
  client_message_id TEXT,
  
  -- Status
  edited_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_inbox_messages_thread ON inbox_messages(thread_id);
CREATE INDEX idx_inbox_messages_created ON inbox_messages(created_at);
```

## RLS Policies

### Example: users table

```sql
-- Users can see their own record
CREATE POLICY "Users can view own profile"
  ON users FOR SELECT
  USING (auth.uid() = supabase_auth_id);

-- Users can see same-tier profiles
CREATE POLICY "Users can view same-tier profiles"
  ON users FOR SELECT
  USING (
    tier_id = (
      SELECT tier_id FROM users WHERE supabase_auth_id = auth.uid()
    )
  );

-- Users can update own profile
CREATE POLICY "Users can update own profile"
  ON users FOR UPDATE
  USING (auth.uid() = supabase_auth_id);
```

### Example: golf_rounds table

```sql
-- Anyone can view open rounds in their tier
CREATE POLICY "View rounds in tier"
  ON golf_rounds FOR SELECT
  USING (
    status = 'open'
    AND (
      is_private = FALSE
      OR organizer_id = auth.uid()
      OR auth.uid() IN (
        SELECT user_id FROM round_participants WHERE round_id = golf_rounds.id
      )
    )
  );

-- Organizers can update their rounds
CREATE POLICY "Organizers can update rounds"
  ON golf_rounds FOR UPDATE
  USING (organizer_id = auth.uid());
```

## Triggers

### Update timestamps

```sql
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply to all tables
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

### Reputation recalculation

```sql
CREATE OR REPLACE FUNCTION recalculate_reputation()
RETURNS TRIGGER AS $$
BEGIN
  -- Recalculate reputation score
  UPDATE reputation_scores
  SET
    profile_completeness_score = calculate_profile_completeness(NEW.user_id),
    completion_rate_score = calculate_completion_rate(NEW.user_id),
    -- ... other scores
    overall_score = calculate_overall_reputation(NEW.user_id),
    last_calculated_at = NOW()
  WHERE user_id = NEW.user_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_reputation_on_participation
  AFTER INSERT OR UPDATE ON round_participants
  FOR EACH ROW EXECUTE FUNCTION recalculate_reputation();
```

## Indexes Reference

### Performance-Critical Indexes

```sql
-- User discovery
CREATE INDEX CONCURRENTLY idx_users_searchable_tier ON users(searchable, tier_id) WHERE searchable = TRUE;
CREATE INDEX CONCURRENTLY idx_users_location_point ON users USING GIST(location_point);

-- Round listings
CREATE INDEX CONCURRENTLY idx_rounds_available_date ON golf_rounds(status, round_date, spots_available) 
  WHERE status = 'open';

-- Connections
CREATE INDEX CONCURRENTLY idx_connections_users ON connections(requester_id, receiver_id, status);

-- Messages
CREATE INDEX CONCURRENTLY idx_messages_thread_created ON inbox_messages(thread_id, created_at DESC);
```

## Related Documentation

- [Architecture Overview](./architecture-overview.md) - System architecture
- [Testing Guide](./testing-guide.md) - Database testing
- [API Documentation](../api/) - API reference

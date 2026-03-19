# Spotter Database

Database migrations and schema for Spotter.

## Overview

PostgreSQL database managed with Supabase CLI:
- **15+ tables** for core functionality
- **Row Level Security (RLS)** for same-tier visibility
- **Triggers** for computed fields
- **Indexes** for performance

## Project Structure

```
packages/db/
└── migrations/
    ├── 0001_initial.sql              # Initial schema
    ├── 0014_tier_system.sql          # Tier system
    ├── 0015_golf_schema.sql          # Golf tables
    ├── 0016_login_system.sql         # Login system
    ├── 0017_profile_networking.sql    # Profile + networking
    └── seed.sql                       # Seed data
```

## Key Tables

### Core

| Table | Description |
|-------|-------------|
| `users` | User accounts with tier assignment |
| `membership_tiers` | Tier definitions (FREE, SELECT, SUMMIT) |
| `connections` | Member networking connections |
| `reputation_scores` | Calculated reputation |
| `tier_history` | Tier change audit trail |

### Golf

| Table | Description |
|-------|-------------|
| `golf_courses` | Golf course information |
| `golf_rounds` | Golf rounds/foursomes |
| `round_participants` | Round participants |
| `round_invites` | Private round invites |

### Organizer

| Table | Description |
|-------|-------------|
| `organizers` | Organizer accounts |
| `events` | Tournament events |
| `event_registrations` | Event registrations |
| `organizer_members` | Organizer team members |

### Inbox

| Table | Description |
|-------|-------------|
| `inbox_threads` | Message threads |
| `inbox_messages` | Individual messages |

## Migrations

### Running Migrations

```bash
# Local
supabase db reset

# Staging
supabase db push --db-url <staging_url>

# Production
supabase db push
```

### Creating New Migration

```bash
# Create migration file
supabase migration new add_new_feature

# Edit file
# migrations/00XX_add_new_feature.sql

# Apply
supabase db reset
```

### Migration Format

```sql
-- Up migration
CREATE TABLE new_table (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_new_table_name ON new_table(name);

-- Enable RLS
ALTER TABLE new_table ENABLE ROW LEVEL SECURITY;

-- Create policy
CREATE POLICY new_table_select_all ON new_table
  FOR SELECT USING (true);

-- Down migration (for rollback)
-- DROP TABLE IF EXISTS new_table;
```

## RLS Policies

### Same-Tier Visibility

```sql
-- Users can only see same-tier profiles
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

### Connection Visibility

```sql
-- Users can see their own connections
CREATE POLICY connections_select_involved ON connections
  FOR SELECT USING (
    auth.uid() = requester_id 
    OR auth.uid() = addressee_id
  );
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

CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
```

### Update round spots

```sql
CREATE TRIGGER trg_update_spots
  AFTER INSERT OR UPDATE OR DELETE ON round_participants
  FOR EACH ROW EXECUTE FUNCTION update_round_spots_available();
```

## Seed Data

```bash
# Seed local database
supabase seed run

# Or manual
psql $DATABASE_URL < seed.sql
```

### Seed File

```sql
-- Seed membership tiers
INSERT INTO membership_tiers (name, slug, price_cents, billing_interval) VALUES
  ('Free', 'free', 0, 'annual'),
  ('Select', 'select', 100000, 'annual'),
  ('Summit', 'summit', 1000000, 'lifetime');

-- Seed courses
INSERT INTO golf_courses (name, city, state, par_total) VALUES
  ('TPC Scottsdale', 'Scottsdale', 'AZ', 71),
  ('Grayhawk Golf Club', 'Scottsdale', 'AZ', 72);
```

## Performance

### Indexes

```sql
-- Users
CREATE INDEX idx_users_tier ON users(tier_id);
CREATE INDEX idx_users_email ON users(email);

-- Connections
CREATE INDEX idx_connections_requester ON connections(requester_id);
CREATE INDEX idx_connections_status ON connections(status);

-- Rounds
CREATE INDEX idx_rounds_date ON golf_rounds(round_date);
CREATE INDEX idx_rounds_status ON golf_rounds(status);

-- Geospatial
CREATE INDEX idx_courses_location ON golf_courses USING GIST(location);
```

## Backup

```bash
# Export database
supabase db dump > backup.sql

# Import
supabase db restore backup.sql
```

## Development

```bash
# Start local database
supabase start

# Connect
psql postgresql://postgres:postgres@localhost:54322/postgres

# Reset
supabase db reset

# Check status
supabase status
```

## Schema Documentation

See [Database Documentation](../../docs/dev/database.md) for complete schema reference.

## Related

- [Architecture](../../docs/dev/architecture.md)
- [Root README](../../README.md)

-- Profile and Networking Schema Migration
-- Creates extended profiles, connections, and reputation system

-- ============================================
-- UP MIGRATION
-- ============================================

-- 1. Create enum types
-- Connection status enum
create type public.connection_status as enum (
  'pending',
  'accepted',
  'declined',
  'blocked'
);

-- Connection type enum
create type public.connection_type as enum (
  'played_together',
  'introduced',
  'met_offline',
  'online_only'
);

-- Intro status enum
create type public.intro_status as enum (
  'pending',
  'accepted',
  'declined',
  'expired'
);

-- Play frequency enum
create type public.play_frequency as enum (
  'weekly',
  'biweekly',
  'monthly',
  'occasionally'
);

-- Reputation event type enum
create type public.reputation_event_type as enum (
  'round_completed',
  'round_no_show',
  'round_cancelled',
  'rating_received',
  'connection_accepted',
  'referral_made',
  'profile_completed',
  'attendance_perfect_month',
  'tier_upgraded',
  'intro_given'
);

-- 2. Add professional identity columns to users table
alter table public.users
  add column if not exists current_role text,
  add column if not exists company text,
  add column if not exists company_verified boolean not null default false,
  add column if not exists industry text,
  add column if not exists linkedin_url text,
  add column if not exists years_of_experience integer;

-- 3. Add golf identity columns to users table
alter table public.users
  add column if not exists handicap numeric(4, 1),
  add column if not exists handicap_verified boolean not null default false,
  add column if not exists home_course_id uuid references public.golf_courses(id) on delete set null,
  add column if not exists play_frequency public.play_frequency,
  add column if not exists preferred_tee_times jsonb not null default '[]'::jsonb,
  add column if not exists years_playing integer;

-- 4. Create connections table (member networking)
create table if not exists public.connections (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.users(id) on delete cascade,
  addressee_id uuid not null references public.users(id) on delete cascade,
  -- Connection status
  status public.connection_status not null default 'pending',
  -- Timestamps
  requested_at timestamptz not null default now(),
  responded_at timestamptz,
  -- Context
  tier_at_connection text not null, -- store tier at time of connection
  connection_type public.connection_type not null default 'online_only',
  -- Metadata
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Constraints
  check (requester_id != addressee_id),
  unique(requester_id, addressee_id)
);

-- 5. Create connection_intros table (introductions via mutual connections)
create table if not exists public.connection_intros (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null references public.connections(id) on delete cascade,
  introducer_id uuid not null references public.users(id) on delete cascade,
  -- Status
  status public.intro_status not null default 'pending',
  -- Content
  message text,
  -- Credits used
  intro_credits_used integer not null default 1,
  -- Timestamps
  sent_at timestamptz not null default now(),
  responded_at timestamptz,
  expires_at timestamptz, -- intros can expire if not responded to
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 6. Create reputation_scores table (trust/reputation system)
create table if not exists public.reputation_scores (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.users(id) on delete cascade,
  -- Overall score (0-100)
  overall_score integer not null default 50,
  -- Component scores (weights in comments)
  completion_rate integer not null default 50,      -- 30%
  ratings_average integer not null default 50,      -- 25%
  network_size integer not null default 0,            -- 15%
  referrals_count integer not null default 0,       -- 15%
  profile_completeness integer not null default 0,  -- 10%
  attendance_rate integer not null default 100,   -- 5%
  -- Calculation tracking
  calculated_at timestamptz not null default now(),
  recalculate_at timestamptz, -- when next recalculation is due
  -- Timestamps
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Constraints
  check (overall_score between 0 and 100),
  check (completion_rate between 0 and 100),
  check (ratings_average between 0 and 100),
  check (profile_completeness between 0 and 100),
  check (attendance_rate between 0 and 100),
  unique(member_id)
);

-- 7. Create reputation_events table (audit trail)
create table if not exists public.reputation_events (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.users(id) on delete cascade,
  -- Event details
  event_type public.reputation_event_type not null,
  points_change integer not null default 0,
  reason text not null,
  -- Related entities (optional)
  round_id uuid references public.golf_rounds(id) on delete set null,
  connection_id uuid references public.connections(id) on delete set null,
  rating_id uuid, -- placeholder for future ratings table
  -- Metadata
  metadata jsonb not null default '{}'::jsonb,
  -- Timestamp
  created_at timestamptz not null default now()
);

-- 8. Create indexes for performance

-- Connections indexes
create index if not exists idx_connections_requester on public.connections(requester_id);
create index if not exists idx_connections_addressee on public.connections(addressee_id);
create index if not exists idx_connections_status on public.connections(status);
create index if not exists idx_connections_tier on public.connections(tier_at_connection);
create index if not exists idx_connections_responded_at on public.connections(responded_at) where responded_at is not null;

-- Connection intros indexes
create index if not exists idx_connection_intros_connection on public.connection_intros(connection_id);
create index if not exists idx_connection_intros_introducer on public.connection_intros(introducer_id);
create index if not exists idx_connection_intros_status on public.connection_intros(status);
create index if not exists idx_connection_intros_expires on public.connection_intros(expires_at) where status = 'pending';

-- Reputation scores indexes
create index if not exists idx_reputation_member on public.reputation_scores(member_id);
create index if not exists idx_reputation_score on public.reputation_scores(overall_score desc);
create index if not exists idx_reputation_recalculate on public.reputation_scores(recalculate_at) where recalculate_at <= now();

-- Reputation events indexes
create index if not exists idx_reputation_events_member on public.reputation_events(member_id, created_at desc);
create index if not exists idx_reputation_events_type on public.reputation_events(event_type, created_at desc);

-- Users table indexes for new columns
create index if not exists idx_users_company on public.users(company) where company is not null;
create index if not exists idx_users_industry on public.users(industry) where industry is not null;
create index if not exists idx_users_handicap on public.users(handicap) where handicap is not null;
create index if not exists idx_users_home_course on public.users(home_course_id) where home_course_id is not null;

-- 9. Enable RLS on new tables
alter table public.connections enable row level security;
alter table public.connection_intros enable row level security;
alter table public.reputation_scores enable row level security;
alter table public.reputation_events enable row level security;

-- 10. Create RLS policies for connections

-- Users can see connections they're part of (requester or addressee)
-- AND only if they're in the same tier (enforced via tier_at_connection matching user's current tier)
create policy connections_select_involved on public.connections
  for select using (
    (auth.uid() = requester_id or auth.uid() = addressee_id)
    and exists (
      select 1
      from public.users current_user
      where current_user.id = auth.uid()
        and connections.tier_at_connection = (
          select mt.slug from public.membership_tiers mt where mt.id = current_user.tier_id
        )
    )
  );

-- Users can create connection requests
-- Enforces same-tier connection visibility
-- Note: This allows cross-tier requests at DB level; app-level enforcement is also needed
create policy connections_insert_requester on public.connections
  for insert with check (
    auth.uid() = requester_id
    -- Both users must be in the same tier
    and tier_at_connection = (
      select mt.slug
      from public.users u
      join public.membership_tiers mt on mt.id = u.tier_id
      where u.id = auth.uid()
    )
  );

-- Users can update connections they're part of (accept/decline/block)
create policy connections_update_involved on public.connections
  for update using (
    auth.uid() = requester_id or auth.uid() = addressee_id
  ) with check (
    auth.uid() = requester_id or auth.uid() = addressee_id
  );

-- Users can delete their own sent pending requests
create policy connections_delete_requester on public.connections
  for delete using (
    auth.uid() = requester_id and status = 'pending'
  );

-- 11. Create RLS policies for connection_intros

-- Users can see intros related to their connections
create policy connection_intros_select_involved on public.connection_intros
  for select using (
    exists (
      select 1 from public.connections c
      where c.id = connection_intros.connection_id
        and (c.requester_id = auth.uid() or c.addressee_id = auth.uid())
    )
    or auth.uid() = introducer_id
  );

-- Users can create intros for connections they're part of
create policy connection_intros_insert_introducer on public.connection_intros
  for insert with check (
    auth.uid() = introducer_id
    and exists (
      select 1 from public.connections c
      where c.id = connection_intros.connection_id
        and (c.requester_id = auth.uid() or c.addressee_id = auth.uid())
        and c.status = 'accepted'
    )
  );

-- Involved parties can update intros (accept/decline)
create policy connection_intros_update_involved on public.connection_intros
  for update using (
    exists (
      select 1 from public.connections c
      where c.id = connection_intros.connection_id
        and (c.requester_id = auth.uid() or c.addressee_id = auth.uid())
    )
    or auth.uid() = introducer_id
  ) with check (
    exists (
      select 1 from public.connections c
      where c.id = connection_intros.connection_id
        and (c.requester_id = auth.uid() or c.addressee_id = auth.uid())
    )
    or auth.uid() = introducer_id
  );

-- Introducer can delete their own pending intro
create policy connection_intros_delete_introducer on public.connection_intros
  for delete using (
    auth.uid() = introducer_id and status = 'pending'
  );

-- 12. Create RLS policies for reputation_scores

-- Users can see reputation scores of users in their tier (same-tier visibility)
-- AND their own score
create policy reputation_scores_select_visible on public.reputation_scores
  for select using (
    auth.uid() = member_id
    or exists (
      select 1
      from public.users current_user
      join public.users target_user on target_user.id = reputation_scores.member_id
      where current_user.id = auth.uid()
        and current_user.tier_id = target_user.tier_id
    )
  );

-- Users can only insert/update their own score
-- (In practice, this should be done via system functions)
create policy reputation_scores_insert_own on public.reputation_scores
  for insert with check (auth.uid() = member_id);

create policy reputation_scores_update_own on public.reputation_scores
  for update using (auth.uid() = member_id) with check (auth.uid() = member_id);

create policy reputation_scores_delete_own on public.reputation_scores
  for delete using (auth.uid() = member_id);

-- 13. Create RLS policies for reputation_events

-- Users can see their own reputation events
create policy reputation_events_select_own on public.reputation_events
  for select using (auth.uid() = member_id);

-- System can insert events (but not regular users directly)
create policy reputation_events_insert_system on public.reputation_events
  for insert with check (false); -- Only via security definer functions

-- 14. Create trigger functions

-- Function to auto-update responded_at on connection status change
create or replace function public.update_connection_responded_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Set responded_at when status changes from pending
  if old.status = 'pending' and new.status != 'pending' then
    new.responded_at = now();
  end if;
  return new;
end;
$$;

-- Apply trigger to connections
-- Note: Trigger created below after we handle updated_at triggers

-- Function to auto-update responded_at on intro status change
create or replace function public.update_intro_responded_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Set responded_at when status changes from pending
  if old.status = 'pending' and new.status != 'pending' then
    new.responded_at = now();
  end if;
  return new;
end;
$$;

-- Function to update recalculate_at when reputation score changes
create or replace function public.update_reputation_recalculate()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Set recalculate_at to 24 hours from now
  new.recalculate_at = now() + interval '24 hours';
  return new;
end;
$$;

-- 15. Add updated_at triggers for all new tables

-- Get existing set_updated_at function or create it
-- (Assuming it exists from previous migrations, but safe to check)
do $$
begin
  if not exists (
    select 1 from pg_proc
    where proname = 'set_updated_at'
      and pronamespace = 'public'::regnamespace
  ) then
    create or replace function public.set_updated_at()
    returns trigger
    language plpgsql
    security definer
    set search_path = public
    as $$
    begin
      new.updated_at = now();
      return new;
    end;
    $$;
  end if;
end $$;

-- Apply triggers
-- Note: These need to be created even if they exist (no-op if exists)

-- Connections triggers
create trigger trg_connections_updated_at
  before update on public.connections
  for each row
  execute function public.set_updated_at();

create trigger trg_connections_responded_at
  before update on public.connections
  for each row
  execute function public.update_connection_responded_at();

-- Connection intros triggers
create trigger trg_connection_intros_updated_at
  before update on public.connection_intros
  for each row
  execute function public.set_updated_at();

create trigger trg_connection_intros_responded_at
  before update on public.connection_intros
  for each row
  execute function public.update_intro_responded_at();

-- Reputation triggers
create trigger trg_reputation_scores_updated_at
  before update on public.reputation_scores
  for each row
  execute function public.set_updated_at();

create trigger trg_reputation_scores_recalculate
  before update on public.reputation_scores
  for each row
  execute function public.update_reputation_recalculate();

-- 16. Add realtime publication for new tables
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.connections;
    alter publication supabase_realtime add table public.connection_intros;
    alter publication supabase_realtime add table public.reputation_scores;
    alter publication supabase_realtime add table public.reputation_events;
  end if;
end $$;

-- 17. Create helper function to calculate profile completeness
create or replace function public.calculate_profile_completeness(p_user_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_completeness integer := 0;
  v_user record;
begin
  select * into v_user
  from public.users
  where id = p_user_id;

  if v_user is null then
    return 0;
  end if;

  -- Basic profile (20 points)
  if v_user.display_name is not null then v_completeness := v_completeness + 5; end if;
  if v_user.bio is not null then v_completeness := v_completeness + 5; end if;
  if v_user.avatar_url is not null then v_completeness := v_completeness + 5; end if;
  if v_user.timezone is not null then v_completeness := v_completeness + 5; end if;

  -- Professional identity (30 points)
  if v_user.current_role is not null then v_completeness := v_completeness + 10; end if;
  if v_user.company is not null then v_completeness := v_completeness + 10; end if;
  if v_user.industry is not null then v_completeness := v_completeness + 10; end if;

  -- Golf identity (50 points)
  if v_user.handicap is not null then v_completeness := v_completeness + 15; end if;
  if v_user.home_course_id is not null then v_completeness := v_completeness + 10; end if;
  if v_user.play_frequency is not null then v_completeness := v_completeness + 10; end if;
  if v_user.years_playing is not null then v_completeness := v_completeness + 10; end if;
  if v_user.preferred_tee_times is not null and jsonb_array_length(v_user.preferred_tee_times) > 0 then
    v_completeness := v_completeness + 5;
  end if;

  return least(v_completeness, 100);
end;
$$;

-- 18. Create trigger function to auto-update profile completeness
create or replace function public.auto_update_profile_completeness()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_completeness integer;
begin
  -- Calculate new completeness
  v_completeness := public.calculate_profile_completeness(new.id);

  -- Update reputation score if exists
  update public.reputation_scores
  set profile_completeness = v_completeness,
      updated_at = now()
  where member_id = new.id;

  -- Insert new reputation score if doesn't exist
  if not found then
    insert into public.reputation_scores (
      member_id,
      profile_completeness
    ) values (
      new.id,
      v_completeness
    );
  end if;

  return new;
end;
$$;

-- Apply trigger to users table for profile changes
create trigger trg_users_profile_completeness
  after update of display_name, bio, avatar_url, timezone,
                  current_role, company, industry,
                  handicap, home_course_id, play_frequency, years_playing, preferred_tee_times
  on public.users
  for each row
  execute function public.auto_update_profile_completeness();

-- ============================================
-- DOWN MIGRATION (rollback)
-- ============================================
/*
-- Remove triggers
-- Note: Drop in reverse order of creation
drop trigger if exists trg_users_profile_completeness on public.users;
drop trigger if exists trg_reputation_scores_recalculate on public.reputation_scores;
drop trigger if exists trg_reputation_scores_updated_at on public.reputation_scores;
drop trigger if exists trg_connection_intros_responded_at on public.connection_intros;
drop trigger if exists trg_connection_intros_updated_at on public.connection_intros;
drop trigger if exists trg_connections_responded_at on public.connections;
drop trigger if exists trg_connections_updated_at on public.connections;

-- Remove functions
drop function if exists public.auto_update_profile_completeness();
drop function if exists public.calculate_profile_completeness(uuid);
drop function if exists public.update_reputation_recalculate();
drop function if exists public.update_intro_responded_at();
drop function if exists public.update_connection_responded_at();

-- Remove RLS policies
-- Connections
drop policy if exists connections_select_involved on public.connections;
drop policy if exists connections_insert_requester on public.connections;
drop policy if exists connections_update_involved on public.connections;
drop policy if exists connections_delete_requester on public.connections;

-- Connection intros
drop policy if exists connection_intros_select_involved on public.connection_intros;
drop policy if exists connection_intros_insert_introducer on public.connection_intros;
drop policy if exists connection_intros_update_involved on public.connection_intros;
drop policy if exists connection_intros_delete_introducer on public.connection_intros;

-- Reputation scores
drop policy if exists reputation_scores_select_visible on public.reputation_scores;
drop policy if exists reputation_scores_insert_own on public.reputation_scores;
drop policy if exists reputation_scores_update_own on public.reputation_scores;
drop policy if exists reputation_scores_delete_own on public.reputation_scores;

-- Reputation events
drop policy if exists reputation_events_select_own on public.reputation_events;
drop policy if exists reputation_events_insert_system on public.reputation_events;

-- Disable RLS
alter table public.connections disable row level security;
alter table public.connection_intros disable row level security;
alter table public.reputation_scores disable row level security;
alter table public.reputation_events disable row level security;

-- Remove realtime publication
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime drop table public.connections;
    alter publication supabase_realtime drop table public.connection_intros;
    alter publication supabase_realtime drop table public.reputation_scores;
    alter publication supabase_realtime drop table public.reputation_events;
  end if;
end $$;

-- Remove indexes
-- Connections
drop index if exists idx_connections_requester;
drop index if exists idx_connections_addressee;
drop index if exists idx_connections_status;
drop index if exists idx_connections_tier;
drop index if exists idx_connections_responded_at;

-- Connection intros
drop index if exists idx_connection_intros_connection;
drop index if exists idx_connection_intros_introducer;
drop index if exists idx_connection_intros_status;
drop index if exists idx_connection_intros_expires;

-- Reputation
drop index if exists idx_reputation_member;
drop index if exists idx_reputation_score;
drop index if exists idx_reputation_recalculate;
drop index if exists idx_reputation_events_member;
drop index if exists idx_reputation_events_type;

-- Users
drop index if exists idx_users_company;
drop index if exists idx_users_industry;
drop index if exists idx_users_handicap;
drop index if exists idx_users_home_course;

-- Drop tables
drop table if exists public.reputation_events;
drop table if exists public.reputation_scores;
drop table if exists public.connection_intros;
drop table if exists public.connections;

-- Drop columns from users
drop type if exists public.play_frequency cascade;

alter table public.users
  drop column if exists current_role,
  drop column if exists company,
  drop column if exists company_verified,
  drop column if exists industry,
  drop column if exists linkedin_url,
  drop column if exists years_of_experience,
  drop column if exists handicap,
  drop column if exists handicap_verified,
  drop column if exists home_course_id,
  drop column if exists play_frequency,
  drop column if exists preferred_tee_times,
  drop column if exists years_playing;

-- Drop enum types
drop type if exists public.connection_status;
drop type if exists public.connection_type;
drop type if exists public.intro_status;
drop type if exists public.reputation_event_type;
*/

-- Epic 6: Trust & Reliability Layer Migration
-- Creates tables for reliability scoring, vouching, incidents, and trust badges

-- ============================================
-- UP MIGRATION
-- ============================================

-- 1. Update user_reputation table with reliability fields
alter table public.user_reputation
  add column if not exists show_rate decimal(5, 2) not null default 100.00,
  add column if not exists punctuality_rate decimal(5, 2) not null default 100.00,
  add column if not exists reliability_score integer not null default 50,
  add column if not exists reliability_label varchar(20) not null default 'Building',
  add column if not exists rounds_completed integer not null default 0,
  add column if not exists rounds_scheduled integer not null default 0,
  add column if not exists minutes_early_avg integer default 0, -- average minutes early (negative = late)
  add column if not exists last_reliability_calc_at timestamptz;

-- Add constraint for reliability score range
alter table public.user_reputation
  add constraint chk_reliability_score_range check (reliability_score between 0 and 100);

-- Add constraint for reliability labels
alter table public.user_reputation
  add constraint chk_reliability_label check (reliability_label in ('Building', 'Reliable', 'Trusted', 'Exceptional'));

-- 2. Create vouches table
-- Vouches are earned after playing 3+ rounds together
-- Max 5 vouches per user to prevent gaming
-- Vouches expire after 1 year

create table if not exists public.vouches (
  id uuid primary key default gen_random_uuid(),
  voucher_id uuid not null references public.users(id) on delete cascade,
  vouched_id uuid not null references public.users(id) on delete cascade,
  -- Context at time of vouch
  round_count_at_vouch integer not null default 3,
  shared_rounds_count integer not null default 0, -- actual count when vouched
  -- Status
  status varchar(20) not null default 'active',
  -- Timestamps
  created_at timestamptz not null default now(),
  expires_at timestamptz not null, -- auto-calculated: created_at + 1 year
  revoked_at timestamptz,
  revoked_reason text,
  -- Metadata
  notes text, -- optional private notes from voucher
  
  -- Constraints
  check (voucher_id <> vouched_id),
  check (round_count_at_vouch >= 3),
  check (status in ('active', 'expired', 'revoked')),
  unique(voucher_id, vouched_id)
);

-- 3. Create incident severity enum and status enum
create type public.incident_severity as enum ('minor', 'moderate', 'serious');
create type public.incident_status as enum ('reported', 'under_review', 'resolved', 'dismissed');

-- 4. Create incidents table
-- Private reporting - no public shaming
create table if not exists public.incidents (
  id uuid primary key default gen_random_uuid(),
  -- Reporter and reported
  reporter_id uuid not null references public.users(id) on delete cascade,
  reported_id uuid not null references public.users(id) on delete cascade,
  -- Optional round context
  round_id uuid references public.golf_rounds(id) on delete set null,
  -- Classification
  severity public.incident_severity not null,
  category varchar(50) not null, -- 'no_show', 'late', 'behavior', 'safety', 'other'
  description text not null,
  -- Status tracking
  status public.incident_status not null default 'reported',
  -- Resolution
  resolution_notes text,
  resolved_at timestamptz,
  resolved_by uuid references public.users(id) on delete set null, -- admin who resolved
  -- Impact on reliability (internal only)
  reliability_impact integer default 0, -- negative points applied
  -- Timestamps
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  
  -- Constraints
  check (reporter_id <> reported_id),
  check (reliability_impact between -50 and 0)
);

-- 5. Create trust_badges table
-- Extending badge system for trust/reliability
create type public.trust_badge_type as enum (
  'first_round',           -- Completed first round
  'reliable_player',       -- 95%+ reliability score
  'punctual',              -- Always on time (avg 5+ min early)
  'social_connector',      -- 10+ connections made
  'community_vouched',     -- Received 3+ vouches
  'regular',               -- 10+ rounds completed
  'veteran',               -- 50+ rounds completed
  'exceptional',           -- 98%+ reliability + 20+ rounds
  'vouch_giver'            -- Given 5+ vouches to others
);

create table if not exists public.trust_badges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  badge_type public.trust_badge_type not null,
  -- Display
  display_name varchar(50) not null,
  description text,
  icon_url text,
  -- Status
  is_visible boolean not null default true,
  -- Timestamps
  awarded_at timestamptz not null default now(),
  revoked_at timestamptz,
  revoked_reason text,
  -- Source tracking (which criteria triggered)
  awarded_reason text,
  
  unique(user_id, badge_type)
);

-- 6. Create user_reliability_history table
-- Track reliability changes over time for analytics
create table if not exists public.user_reliability_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  reliability_score integer not null,
  reliability_label varchar(20) not null,
  show_rate decimal(5, 2) not null,
  punctuality_rate decimal(5, 2) not null,
  -- Change tracking
  change_reason varchar(50) not null, -- 'nightly_calc', 'incident', 'badge_awarded', etc.
  change_amount integer default 0,
  -- Context
  rounds_completed integer not null default 0,
  rounds_scheduled integer not null default 0,
  -- Snapshot date
  calculated_at timestamptz not null default now()
);

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================

-- Vouches indexes
create index if not exists idx_vouches_voucher on public.vouches(voucher_id, status);
create index if not exists idx_vouches_vouched on public.vouches(vouched_id, status);
create index if not exists idx_vouches_expires on public.vouches(expires_at) where status = 'active';

-- Incidents indexes
create index if not exists idx_incidents_reported on public.incidents(reported_id, status);
create index if not exists idx_incidents_reporter on public.incidents(reporter_id, created_at desc);
create index if not exists idx_incidents_round on public.incidents(round_id);
create index if not exists idx_incidents_status on public.incidents(status, created_at desc);

-- Trust badges indexes
create index if not exists idx_trust_badges_user on public.trust_badges(user_id, is_visible);
create index if not exists idx_trust_badges_type on public.trust_badges(badge_type);

-- Reliability history indexes
create index if not exists idx_reliability_history_user on public.user_reliability_history(user_id, calculated_at desc);

-- Reputation reliability indexes
create index if not exists idx_reputation_reliability on public.user_reputation(reliability_score desc) where reliability_score >= 95;

-- ============================================
-- ENABLE RLS
-- ============================================

alter table public.vouches enable row level security;
alter table public.incidents enable row level security;
alter table public.trust_badges enable row level security;
alter table public.user_reliability_history enable row level security;

-- ============================================
-- RLS POLICIES
-- ============================================

-- Vouches policies
-- Users can see vouches they've given or received
-- Vouches are visible to same-tier users (promotes trust)
create policy vouches_select_visible on public.vouches
  for select using (
    -- Own vouches (as voucher or vouched)
    voucher_id = auth.uid() or vouched_id = auth.uid()
    -- Same-tier visibility for trust building
    or exists (
      select 1 from public.users u1
      join public.users u2 on u2.id in (voucher_id, vouched_id)
      where u1.id = auth.uid()
        and u1.tier_id = u2.tier_id
    )
  );

-- Users can create vouches (system validates criteria)
create policy vouches_insert_own on public.vouches
  for insert with check (voucher_id = auth.uid());

-- Users can only revoke their own vouches
create policy vouches_update_own on public.vouches
  for update using (voucher_id = auth.uid()) with check (voucher_id = auth.uid());

-- Incidents policies - PRIVATE REPORTING
-- Only reporter and reported can see their own incidents
-- Admins can see all (handled separately via admin role)
create policy incidents_select_own on public.incidents
  for select using (
    reporter_id = auth.uid() or reported_id = auth.uid()
  );

-- Anyone can report (system validates)
create policy incidents_insert_any on public.incidents
  for insert with check (reporter_id = auth.uid());

-- No user updates - only system/admin

-- Trust badges policies
-- Visible to same-tier users
create policy trust_badges_select_visible on public.trust_badges
  for select using (
    user_id = auth.uid()
    or exists (
      select 1 from public.users u1
      join public.users u2 on u2.id = trust_badges.user_id
      where u1.id = auth.uid()
        and u1.tier_id = u2.tier_id
    )
  );

-- System only for insert/update
create policy trust_badges_insert_system on public.trust_badges
  for insert with check (false);

create policy trust_badges_update_system on public.trust_badges
  for update using (false) with check (false);

-- Reliability history - own data only
create policy reliability_history_select_own on public.user_reliability_history
  for select using (user_id = auth.uid());

-- System only for insert
create policy reliability_history_insert_system on public.user_reliability_history
  for insert with check (false);

-- ============================================
-- FUNCTIONS
-- ============================================

-- Function to calculate vouch expiration
create or replace function public.calculate_vouch_expires()
returns trigger
language plpgsql
as $$
begin
  new.expires_at := new.created_at + interval '1 year';
  return new;
end;
$$;

-- Trigger for vouch expiration
create trigger trg_vouches_set_expires
  before insert on public.vouches
  for each row execute function public.calculate_vouch_expires();

-- Function to auto-expire vouches
create or replace function public.expire_old_vouches()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.vouches
  set status = 'expired'
  where status = 'active'
    and expires_at < now();
end;
$$;

-- Function to count active vouches for a user
create or replace function public.count_active_vouches(p_user_id uuid)
returns integer
language sql
security definer
stable
set search_path = public
as $$
  select count(*)::integer
  from public.vouches
  where vouched_id = p_user_id
    and status = 'active';
$$;

-- Function to check if user can vouch (max 5 given)
create or replace function public.can_give_vouch(p_voucher_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select count(*) < 5
  from public.vouches
  where voucher_id = p_voucher_id
    and status in ('active', 'expired');
$$;

-- Function to calculate discovery boost score
create or replace function public.calculate_discovery_boost(p_user_id uuid)
returns decimal(5, 2)
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  v_reliability_score integer;
  v_trust_badge_count integer;
  v_boost decimal(5, 2) := 1.00;
begin
  -- Get reliability score
  select reliability_score into v_reliability_score
  from public.user_reputation
  where user_id = p_user_id;
  
  -- +30% boost for 95%+ reliability
  if v_reliability_score >= 95 then
    v_boost := v_boost + 0.30;
  elsif v_reliability_score >= 85 then
    v_boost := v_boost + 0.15;
  elsif v_reliability_score >= 75 then
    v_boost := v_boost + 0.05;
  end if;
  
  -- +20% for trust badges
  select count(*) into v_trust_badge_count
  from public.trust_badges
  where user_id = p_user_id
    and is_visible = true;
  
  if v_trust_badge_count >= 3 then
    v_boost := v_boost + 0.20;
  elsif v_trust_badge_count >= 1 then
    v_boost := v_boost + 0.10;
  end if;
  
  return v_boost;
end;
$$;

-- Function to update reliability label based on score
create or replace function public.calculate_reliability_label(p_score integer)
returns varchar(20)
language sql
immutable
as $$
  select case
    when p_score >= 98 then 'Exceptional'
    when p_score >= 90 then 'Trusted'
    when p_score >= 75 then 'Reliable'
    else 'Building'
  end;
$$;

-- Updated_at trigger for incidents
alter table public.incidents
  add column if not exists updated_at timestamptz not null default now();

-- Check if set_updated_at function exists, create if not
do $$
begin
  if not exists (select 1 from pg_proc where proname = 'set_updated_at') then
    create function public.set_updated_at()
    returns trigger as $func$
    begin
      new.updated_at := now();
      return new;
    end;
    $func$ language plpgsql;
  end if;
end $$;

create trigger trg_incidents_updated_at
  before update on public.incidents
  for each row execute function public.set_updated_at();

-- ============================================
-- REALTIME PUBLICATION
-- ============================================

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.trust_badges;
  end if;
end $$;

-- ============================================
-- DOWN MIGRATION (rollback)
-- ============================================
-- Note: Uncomment to run rollback
/*
-- Drop triggers
drop trigger if exists trg_vouches_set_expires on public.vouches;
drop trigger if exists trg_incidents_updated_at on public.incidents;

-- Drop functions
drop function if exists public.calculate_vouch_expires();
drop function if exists public.expire_old_vouches();
drop function if exists public.count_active_vouches(uuid);
drop function if exists public.can_give_vouch(uuid);
drop function if exists public.calculate_discovery_boost(uuid);
drop function if exists public.calculate_reliability_label(integer);

-- Remove realtime
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime drop table public.trust_badges;
  end if;
end $$;

-- Drop RLS policies
drop policy if exists vouches_select_visible on public.vouches;
drop policy if exists vouches_insert_own on public.vouches;
drop policy if exists vouches_update_own on public.vouches;

drop policy if exists incidents_select_own on public.incidents;
drop policy if exists incidents_insert_any on public.incidents;

drop policy if exists trust_badges_select_visible on public.trust_badges;
drop policy if exists trust_badges_insert_system on public.trust_badges;
drop policy if exists trust_badges_update_system on public.trust_badges;

drop policy if exists reliability_history_select_own on public.user_reliability_history;
drop policy if exists reliability_history_insert_system on public.user_reliability_history;

-- Disable RLS
alter table public.vouches disable row level security;
alter table public.incidents disable row level security;
alter table public.trust_badges disable row level security;
alter table public.user_reliability_history disable row level security;

-- Drop indexes
drop index if exists idx_vouches_voucher;
drop index if exists idx_vouches_vouched;
drop index if exists idx_vouches_expires;
drop index if exists idx_incidents_reported;
drop index if exists idx_incidents_reporter;
drop index if exists idx_incidents_round;
drop index if exists idx_incidents_status;
drop index if exists idx_trust_badges_user;
drop index if exists idx_trust_badges_type;
drop index if exists idx_reliability_history_user;
drop index if exists idx_reputation_reliability;

-- Drop tables
drop table if exists public.user_reliability_history;
drop table if exists public.trust_badges;
drop table if exists public.incidents;
drop table if exists public.vouches;

-- Drop types
drop type if exists public.trust_badge_type;
drop type if exists public.incident_status;
drop type if exists public.incident_severity;

-- Remove columns from user_reputation
alter table public.user_reputation
  drop column if exists show_rate,
  drop column if exists punctuality_rate,
  drop column if exists reliability_score,
  drop column if exists reliability_label,
  drop column if exists rounds_completed,
  drop column if exists rounds_scheduled,
  drop column if exists minutes_early_avg,
  drop column if exists last_reliability_calc_at;
*/

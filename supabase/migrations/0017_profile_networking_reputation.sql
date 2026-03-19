-- Profile, Networking, and Reputation Schema Migration
-- Creates tables for user profiles, connections, introductions, and reputation

-- ============================================
-- UP MIGRATION
-- ============================================

-- 1. Add profile fields to users table
alter table public.users
  add column if not exists profile_completeness integer not null default 0,
  add column if not exists intro_credits_remaining integer,
  add column if not exists intro_credits_reset_at timestamptz,
  add column if not exists allow_connections boolean not null default true,
  add column if not exists allow_intros boolean not null default true;

-- 2. Create user_professional_identities table
create table if not exists public.user_professional_identities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  company text,
  title text,
  industry text,
  linkedin_url text,
  years_experience integer,
  -- Validation
  check (years_experience is null or (years_experience >= 0 and years_experience <= 80)),
  check (linkedin_url is null or linkedin_url like 'https://linkedin.com/in/%'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id)
);

-- 3. Create user_golf_identities table
-- Note: home_course_id references golf_courses which is in 0015_golf_schema.sql
create table if not exists public.user_golf_identities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  handicap numeric(4, 1),
  home_course_id uuid references public.golf_courses(id) on delete set null,
  playing_frequency text, -- e.g., 'weekly', 'monthly', 'occasionally'
  favorite_formats text[] not null default '{}',
  years_playing integer,
  -- Validation
  check (handicap is null or (handicap >= -5 and handicap <= 54)),
  check (years_playing is null or (years_playing >= 0 and years_playing <= 100)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id)
);

-- 4. Create connection status enum
create type public.connection_status as enum ('pending', 'accepted', 'declined');

-- 5. Create user_connections table
create table if not exists public.user_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  connected_user_id uuid not null references public.users(id) on delete cascade,
  status public.connection_status not null default 'pending',
  message text,
  intro_source text, -- e.g., 'direct', 'introduction'
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  updated_at timestamptz not null default now(),
  -- Prevent duplicate connections
  check (user_id <> connected_user_id),
  unique(user_id, connected_user_id)
);

-- 6. Create introduction status enum
create type public.introduction_status as enum ('pending', 'accepted', 'declined');

-- 7. Create introduction_requests table
create table if not exists public.introduction_requests (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.users(id) on delete cascade,
  introducer_id uuid not null references public.users(id) on delete cascade,
  target_user_id uuid not null references public.users(id) on delete cascade,
  status public.introduction_status not null default 'pending',
  message text,
  decline_reason text,
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  updated_at timestamptz not null default now(),
  -- Validation
  check (requester_id <> introducer_id),
  check (requester_id <> target_user_id),
  check (introducer_id <> target_user_id)
);

-- 8. Create user_reputation table
create table if not exists public.user_reputation (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  overall_score integer not null default 0,
  -- Component scores (0-100)
  completion_rate numeric(5, 2) not null default 0, -- rounds completed vs scheduled
  ratings_average numeric(5, 2) not null default 0, -- average ratings from other players
  network_size integer not null default 0, -- number of connections
  referrals_count integer not null default 0, -- introductions made
  profile_completeness numeric(5, 2) not null default 0, -- % of profile filled
  attendance_rate numeric(5, 2) not null default 0, -- showed up vs registered
  -- Metadata
  calculated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id),
  -- Validation
  check (overall_score between 0 and 100)
);

-- 9. Create notifications table
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  type text not null, -- e.g., 'connection_request', 'introduction_request', etc.
  title text not null,
  body text not null,
  data jsonb not null default '{}',
  read boolean not null default false,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

-- 10. Create round_ratings table (for reputation calculation)
create table if not exists public.round_ratings (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references public.golf_rounds(id) on delete cascade,
  rated_user_id uuid not null references public.users(id) on delete cascade,
  rater_user_id uuid not null references public.users(id) on delete cascade,
  rating integer not null, -- 1-5 rating
  comment text,
  created_at timestamptz not null default now(),
  -- Validation
  check (rating between 1 and 5),
  check (rated_user_id <> rater_user_id),
  unique(round_id, rated_user_id, rater_user_id)
);

-- 11. Create indexes for performance
-- Profile indexes
create index if not exists idx_professional_identities_user on public.user_professional_identities(user_id);
create index if not exists idx_golf_identities_user on public.user_golf_identities(user_id);
create index if not exists idx_golf_identities_home_course on public.user_golf_identities(home_course_id);

-- Connection indexes
create index if not exists idx_connections_user on public.user_connections(user_id, status);
create index if not exists idx_connections_connected on public.user_connections(connected_user_id, status);
create index if not exists idx_connections_status on public.user_connections(status, created_at desc);

-- Introduction indexes
create index if not exists idx_introductions_requester on public.introduction_requests(requester_id, status);
create index if not exists idx_introductions_introducer on public.introduction_requests(introducer_id, status);
create index if not exists idx_introductions_target on public.introduction_requests(target_user_id, status);

-- Reputation indexes
create index if not exists idx_reputation_user on public.user_reputation(user_id);
create index if not exists idx_reputation_score on public.user_reputation(overall_score desc);

-- Notification indexes
create index if not exists idx_notifications_user on public.notifications(user_id, read, created_at desc);
create index if not exists idx_notifications_unread on public.notifications(user_id, read) where read = false;

-- Round ratings indexes
create index if not exists idx_round_ratings_rated on public.round_ratings(rated_user_id);
create index if not exists idx_round_ratings_rater on public.round_ratings(rater_user_id);
create index if not exists idx_round_ratings_round on public.round_ratings(round_id);

-- 12. Enable RLS on all new tables
alter table public.user_professional_identities enable row level security;
alter table public.user_golf_identities enable row level security;
alter table public.user_connections enable row level security;
alter table public.introduction_requests enable row level security;
alter table public.user_reputation enable row level security;
alter table public.notifications enable row level security;
alter table public.round_ratings enable row level security;

-- 13. Create RLS policies for user_professional_identities
-- Users can see profiles of same-tier users (handled by users table policy)
-- Users can manage their own professional identity
create policy professional_identities_select_visible on public.user_professional_identities
  for select using (
    -- User can see their own
    user_id = auth.uid()
    -- Or same-tier users (leveraging users table same-tier policy)
    or exists (
      select 1 from public.users u
      where u.id = user_professional_identities.user_id
      -- Same tier check happens in users table
    )
  );

create policy professional_identities_insert_own on public.user_professional_identities
  for insert with check (auth.uid() = user_id);

create policy professional_identities_update_own on public.user_professional_identities
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy professional_identities_delete_own on public.user_professional_identities
  for delete using (auth.uid() = user_id);

-- 14. Create RLS policies for user_golf_identities
create policy golf_identities_select_visible on public.user_golf_identities
  for select using (
    user_id = auth.uid()
    or exists (
      select 1 from public.users u
      where u.id = user_golf_identities.user_id
    )
  );

create policy golf_identities_insert_own on public.user_golf_identities
  for insert with check (auth.uid() = user_id);

create policy golf_identities_update_own on public.user_golf_identities
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy golf_identities_delete_own on public.user_golf_identities
  for delete using (auth.uid() = user_id);

-- 15. Create RLS policies for user_connections
-- Users can see connections they're part of
create policy connections_select_involved on public.user_connections
  for select using (
    auth.uid() = user_id or auth.uid() = connected_user_id
  );

-- Users can create connection requests
create policy connections_insert_requester on public.user_connections
  for insert with check (auth.uid() = user_id);

-- Users can update connections they're part of (accept/decline)
create policy connections_update_involved on public.user_connections
  for update using (
    auth.uid() = user_id or auth.uid() = connected_user_id
  ) with check (
    auth.uid() = user_id or auth.uid() = connected_user_id
  );

-- Users can delete their own connection requests
create policy connections_delete_requester on public.user_connections
  for delete using (auth.uid() = user_id);

-- 16. Create RLS policies for introduction_requests
-- Users can see introductions they're involved in
create policy introductions_select_involved on public.introduction_requests
  for select using (
    auth.uid() = requester_id 
    or auth.uid() = introducer_id 
    or auth.uid() = target_user_id
  );

-- Requesters can create introduction requests
create policy introductions_insert_requester on public.introduction_requests
  for insert with check (auth.uid() = requester_id);

-- Introducers can update (accept/decline)
create policy introductions_update_introducer on public.introduction_requests
  for update using (auth.uid() = introducer_id) with check (auth.uid() = introducer_id);

-- 17. Create RLS policies for user_reputation
create policy reputation_select_visible on public.user_reputation
  for select using (
    -- Same-tier visibility
    user_id = auth.uid()
    or exists (
      select 1 from public.users u
      join public.users r on r.id = user_reputation.user_id
      where u.id = auth.uid()
        and u.tier_id = r.tier_id
    )
  );

-- System can update reputation
create policy reputation_update_system on public.user_reputation
  for update using (false) with check (false);

create policy reputation_insert_system on public.user_reputation
  for insert with check (false);

-- 18. Create RLS policies for notifications
create policy notifications_select_own on public.notifications
  for select using (auth.uid() = user_id);

create policy notifications_insert_system on public.notifications
  for insert with check (false);

create policy notifications_update_own on public.notifications
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy notifications_delete_own on public.notifications
  for delete using (auth.uid() = user_id);

-- 19. Create RLS policies for round_ratings
create policy round_ratings_select_visible on public.round_ratings
  for select using (
    -- Users can see ratings for rounds they participated in
    exists (
      select 1 from public.round_participants rp
      where rp.round_id = round_ratings.round_id
        and rp.member_id = auth.uid()
    )
    -- Or their own ratings
    or auth.uid() = rated_user_id
    or auth.uid() = rater_user_id
  );

create policy round_ratings_insert_participant on public.round_ratings
  for insert with check (
    -- Rater must be a participant in the round
    exists (
      select 1 from public.round_participants rp
      where rp.round_id = round_ratings.round_id
        and rp.member_id = auth.uid()
    )
    and auth.uid() = rater_user_id
  );

-- 20. Add updated_at triggers
alter table public.user_professional_identities
  add column if not exists updated_at timestamptz not null default now();

alter table public.user_golf_identities
  add column if not exists updated_at timestamptz not null default now();

alter table public.user_connections
  add column if not exists updated_at timestamptz not null default now();

alter table public.introduction_requests
  add column if not exists updated_at timestamptz not null default now();

alter table public.user_reputation
  add column if not exists updated_at timestamptz not null default now();

-- Create triggers for updated_at

-- Check if the set_updated_at function exists, create it if not
do $$
begin
  if not exists (select 1 from pg_proc where proname = 'set_updated_at') then
    create function public.set_updated_at()
    returns trigger as $$
    begin
      new.updated_at = now();
      return new;
    end;
    $$ language plpgsql;
  end if;
end $$;

create trigger trg_user_professional_identities_updated_at
  before update on public.user_professional_identities
  for each row execute function public.set_updated_at();

create trigger trg_user_golf_identities_updated_at
  before update on public.user_golf_identities
  for each row execute function public.set_updated_at();

create trigger trg_user_connections_updated_at
  before update on public.user_connections
  for each row execute function public.set_updated_at();

create trigger trg_introduction_requests_updated_at
  before update on public.introduction_requests
  for each row execute function public.set_updated_at();

create trigger trg_user_reputation_updated_at
  before update on public.user_reputation
  for each row execute function public.set_updated_at();

-- 21. Create helper function to increment referral count
create or replace function public.increment_referral_count(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_reputation (user_id, referrals_count)
  values (p_user_id, 1)
  on conflict (user_id)
  do update set 
    referrals_count = user_reputation.referrals_count + 1,
    updated_at = now();
end;
$$;

-- 22. Add realtime publication
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.user_connections;
    alter publication supabase_realtime add table public.introduction_requests;
    alter publication supabase_realtime add table public.notifications;
  end if;
end $$;

-- ============================================
-- DOWN MIGRATION (rollback)
-- ============================================
-- Note: Uncomment to run rollback
/*
-- Drop triggers
drop trigger if exists trg_user_professional_identities_updated_at on public.user_professional_identities;
drop trigger if exists trg_user_golf_identities_updated_at on public.user_golf_identities;
drop trigger if exists trg_user_connections_updated_at on public.user_connections;
drop trigger if exists trg_introduction_requests_updated_at on public.introduction_requests;
drop trigger if exists trg_user_reputation_updated_at on public.user_reputation;

-- Remove realtime
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime drop table public.user_connections;
    alter publication supabase_realtime drop table public.introduction_requests;
    alter publication supabase_realtime drop table public.notifications;
  end if;
end $$;

-- Drop function
drop function if exists public.increment_referral_count(uuid);

-- Drop RLS policies
drop policy if exists professional_identities_select_visible on public.user_professional_identities;
drop policy if exists professional_identities_insert_own on public.user_professional_identities;
drop policy if exists professional_identities_update_own on public.user_professional_identities;
drop policy if exists professional_identities_delete_own on public.user_professional_identities;

drop policy if exists golf_identities_select_visible on public.user_golf_identities;
drop policy if exists golf_identities_insert_own on public.user_golf_identities;
drop policy if exists golf_identities_update_own on public.user_golf_identities;
drop policy if exists golf_identities_delete_own on public.user_golf_identities;

drop policy if exists connections_select_involved on public.user_connections;
drop policy if exists connections_insert_requester on public.user_connections;
drop policy if exists connections_update_involved on public.user_connections;
drop policy if exists connections_delete_requester on public.user_connections;

drop policy if exists introductions_select_involved on public.introduction_requests;
drop policy if exists introductions_insert_requester on public.introduction_requests;
drop policy if exists introductions_update_introducer on public.introduction_requests;

drop policy if exists reputation_select_visible on public.user_reputation;
drop policy if exists reputation_update_system on public.user_reputation;
drop policy if exists reputation_insert_system on public.user_reputation;

drop policy if exists notifications_select_own on public.notifications;
drop policy if exists notifications_insert_system on public.notifications;
drop policy if exists notifications_update_own on public.notifications;
drop policy if exists notifications_delete_own on public.notifications;

drop policy if exists round_ratings_select_visible on public.round_ratings;
drop policy if exists round_ratings_insert_participant on public.round_ratings;

-- Disable RLS
alter table public.user_professional_identities disable row level security;
alter table public.user_golf_identities disable row level security;
alter table public.user_connections disable row level security;
alter table public.introduction_requests disable row level security;
alter table public.user_reputation disable row level security;
alter table public.notifications disable row level security;
alter table public.round_ratings disable row level security;

-- Drop indexes
drop index if exists idx_professional_identities_user;
drop index if exists idx_golf_identities_user;
drop index if exists idx_golf_identities_home_course;
drop index if exists idx_connections_user;
drop index if exists idx_connections_connected;
drop index if exists idx_connections_status;
drop index if exists idx_introductions_requester;
drop index if exists idx_introductions_introducer;
drop index if exists idx_introductions_target;
drop index if exists idx_reputation_user;
drop index if exists idx_reputation_score;
drop index if exists idx_notifications_user;
drop index if exists idx_notifications_unread;
drop index if exists idx_round_ratings_rated;
drop index if exists idx_round_ratings_rater;
drop index if exists idx_round_ratings_round;

-- Drop tables
drop table if exists public.round_ratings;
drop table if exists public.notifications;
drop table if exists public.user_reputation;
drop table if exists public.introduction_requests;
drop table if exists public.user_connections;
drop table if exists public.user_golf_identities;
drop table if exists public.user_professional_identities;

-- Drop enums
drop type if exists public.connection_status;
drop type if exists public.introduction_status;

-- Remove columns from users
alter table public.users
  drop column if exists profile_completeness,
  drop column if exists intro_credits_remaining,
  drop column if exists intro_credits_reset_at,
  drop column if exists allow_connections,
  drop column if exists allow_intros;
*/

-- Golf Schema Migration - Spotter Golf Networking
-- Creates golf course, rounds, and golf stats tables with same-tier visibility

-- ============================================
-- UP MIGRATION
-- ============================================

-- 1. Create enum types
-- Golf round format enum
create type public.golf_round_format as enum (
  'stroke_play',
  'match_play',
  'scramble',
  'best_ball',
  'shamble'
);

-- Golf round status enum
create type public.golf_round_status as enum (
  'draft',
  'open',
  'full',
  'in_progress',
  'completed',
  'cancelled'
);

-- Participant status enum
create type public.participant_status as enum (
  'invited',
  'confirmed',
  'declined',
  'waitlisted',
  'checked_in',
  'no_show'
);

-- Participant role enum
create type public.participant_role as enum (
  'organizer',
  'participant'
);

-- Invite status enum
create type public.invite_status as enum (
  'pending',
  'accepted',
  'declined',
  'expired'
);

-- Course difficulty enum
create type public.course_difficulty as enum (
  'easy',
  'moderate',
  'challenging',
  'expert'
);

-- 2. Create golf_courses table
create table if not exists public.golf_courses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text,
  city text not null,
  state text not null,
  country text not null default 'US',
  postal_code text,
  -- Location fields
  location geography(point, 4326),
  latitude numeric(10, 8),
  longitude numeric(11, 8),
  -- Contact info
  phone text,
  website text,
  email text,
  -- Course details
  par_total integer,
  course_rating numeric(4, 1),
  slope_rating integer,
  difficulty public.course_difficulty,
  -- Amenities and media
  amenities jsonb not null default '{}'::jsonb,
  images jsonb not null default '[]'::jsonb,
  -- Status
  is_verified boolean not null default false,
  is_active boolean not null default true,
  -- Timestamps
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 3. Create golf_rounds table (foursomes/tee times)
create table if not exists public.golf_rounds (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.golf_courses(id) on delete restrict,
  organizer_id uuid not null references public.users(id) on delete cascade,
  -- Round details
  round_date date not null,
  tee_time time,
  duration_minutes integer default 240, -- 4 hours default
  format public.golf_round_format not null default 'stroke_play',
  status public.golf_round_status not null default 'draft',
  -- Spots management
  total_spots integer not null default 4,
  spots_available integer not null default 4,
  -- Visibility
  is_private boolean not null default false, -- true = invite only, false = open to same-tier
  -- Handicap filters (optional)
  min_handicap numeric(4, 1),
  max_handicap numeric(4, 1),
  -- Additional info
  notes text,
  weather_conditions text,
  -- Timestamps
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Constraints
  check (total_spots between 2 and 4),
  check (spots_available between 0 and total_spots),
  check (spots_available <= total_spots),
  check (min_handicap is null or max_handicap is null or min_handicap <= max_handicap)
);

-- 4. Create round_participants table
create table if not exists public.round_participants (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references public.golf_rounds(id) on delete cascade,
  member_id uuid not null references public.users(id) on delete cascade,
  -- Status tracking
  status public.participant_status not null default 'invited',
  invited_at timestamptz not null default now(),
  confirmed_at timestamptz,
  checked_in_at timestamptz,
  -- Role
  role public.participant_role not null default 'participant',
  -- Scoring
  score_gross integer,
  score_net integer,
  handicap_used numeric(4, 1),
  -- Notes
  notes text,
  -- Timestamps
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Unique constraint: one participant record per round per member
  unique(round_id, member_id)
);

-- 5. Create round_invites table (for private rounds)
create table if not exists public.round_invites (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references public.golf_rounds(id) on delete cascade,
  invited_by uuid not null references public.users(id) on delete cascade,
  invited_member_id uuid not null references public.users(id) on delete cascade,
  -- Status
  status public.invite_status not null default 'pending',
  -- Optional message
  message text,
  -- Expiration
  expires_at timestamptz,
  -- Timestamps
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Constraints
  check (expires_at is null or expires_at > created_at)
);

-- 6. Create member_golf_stats table
create table if not exists public.member_golf_stats (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.users(id) on delete cascade,
  -- Handicap tracking
  current_handicap numeric(4, 1),
  handicap_low numeric(4, 1),
  handicap_high numeric(4, 1),
  -- Round statistics
  rounds_played_total integer not null default 0,
  rounds_played_this_year integer not null default 0,
  -- Scoring averages
  average_score_gross numeric(5, 1),
  average_score_net numeric(5, 1),
  -- Preferences
  favorite_courses jsonb not null default '[]'::jsonb, -- array of course IDs
  home_course_id uuid references public.golf_courses(id) on delete set null,
  -- Activity tracking
  last_round_date date,
  updated_at timestamptz not null default now(),
  -- Unique constraint: one stats record per member
  unique(member_id)
);

-- 7. Create indexes for performance
-- Course indexes
create index if not exists idx_courses_location on public.golf_courses using gist(location);
create index if not exists idx_courses_city_state on public.golf_courses(city, state);
create index if not exists idx_courses_active on public.golf_courses(is_active) where is_active = true;

-- Round indexes
create index if not exists idx_rounds_date_status on public.golf_rounds(round_date, status);
create index if not exists idx_rounds_course_id on public.golf_rounds(course_id);
create index if not exists idx_rounds_organizer_id on public.golf_rounds(organizer_id);
create index if not exists idx_rounds_status on public.golf_rounds(status);
create index if not exists idx_rounds_date on public.golf_rounds(round_date);

-- Participant indexes
create index if not exists idx_participants_round_id on public.round_participants(round_id);
create index if not exists idx_participants_member_id on public.round_participants(member_id);
create index if not exists idx_participants_status on public.round_participants(status);

-- Invite indexes
create index if not exists idx_round_invites_round_id on public.round_invites(round_id);
create index if not exists idx_round_invites_invited_member on public.round_invites(invited_member_id);
create index if not exists idx_round_invites_status on public.round_invites(status);

-- Stats indexes
create index if not exists idx_member_golf_stats_member on public.member_golf_stats(member_id);
create index if not exists idx_member_golf_stats_handicap on public.member_golf_stats(current_handicap);

-- 8. Enable RLS on all new tables
alter table public.golf_courses enable row level security;
alter table public.golf_rounds enable row level security;
alter table public.round_participants enable row level security;
alter table public.round_invites enable row level security;
alter table public.member_golf_stats enable row level security;

-- 9. Create RLS policies for golf_courses
-- Public read access for verified/active courses
create policy golf_courses_select_public on public.golf_courses
  for select using (is_active = true and is_verified = true);

-- Only admins can modify courses (placeholder - adjust as needed)
create policy golf_courses_insert_admin on public.golf_courses
  for insert with check (false);

create policy golf_courses_update_admin on public.golf_courses
  for update using (false) with check (false);

create policy golf_courses_delete_admin on public.golf_courses
  for delete using (false);

-- 10. Create RLS policies for golf_rounds
-- Users can see rounds that are:
-- 1. Their own rounds (as organizer)
-- 2. Open rounds in their tier (same-tier visibility)
-- 3. Rounds they are participants in
-- 4. Private rounds they were invited to
create policy golf_rounds_select_visible on public.golf_rounds
  for select using (
    -- Organizer can always see their rounds
    auth.uid() = organizer_id
    -- OR user is a participant
    or exists (
      select 1 from public.round_participants rp
      where rp.round_id = golf_rounds.id
        and rp.member_id = auth.uid()
    )
    -- OR open/public rounds visible to same tier
    or (
      status in ('open', 'full', 'in_progress')
      and is_private = false
      and exists (
        select 1
        from public.users current_user
        join public.users round_organizer on round_organizer.id = golf_rounds.organizer_id
        where current_user.id = auth.uid()
          and current_user.tier_id = round_organizer.tier_id
      )
    )
    -- OR private rounds where user has a pending/accepted invite
    or exists (
      select 1 from public.round_invites ri
      where ri.round_id = golf_rounds.id
        and ri.invited_member_id = auth.uid()
        and ri.status in ('pending', 'accepted')
    )
  );

-- Only organizers can create rounds
create policy golf_rounds_insert_organizer on public.golf_rounds
  for insert with check (auth.uid() = organizer_id);

-- Only organizers can update their rounds
create policy golf_rounds_update_organizer on public.golf_rounds
  for update using (auth.uid() = organizer_id) with check (auth.uid() = organizer_id);

-- Only organizers can delete their rounds (if not in progress)
create policy golf_rounds_delete_organizer on public.golf_rounds
  for delete using (auth.uid() = organizer_id and status not in ('in_progress', 'completed'));

-- 11. Create RLS policies for round_participants
-- Participants can see other participants in rounds they're part of
create policy round_participants_select_participants on public.round_participants
  for select using (
    -- User is the participant
    auth.uid() = member_id
    -- OR user is in the same round
    or exists (
      select 1 from public.round_participants rp
      where rp.round_id = round_participants.round_id
        and rp.member_id = auth.uid()
    )
    -- OR user is the round organizer
    or exists (
      select 1 from public.golf_rounds gr
      where gr.id = round_participants.round_id
        and gr.organizer_id = auth.uid()
    )
  );

-- Organizers can insert participants (for their rounds)
create policy round_participants_insert_organizer on public.round_participants
  for insert with check (
    exists (
      select 1 from public.golf_rounds gr
      where gr.id = round_participants.round_id
        and gr.organizer_id = auth.uid()
    )
  );

-- Organizers can update participants (for their rounds)
create policy round_participants_update_organizer on public.round_participants
  for update using (
    exists (
      select 1 from public.golf_rounds gr
      where gr.id = round_participants.round_id
        and gr.organizer_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from public.golf_rounds gr
      where gr.id = round_participants.round_id
        and gr.organizer_id = auth.uid()
    )
  );

-- Participants can update their own status (accept/decline invites)
create policy round_participants_update_self on public.round_participants
  for update using (auth.uid() = member_id) with check (auth.uid() = member_id);

-- Organizers can delete participants (for their rounds)
create policy round_participants_delete_organizer on public.round_participants
  for delete using (
    exists (
      select 1 from public.golf_rounds gr
      where gr.id = round_participants.round_id
        and gr.organizer_id = auth.uid()
    )
  );

-- 12. Create RLS policies for round_invites
-- Users can see invites they sent or received
create policy round_invites_select_involved on public.round_invites
  for select using (
    auth.uid() = invited_by
    or auth.uid() = invited_member_id
  );

-- Organizers can create invites (for their rounds)
create policy round_invites_insert_organizer on public.round_invites
  for insert with check (
    auth.uid() = invited_by
    and exists (
      select 1 from public.golf_rounds gr
      where gr.id = round_invites.round_id
        and gr.organizer_id = auth.uid()
    )
  );

-- Involved parties can update invites (accept/decline)
create policy round_invites_update_involved on public.round_invites
  for update using (
    auth.uid() = invited_by
    or auth.uid() = invited_member_id
  ) with check (
    auth.uid() = invited_by
    or auth.uid() = invited_member_id
  );

-- Organizers can delete invites
create policy round_invites_delete_organizer on public.round_invites
  for delete using (
    auth.uid() = invited_by
    and exists (
      select 1 from public.golf_rounds gr
      where gr.id = round_invites.round_id
        and gr.organizer_id = auth.uid()
    )
  );

-- 13. Create RLS policies for member_golf_stats
-- Users can see their own stats
create policy member_golf_stats_select_own on public.member_golf_stats
  for select using (auth.uid() = member_id);

-- Users can insert their own stats
create policy member_golf_stats_insert_own on public.member_golf_stats
  for insert with check (auth.uid() = member_id);

-- Users can update their own stats
create policy member_golf_stats_update_own on public.member_golf_stats
  for update using (auth.uid() = member_id) with check (auth.uid() = member_id);

-- Users can delete their own stats
create policy member_golf_stats_delete_own on public.member_golf_stats
  for delete using (auth.uid() = member_id);

-- 14. Create trigger function to update spots_available
create or replace function public.update_round_spots_available()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Update spots_available based on confirmed participants
  update public.golf_rounds
  set spots_available = total_spots - (
    select count(*)
    from public.round_participants
    where round_id = coalesce(new.round_id, old.round_id)
      and status = 'confirmed'
  )
  where id = coalesce(new.round_id, old.round_id);

  return coalesce(new, old);
end;
$$;

-- Apply trigger to round_participants
create trigger trg_update_round_spots_available
  after insert or update or delete on public.round_participants
  for each row
  execute function public.update_round_spots_available();

-- 15. Create trigger function to auto-update round status
create or replace function public.update_round_status_on_full()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- If spots_available reaches 0 and status is 'open', change to 'full'
  if new.spots_available = 0 and new.status = 'open' then
    new.status := 'full';
  -- If spots_available > 0 and status is 'full', change to 'open'
  elsif new.spots_available > 0 and new.status = 'full' then
    new.status := 'open';
  end if;

  return new;
end;
$$;

-- Apply trigger to golf_rounds
create trigger trg_update_round_status_on_full
  before update on public.golf_rounds
  for each row
  execute function public.update_round_status_on_full();

-- 16. Add updated_at triggers for all tables
create trigger trg_golf_courses_updated_at
  before update on public.golf_courses
  for each row
  execute function public.set_updated_at();

create trigger trg_golf_rounds_updated_at
  before update on public.golf_rounds
  for each row
  execute function public.set_updated_at();

create trigger trg_round_participants_updated_at
  before update on public.round_participants
  for each row
  execute function public.set_updated_at();

create trigger trg_round_invites_updated_at
  before update on public.round_invites
  for each row
  execute function public.set_updated_at();

create trigger trg_member_golf_stats_updated_at
  before update on public.member_golf_stats
  for each row
  execute function public.set_updated_at();

-- 17. Seed sample golf courses (Arizona area)
insert into public.golf_courses (
  name, address, city, state, country, postal_code,
  latitude, longitude,
  phone, website, email,
  par_total, course_rating, slope_rating, difficulty,
  amenities, images,
  is_verified, is_active
) values
(
  'TPC Scottsdale - Stadium Course',
  '17020 N Hayden Rd',
  'Scottsdale', 'AZ', 'US', '85255',
  33.6423, -111.9107,
  '(480) 585-4334', 'https://www.tpc.com/scottsdale', 'info@tpcscottsdale.com',
  71, 74.6, 135, 'expert',
  '{"driving_range": true, "pro_shop": true, "restaurant": true, "bar": true, "locker_rooms": true, "caddie_service": true, "spa": true}'::jsonb,
  '["https://images.unsplash.com/photo-1587174486073-ae5e5cff23aa?w=800", "https://images.unsplash.com/photo-1535131749006-b7f58c99034b?w=800"]'::jsonb,
  true, true
),
(
  'Grayhawk Golf Club - Talon Course',
  '8620 E Thompson Peak Pkwy',
  'Scottsdale', 'AZ', 'US', '85255',
  33.6698, -111.8934,
  '(480) 502-5600', 'https://www.grayhawkgolf.com', 'info@grayhawkgolf.com',
  72, 73.2, 140, 'expert',
  '{"driving_range": true, "pro_shop": true, "restaurant": true, "bar": true, "locker_rooms": true, "practice_facility": true}'::jsonb,
  '["https://images.unsplash.com/photo-1593111774646-9ef2fd71f83e?w=800"]'::jsonb,
  true, true
),
(
  'We-Ko-Pa Golf Club - Saguaro Course',
  '18200 E Weko Pa Way',
  'Fort McDowell', 'AZ', 'US', '85264',
  33.6367, -111.6789,
  '(480) 836-9000', 'https://www.wekopa.com', 'info@wekopa.com',
  71, 72.1, 128, 'challenging',
  '{"driving_range": true, "pro_shop": true, "restaurant": true, "bar": true, "practice_facility": true}'::jsonb,
  '["https://images.unsplash.com/photo-1602211844066-d3bb625d3d23?w=800"]'::jsonb,
  true, true
),
(
  'Troon North Golf Club - Monument Course',
  '10320 E Dynamite Blvd',
  'Scottsdale', 'AZ', 'US', '85262',
  33.7423, -111.8567,
  '(480) 585-5300', 'https://www.troonnorthgolf.com', 'info@troonnorthgolf.com',
  72, 73.8, 142, 'expert',
  '{"driving_range": true, "pro_shop": true, "restaurant": true, "bar": true, "locker_rooms": true, "caddie_service": true}'::jsonb,
  '["https://images.unsplash.com/photo-1566073778664-25260943d7e5?w=800"]'::jsonb,
  true, true
),
(
  'The Boulders Resort & Spa - North Course',
  '34631 N Tom Darlington Dr',
  'Carefree', 'AZ', 'US', '85377',
  33.8334, -111.8432,
  '(480) 488-9028', 'https://www.theboulders.com', 'info@theboulders.com',
  72, 72.4, 134, 'challenging',
  '{"driving_range": true, "pro_shop": true, "restaurant": true, "bar": true, "spa": true, "resort": true}'::jsonb,
  '["https://images.unsplash.com/photo-1587174486073-ae5e5cff23aa?w=800"]'::jsonb,
  true, true
),
(
  'Camelback Golf Course - Ambiente Course',
  '7847 N Mockingbird Ln',
  'Scottsdale', 'AZ', 'US', '85250',
  33.5534, -111.9189,
  '(480) 596-7050', 'https://www.camelbackgolf.com', 'info@camelbackgolf.com',
  71, 71.8, 125, 'moderate',
  '{"driving_range": true, "pro_shop": true, "restaurant": true, "bar": true}'::jsonb,
  '["https://images.unsplash.com/photo-1535131749006-b7f58c99034b?w=800"]'::jsonb,
  true, true
),
(
  'Talking Stick Golf Club - North Course',
  '9998 E Indian Bend Rd',
  'Scottsdale', 'AZ', 'US', '85256',
  33.5698, -111.8689,
  '(480) 860-2222', 'https://www.talkingstickgolfclub.com', 'info@talkingstickgolf.com',
  71, 71.2, 122, 'moderate',
  '{"driving_range": true, "pro_shop": true, "restaurant": true, "bar": true, "casino": true}'::jsonb,
  '["https://images.unsplash.com/photo-1593111774646-9ef2fd71f83e?w=800"]'::jsonb,
  true, true
),
(
  'Ancala Country Club',
  '12227 E Sorrel Ln',
  'Scottsdale', 'AZ', 'US', '85259',
  33.5889, -111.9189,
  '(480) 391-0000', 'https://www.ancalacc.com', 'info@ancalacc.com',
  72, 72.8, 131, 'challenging',
  '{"driving_range": true, "pro_shop": true, "restaurant": true, "bar": true, "locker_rooms": true, "pool": true, "tennis": true}'::jsonb,
  '["https://images.unsplash.com/photo-1602211844066-d3bb625d3d23?w=800"]'::jsonb,
  true, true
),
(
  'Desert Mountain Club - Renegade Course',
  '10550 E Desert Hills Dr',
  'Scottsdale', 'AZ', 'US', '85262',
  33.7890, -111.8567,
  '(480) 488-1144', 'https://www.desertmountain.com', 'info@desertmountain.com',
  72, 74.2, 138, 'expert',
  '{"driving_range": true, "pro_shop": true, "restaurant": true, "bar": true, "locker_rooms": true, "spa": true, "fitness_center": true}'::jsonb,
  '["https://images.unsplash.com/photo-1566073778664-25260943d7e5?w=800"]'::jsonb,
  true, true
),
(
  'Phoenix Country Club',
  '2901 N 7th St',
  'Phoenix', 'AZ', 'US', '85014',
  33.4823, -112.0654,
  '(602) 264-2165', 'https://www.phoenixcountryclub.org', 'info@phoenixcountryclub.org',
  71, 71.5, 124, 'moderate',
  '{"driving_range": true, "pro_shop": true, "restaurant": true, "bar": true, "locker_rooms": true, "pool": true, "tennis": true, "fitness_center": true}'::jsonb,
  '["https://images.unsplash.com/photo-1587174486073-ae5e5cff23aa?w=800"]'::jsonb,
  true, true
)
on conflict do nothing;

-- Update location geography points for seeded courses
update public.golf_courses
set location = st_makepoint(longitude, latitude)::geography
where location is null and latitude is not null and longitude is not null;

-- 18. Add realtime publication
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.golf_courses;
    alter publication supabase_realtime add table public.golf_rounds;
    alter publication supabase_realtime add table public.round_participants;
    alter publication supabase_realtime add table public.round_invites;
    alter publication supabase_realtime add table public.member_golf_stats;
  end if;
end $$;

-- ============================================
-- DOWN MIGRATION (rollback)
-- ============================================
-- Note: Uncomment the following section to run rollback
-- This is provided for reference and manual rollback scenarios
/*
-- Remove realtime publication
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime drop table public.golf_courses;
    alter publication supabase_realtime drop table public.golf_rounds;
    alter publication supabase_realtime drop table public.round_participants;
    alter publication supabase_realtime drop table public.round_invites;
    alter publication supabase_realtime drop table public.member_golf_stats;
  end if;
end $$;

-- Remove triggers
drop trigger if exists trg_golf_courses_updated_at on public.golf_courses;
drop trigger if exists trg_golf_rounds_updated_at on public.golf_rounds;
drop trigger if exists trg_round_participants_updated_at on public.round_participants;
drop trigger if exists trg_round_invites_updated_at on public.round_invites;
drop trigger if exists trg_member_golf_stats_updated_at on public.member_golf_stats;
drop trigger if exists trg_update_round_spots_available on public.round_participants;
drop trigger if exists trg_update_round_status_on_full on public.golf_rounds;

-- Remove functions
drop function if exists public.update_round_spots_available();
drop function if exists public.update_round_status_on_full();

-- Remove RLS policies
drop policy if exists golf_courses_select_public on public.golf_courses;
drop policy if exists golf_courses_insert_admin on public.golf_courses;
drop policy if exists golf_courses_update_admin on public.golf_courses;
drop policy if exists golf_courses_delete_admin on public.golf_courses;

drop policy if exists golf_rounds_select_visible on public.golf_rounds;
drop policy if exists golf_rounds_insert_organizer on public.golf_rounds;
drop policy if exists golf_rounds_update_organizer on public.golf_rounds;
drop policy if exists golf_rounds_delete_organizer on public.golf_rounds;

drop policy if exists round_participants_select_participants on public.round_participants;
drop policy if exists round_participants_insert_organizer on public.round_participants;
drop policy if exists round_participants_update_organizer on public.round_participants;
drop policy if exists round_participants_update_self on public.round_participants;
drop policy if exists round_participants_delete_organizer on public.round_participants;

drop policy if exists round_invites_select_involved on public.round_invites;
drop policy if exists round_invites_insert_organizer on public.round_invites;
drop policy if exists round_invites_update_involved on public.round_invites;
drop policy if exists round_invites_delete_organizer on public.round_invites;

drop policy if exists member_golf_stats_select_own on public.member_golf_stats;
drop policy if exists member_golf_stats_insert_own on public.member_golf_stats;
drop policy if exists member_golf_stats_update_own on public.member_golf_stats;
drop policy if exists member_golf_stats_delete_own on public.member_golf_stats;

-- Disable RLS
alter table public.golf_courses disable row level security;
alter table public.golf_rounds disable row level security;
alter table public.round_participants disable row level security;
alter table public.round_invites disable row level security;
alter table public.member_golf_stats disable row level security;

-- Remove indexes
drop index if exists idx_courses_location;
drop index if exists idx_courses_city_state;
drop index if exists idx_courses_active;
drop index if exists idx_rounds_date_status;
drop index if exists idx_rounds_course_id;
drop index if exists idx_rounds_organizer_id;
drop index if exists idx_rounds_status;
drop index if exists idx_rounds_date;
drop index if exists idx_participants_round_id;
drop index if exists idx_participants_member_id;
drop index if exists idx_participants_status;
drop index if exists idx_round_invites_round_id;
drop index if exists idx_round_invites_invited_member;
drop index if exists idx_round_invites_status;
drop index if exists idx_member_golf_stats_member;
drop index if exists idx_member_golf_stats_handicap;

-- Drop tables
drop table if exists public.member_golf_stats;
drop table if exists public.round_invites;
drop table if exists public.round_participants;
drop table if exists public.golf_rounds;
drop table if exists public.golf_courses;

-- Drop types
drop type if exists public.golf_round_format;
drop type if exists public.golf_round_status;
drop type if exists public.participant_status;
drop type if exists public.participant_role;
drop type if exists public.invite_status;
drop type if exists public.course_difficulty;
*/

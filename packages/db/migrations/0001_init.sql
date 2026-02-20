-- Spotter schema v1
create extension if not exists postgis;
create extension if not exists pgcrypto;
create extension if not exists "uuid-ossp";
create extension if not exists vector;

create type public.match_status as enum ('pending', 'accepted', 'rejected', 'expired');
create type public.session_status as enum ('proposed', 'confirmed', 'completed', 'cancelled');
create type public.video_submission_status as enum ('uploaded', 'processing', 'analyzed', 'failed');

create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  bio text,
  timezone text,
  home_location geography(point, 4326),
  availability jsonb not null default '{}'::jsonb,
  onboarding_complete boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.activities (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  category text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.skill_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  activity_id uuid not null references public.activities(id) on delete cascade,
  source_scale text not null,
  source_value text not null,
  canonical_score numeric(5,2) not null,
  skill_band text not null,
  confidence numeric(4,3) not null default 0.5,
  dimensions jsonb not null default '[]'::jsonb,
  embedding vector(32),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, activity_id)
);

create table if not exists public.matches (
  id uuid primary key default gen_random_uuid(),
  requester_user_id uuid not null references public.users(id) on delete cascade,
  candidate_user_id uuid not null references public.users(id) on delete cascade,
  activity_id uuid not null references public.activities(id) on delete cascade,
  status public.match_status not null default 'pending',
  score numeric(6,3),
  match_reasons jsonb not null default '[]'::jsonb,
  requested_time_window tstzrange,
  distance_km numeric(8,3),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (requester_user_id <> candidate_user_id)
);

create table if not exists public.sessions (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  proposer_user_id uuid not null references public.users(id) on delete cascade,
  partner_user_id uuid not null references public.users(id) on delete cascade,
  activity_id uuid not null references public.activities(id) on delete cascade,
  proposed_start_time timestamptz not null,
  confirmed_time timestamptz,
  meetup_location geography(point, 4326),
  status public.session_status not null default 'proposed',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.video_submissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  activity_id uuid not null references public.activities(id) on delete cascade,
  session_id uuid references public.sessions(id) on delete set null,
  storage_path text not null,
  status public.video_submission_status not null default 'uploaded',
  ai_analysis jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.coach_reviews (
  id uuid primary key default gen_random_uuid(),
  video_submission_id uuid not null references public.video_submissions(id) on delete cascade,
  coach_user_id uuid not null references public.users(id) on delete cascade,
  notes jsonb not null default '[]'::jsonb,
  voice_note_url text,
  rating smallint,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.progress_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  activity_id uuid not null references public.activities(id) on delete cascade,
  source_submission_ids uuid[] not null default '{}',
  metrics jsonb not null default '[]'::jsonb,
  trend_summary text,
  snapshot_date date not null default current_date,
  created_at timestamptz not null default now()
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  sender_user_id uuid not null references public.users(id) on delete cascade,
  message text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.user_deletion_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  requested_at timestamptz not null default now(),
  status text not null default 'pending',
  completed_at timestamptz
);

create index if not exists idx_users_home_location on public.users using gist(home_location);
create index if not exists idx_skill_profiles_activity_band on public.skill_profiles(activity_id, skill_band);
create index if not exists idx_matches_activity_status on public.matches(activity_id, status);
create index if not exists idx_matches_request_window on public.matches using gist(requested_time_window);
create index if not exists idx_sessions_location on public.sessions using gist(meetup_location);
create index if not exists idx_video_submissions_user_activity on public.video_submissions(user_id, activity_id);
create index if not exists idx_progress_snapshots_user_activity on public.progress_snapshots(user_id, activity_id, snapshot_date desc);

alter table public.users enable row level security;
alter table public.activities enable row level security;
alter table public.skill_profiles enable row level security;
alter table public.matches enable row level security;
alter table public.sessions enable row level security;
alter table public.video_submissions enable row level security;
alter table public.coach_reviews enable row level security;
alter table public.progress_snapshots enable row level security;
alter table public.messages enable row level security;
alter table public.user_deletion_requests enable row level security;

create policy users_select_self on public.users
  for select using (auth.uid() = id);
create policy users_update_self on public.users
  for update using (auth.uid() = id) with check (auth.uid() = id);
create policy users_insert_self on public.users
  for insert with check (auth.uid() = id);

create policy activities_read_all on public.activities
  for select using (true);

create policy skill_profiles_select_own on public.skill_profiles
  for select using (auth.uid() = user_id);
create policy skill_profiles_write_own on public.skill_profiles
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy matches_select_own on public.matches
  for select using (auth.uid() = requester_user_id or auth.uid() = candidate_user_id);
create policy matches_insert_requester on public.matches
  for insert with check (auth.uid() = requester_user_id);
create policy matches_update_participants on public.matches
  for update using (auth.uid() = requester_user_id or auth.uid() = candidate_user_id)
  with check (auth.uid() = requester_user_id or auth.uid() = candidate_user_id);

create policy sessions_select_own on public.sessions
  for select using (auth.uid() = proposer_user_id or auth.uid() = partner_user_id);
create policy sessions_write_participants on public.sessions
  for all using (auth.uid() = proposer_user_id or auth.uid() = partner_user_id)
  with check (auth.uid() = proposer_user_id or auth.uid() = partner_user_id);

create policy video_submissions_select_own on public.video_submissions
  for select using (auth.uid() = user_id);
create policy video_submissions_write_own on public.video_submissions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy coach_reviews_select_related on public.coach_reviews
  for select using (
    auth.uid() = coach_user_id
    or exists (
      select 1 from public.video_submissions vs
      where vs.id = video_submission_id and vs.user_id = auth.uid()
    )
  );
create policy coach_reviews_write_coach on public.coach_reviews
  for all using (auth.uid() = coach_user_id) with check (auth.uid() = coach_user_id);

create policy progress_snapshots_select_own on public.progress_snapshots
  for select using (auth.uid() = user_id);
create policy progress_snapshots_write_own on public.progress_snapshots
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy messages_select_session_participants on public.messages
  for select using (
    exists (
      select 1 from public.sessions s
      where s.id = session_id and (s.proposer_user_id = auth.uid() or s.partner_user_id = auth.uid())
    )
  );
create policy messages_insert_sender on public.messages
  for insert with check (auth.uid() = sender_user_id);

create policy user_deletion_requests_select_own on public.user_deletion_requests
  for select using (auth.uid() = user_id);
create policy user_deletion_requests_insert_own on public.user_deletion_requests
  for insert with check (auth.uid() = user_id);

create or replace function public.request_account_deletion()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request_id uuid;
begin
  insert into public.user_deletion_requests (user_id)
  values (auth.uid())
  returning id into v_request_id;

  return v_request_id;
end;
$$;

create or replace function public.find_match_candidates_v1(
  p_requester_id uuid,
  p_activity_id uuid,
  p_skill_band text,
  p_radius_meters integer,
  p_limit integer default 5
)
returns table(
  candidate_user_id uuid,
  activity_id uuid,
  skill_band text,
  distance_km numeric,
  skill_delta numeric,
  availability_overlap_minutes integer,
  reasons jsonb
)
language sql
security definer
set search_path = public
as $$
  with requester as (
    select u.id, u.home_location
    from public.users u
    where u.id = p_requester_id
  ),
  requester_skill as (
    select canonical_score
    from public.skill_profiles
    where user_id = p_requester_id and activity_id = p_activity_id
    limit 1
  )
  select
    sp.user_id as candidate_user_id,
    p_activity_id as activity_id,
    sp.skill_band,
    round((st_distance(u.home_location, r.home_location) / 1000.0)::numeric, 3) as distance_km,
    abs(sp.canonical_score - coalesce((select canonical_score from requester_skill), sp.canonical_score)) as skill_delta,
    60::integer as availability_overlap_minutes,
    jsonb_build_array('activity_match', 'skill_band_match', 'within_radius') as reasons
  from public.skill_profiles sp
  join public.users u on u.id = sp.user_id
  cross join requester r
  where sp.user_id <> p_requester_id
    and sp.activity_id = p_activity_id
    and sp.skill_band = p_skill_band
    and st_dwithin(u.home_location, r.home_location, p_radius_meters)
  order by st_distance(u.home_location, r.home_location) asc
  limit least(greatest(coalesce(p_limit, 5), 1), 5);
$$;

-- Realtime publication
alter publication supabase_realtime add table public.matches;
alter publication supabase_realtime add table public.sessions;
alter publication supabase_realtime add table public.messages;

-- Updated_at trigger
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_users_updated_at before update on public.users for each row execute function public.set_updated_at();
create trigger trg_skill_profiles_updated_at before update on public.skill_profiles for each row execute function public.set_updated_at();
create trigger trg_matches_updated_at before update on public.matches for each row execute function public.set_updated_at();
create trigger trg_sessions_updated_at before update on public.sessions for each row execute function public.set_updated_at();
create trigger trg_video_submissions_updated_at before update on public.video_submissions for each row execute function public.set_updated_at();
create trigger trg_coach_reviews_updated_at before update on public.coach_reviews for each row execute function public.set_updated_at();

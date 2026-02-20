-- Spotter gap-closing schema updates

create table if not exists public.availability_slots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  activity_id uuid references public.activities(id) on delete set null,
  weekday smallint not null check (weekday between 0 and 6),
  start_minute smallint not null check (start_minute between 0 and 1439),
  end_minute smallint not null check (end_minute between 1 and 1440),
  timezone text not null default 'UTC',
  created_at timestamptz not null default now(),
  check (end_minute > start_minute)
);

create table if not exists public.session_feedback (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  reviewer_user_id uuid not null references public.users(id) on delete cascade,
  reviewee_user_id uuid not null references public.users(id) on delete cascade,
  thumbs_up boolean not null,
  tag text,
  created_at timestamptz not null default now(),
  unique(session_id, reviewer_user_id),
  check (reviewer_user_id <> reviewee_user_id)
);

alter table public.messages
  add column if not exists client_message_id text,
  add column if not exists moderation_status text not null default 'pending';

alter table public.matches
  add column if not exists expires_at timestamptz;

alter table public.video_submissions
  add column if not exists upload_url text,
  add column if not exists upload_expires_at timestamptz;

create index if not exists idx_availability_slots_user_activity on public.availability_slots(user_id, activity_id, weekday);
create index if not exists idx_session_feedback_reviewee on public.session_feedback(reviewee_user_id, created_at desc);
create index if not exists idx_messages_session_created on public.messages(session_id, created_at);
create unique index if not exists idx_messages_idempotency
  on public.messages(session_id, sender_user_id, client_message_id)
  where client_message_id is not null;

alter table public.availability_slots enable row level security;
alter table public.session_feedback enable row level security;

create policy availability_slots_select_own on public.availability_slots
  for select using (auth.uid() = user_id);
create policy availability_slots_write_own on public.availability_slots
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy session_feedback_select_participants on public.session_feedback
  for select using (auth.uid() = reviewer_user_id or auth.uid() = reviewee_user_id);
create policy session_feedback_insert_reviewer on public.session_feedback
  for insert with check (auth.uid() = reviewer_user_id);

create or replace function public.calculate_availability_overlap_minutes(
  p_user_id_a uuid,
  p_user_id_b uuid,
  p_activity_id uuid
)
returns integer
language sql
stable
set search_path = public
as $$
  with a as (
    select weekday, start_minute, end_minute
    from public.availability_slots
    where user_id = p_user_id_a and (activity_id = p_activity_id or activity_id is null)
  ),
  b as (
    select weekday, start_minute, end_minute
    from public.availability_slots
    where user_id = p_user_id_b and (activity_id = p_activity_id or activity_id is null)
  )
  select coalesce(sum(greatest(0, least(a.end_minute, b.end_minute) - greatest(a.start_minute, b.start_minute))), 0)::integer
  from a join b on a.weekday = b.weekday;
$$;

drop function if exists public.find_match_candidates_v1(uuid, uuid, text, integer, integer);

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
  reasons jsonb,
  match_score numeric
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
  ),
  candidates as (
    select
      sp.user_id as candidate_user_id,
      p_activity_id as activity_id,
      sp.skill_band,
      round((st_distance(u.home_location, r.home_location) / 1000.0)::numeric, 3) as distance_km,
      abs(sp.canonical_score - coalesce((select canonical_score from requester_skill), sp.canonical_score)) as skill_delta,
      public.calculate_availability_overlap_minutes(p_requester_id, sp.user_id, p_activity_id) as availability_overlap_minutes
    from public.skill_profiles sp
    join public.users u on u.id = sp.user_id
    cross join requester r
    where sp.user_id <> p_requester_id
      and sp.activity_id = p_activity_id
      and sp.skill_band = p_skill_band
      and st_dwithin(u.home_location, r.home_location, p_radius_meters)
  )
  select
    c.candidate_user_id,
    c.activity_id,
    c.skill_band,
    c.distance_km,
    c.skill_delta,
    c.availability_overlap_minutes,
    jsonb_build_array('activity_match', 'skill_band_match', 'within_radius') as reasons,
    round((
      greatest(0, 100 - c.distance_km * 5)
      + greatest(0, 100 - c.skill_delta * 2)
      + least(c.availability_overlap_minutes, 240) * 0.5
    )::numeric, 3) as match_score
  from candidates c
  order by match_score desc, c.distance_km asc
  limit least(greatest(coalesce(p_limit, 5), 1), 5);
$$;

create or replace function public.expire_pending_matches()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  update public.matches
  set status = 'expired', updated_at = now()
  where status = 'pending'
    and expires_at is not null
    and expires_at <= now();

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

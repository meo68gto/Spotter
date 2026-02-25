do $$
begin
  if not exists (select 1 from pg_type where typname = 'sponsored_event_status') then
    create type public.sponsored_event_status as enum ('draft', 'published', 'closed', 'cancelled');
  end if;
  if not exists (select 1 from pg_type where typname = 'invite_status') then
    create type public.invite_status as enum ('pending', 'accepted', 'declined', 'expired');
  end if;
  if not exists (select 1 from pg_type where typname = 'registration_status') then
    create type public.registration_status as enum ('registered', 'waitlist', 'cancelled', 'checked_in');
  end if;
  if not exists (select 1 from pg_type where typname = 'networking_invite_purpose') then
    create type public.networking_invite_purpose as enum ('session', 'tournament', 'networking');
  end if;
  if not exists (select 1 from pg_type where typname = 'booking_recommendation_type') then
    create type public.booking_recommendation_type as enum ('pairing', 'event');
  end if;
end $$;

create table if not exists public.sponsors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  website_url text,
  logo_url text,
  city text,
  created_by_user_id uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.sponsor_memberships (
  id uuid primary key default gen_random_uuid(),
  sponsor_id uuid not null references public.sponsors(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  role text not null default 'admin',
  created_at timestamptz not null default now(),
  unique (sponsor_id, user_id)
);

create table if not exists public.sponsored_events (
  id uuid primary key default gen_random_uuid(),
  sponsor_id uuid not null references public.sponsors(id) on delete cascade,
  created_by_user_id uuid not null references public.users(id) on delete cascade,
  activity_id uuid not null references public.activities(id) on delete cascade,
  title text not null,
  description text,
  city text,
  venue_name text,
  venue_location geography(point, 4326),
  start_time timestamptz not null,
  end_time timestamptz not null,
  max_participants integer not null default 32,
  status public.sponsored_event_status not null default 'published',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_time > start_time)
);

create table if not exists public.sponsored_event_invites (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.sponsored_events(id) on delete cascade,
  invited_user_id uuid not null references public.users(id) on delete cascade,
  invited_by_user_id uuid not null references public.users(id) on delete cascade,
  status public.invite_status not null default 'pending',
  message text,
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  unique(event_id, invited_user_id)
);

create table if not exists public.sponsored_event_registrations (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.sponsored_events(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  status public.registration_status not null default 'registered',
  check_in_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(event_id, user_id)
);

create table if not exists public.networking_invites (
  id uuid primary key default gen_random_uuid(),
  sender_user_id uuid not null references public.users(id) on delete cascade,
  receiver_user_id uuid not null references public.users(id) on delete cascade,
  activity_id uuid not null references public.activities(id) on delete cascade,
  related_event_id uuid references public.sponsored_events(id) on delete set null,
  purpose public.networking_invite_purpose not null default 'networking',
  message text,
  status public.invite_status not null default 'pending',
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  check (sender_user_id <> receiver_user_id),
  unique(sender_user_id, receiver_user_id, activity_id, related_event_id, purpose)
);

create table if not exists public.mcp_booking_runs (
  id uuid primary key default gen_random_uuid(),
  requester_user_id uuid not null references public.users(id) on delete cascade,
  activity_id uuid not null references public.activities(id) on delete cascade,
  objective text not null default 'balanced',
  radius_km numeric(8,3) not null,
  requested_time_window tstzrange,
  include_events boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.mcp_booking_recommendations (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.mcp_booking_runs(id) on delete cascade,
  recommendation_type public.booking_recommendation_type not null,
  candidate_user_id uuid references public.users(id) on delete cascade,
  event_id uuid references public.sponsored_events(id) on delete cascade,
  score numeric(8,3) not null,
  distance_km numeric(8,3),
  skill_delta numeric(8,3),
  availability_overlap_minutes integer,
  reasons jsonb not null default '[]'::jsonb,
  rank_position integer not null,
  created_at timestamptz not null default now(),
  check (
    (recommendation_type = 'pairing' and candidate_user_id is not null and event_id is null)
    or (recommendation_type = 'event' and event_id is not null and candidate_user_id is null)
  )
);

create index if not exists idx_sponsored_events_activity_status_time on public.sponsored_events(activity_id, status, start_time);
create index if not exists idx_sponsored_events_location on public.sponsored_events using gist(venue_location);
create index if not exists idx_sponsored_event_invites_user on public.sponsored_event_invites(invited_user_id, status, created_at desc);
create index if not exists idx_sponsored_event_registrations_user on public.sponsored_event_registrations(user_id, status, created_at desc);
create index if not exists idx_networking_invites_receiver on public.networking_invites(receiver_user_id, status, created_at desc);
create index if not exists idx_mcp_runs_requester_activity on public.mcp_booking_runs(requester_user_id, activity_id, created_at desc);
create index if not exists idx_mcp_recommendations_run_rank on public.mcp_booking_recommendations(run_id, rank_position);

alter table public.sponsors enable row level security;
alter table public.sponsor_memberships enable row level security;
alter table public.sponsored_events enable row level security;
alter table public.sponsored_event_invites enable row level security;
alter table public.sponsored_event_registrations enable row level security;
alter table public.networking_invites enable row level security;
alter table public.mcp_booking_runs enable row level security;
alter table public.mcp_booking_recommendations enable row level security;

drop policy if exists sponsors_select_public on public.sponsors;
create policy sponsors_select_public on public.sponsors
  for select using (true);
drop policy if exists sponsors_write_owner on public.sponsors;
create policy sponsors_write_owner on public.sponsors
  for all using (created_by_user_id = auth.uid())
  with check (created_by_user_id = auth.uid());

drop policy if exists sponsor_memberships_select_own on public.sponsor_memberships;
create policy sponsor_memberships_select_own on public.sponsor_memberships
  for select using (user_id = auth.uid());
drop policy if exists sponsor_memberships_insert_owner on public.sponsor_memberships;
create policy sponsor_memberships_insert_owner on public.sponsor_memberships
  for insert with check (
    user_id = auth.uid()
    or exists (
      select 1 from public.sponsor_memberships sm
      where sm.sponsor_id = sponsor_id and sm.user_id = auth.uid() and sm.role in ('owner', 'admin')
    )
  );

drop policy if exists sponsored_events_select_visible on public.sponsored_events;
create policy sponsored_events_select_visible on public.sponsored_events
  for select using (
    status = 'published'
    or created_by_user_id = auth.uid()
    or exists (
      select 1 from public.sponsor_memberships sm
      where sm.sponsor_id = sponsored_events.sponsor_id
        and sm.user_id = auth.uid()
    )
  );
drop policy if exists sponsored_events_insert_admin on public.sponsored_events;
create policy sponsored_events_insert_admin on public.sponsored_events
  for insert with check (
    created_by_user_id = auth.uid()
    and exists (
      select 1 from public.sponsor_memberships sm
      where sm.sponsor_id = sponsored_events.sponsor_id
        and sm.user_id = auth.uid()
        and sm.role in ('owner', 'admin')
    )
  );
drop policy if exists sponsored_events_update_admin on public.sponsored_events;
create policy sponsored_events_update_admin on public.sponsored_events
  for update using (
    exists (
      select 1 from public.sponsor_memberships sm
      where sm.sponsor_id = sponsored_events.sponsor_id
        and sm.user_id = auth.uid()
        and sm.role in ('owner', 'admin')
    )
  )
  with check (
    exists (
      select 1 from public.sponsor_memberships sm
      where sm.sponsor_id = sponsored_events.sponsor_id
        and sm.user_id = auth.uid()
        and sm.role in ('owner', 'admin')
    )
  );

drop policy if exists sponsored_event_invites_select_participant on public.sponsored_event_invites;
create policy sponsored_event_invites_select_participant on public.sponsored_event_invites
  for select using (
    invited_user_id = auth.uid()
    or invited_by_user_id = auth.uid()
    or exists (
      select 1 from public.sponsored_events se
      join public.sponsor_memberships sm on sm.sponsor_id = se.sponsor_id
      where se.id = event_id and sm.user_id = auth.uid()
    )
  );
drop policy if exists sponsored_event_invites_insert_admin on public.sponsored_event_invites;
create policy sponsored_event_invites_insert_admin on public.sponsored_event_invites
  for insert with check (
    invited_by_user_id = auth.uid()
    and exists (
      select 1 from public.sponsored_events se
      join public.sponsor_memberships sm on sm.sponsor_id = se.sponsor_id
      where se.id = event_id and sm.user_id = auth.uid() and sm.role in ('owner', 'admin')
    )
  );
drop policy if exists sponsored_event_invites_update_participant on public.sponsored_event_invites;
create policy sponsored_event_invites_update_participant on public.sponsored_event_invites
  for update using (
    invited_user_id = auth.uid()
    or invited_by_user_id = auth.uid()
  )
  with check (
    invited_user_id = auth.uid()
    or invited_by_user_id = auth.uid()
  );

drop policy if exists sponsored_event_registrations_select_participant on public.sponsored_event_registrations;
create policy sponsored_event_registrations_select_participant on public.sponsored_event_registrations
  for select using (
    user_id = auth.uid()
    or exists (
      select 1 from public.sponsored_events se
      join public.sponsor_memberships sm on sm.sponsor_id = se.sponsor_id
      where se.id = event_id and sm.user_id = auth.uid()
    )
  );
drop policy if exists sponsored_event_registrations_insert_self on public.sponsored_event_registrations;
create policy sponsored_event_registrations_insert_self on public.sponsored_event_registrations
  for insert with check (user_id = auth.uid());
drop policy if exists sponsored_event_registrations_update_self on public.sponsored_event_registrations;
create policy sponsored_event_registrations_update_self on public.sponsored_event_registrations
  for update using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists networking_invites_select_participant on public.networking_invites;
create policy networking_invites_select_participant on public.networking_invites
  for select using (sender_user_id = auth.uid() or receiver_user_id = auth.uid());
drop policy if exists networking_invites_insert_sender on public.networking_invites;
create policy networking_invites_insert_sender on public.networking_invites
  for insert with check (sender_user_id = auth.uid());
drop policy if exists networking_invites_update_participant on public.networking_invites;
create policy networking_invites_update_participant on public.networking_invites
  for update using (sender_user_id = auth.uid() or receiver_user_id = auth.uid())
  with check (sender_user_id = auth.uid() or receiver_user_id = auth.uid());

drop policy if exists mcp_booking_runs_select_own on public.mcp_booking_runs;
create policy mcp_booking_runs_select_own on public.mcp_booking_runs
  for select using (requester_user_id = auth.uid());
drop policy if exists mcp_booking_runs_insert_own on public.mcp_booking_runs;
create policy mcp_booking_runs_insert_own on public.mcp_booking_runs
  for insert with check (requester_user_id = auth.uid());

drop policy if exists mcp_booking_recommendations_select_run_owner on public.mcp_booking_recommendations;
create policy mcp_booking_recommendations_select_run_owner on public.mcp_booking_recommendations
  for select using (
    exists (
      select 1 from public.mcp_booking_runs run
      where run.id = run_id and run.requester_user_id = auth.uid()
    )
  );

create trigger trg_sponsors_updated_at
before update on public.sponsors
for each row execute function public.set_updated_at();

create trigger trg_sponsored_events_updated_at
before update on public.sponsored_events
for each row execute function public.set_updated_at();

create trigger trg_sponsored_event_registrations_updated_at
before update on public.sponsored_event_registrations
for each row execute function public.set_updated_at();

create or replace function public.mcp_booking_recommendations_v1(
  p_requester_id uuid,
  p_activity_id uuid,
  p_radius_meters integer,
  p_limit integer default 8,
  p_include_events boolean default true
)
returns table(
  recommendation_type public.booking_recommendation_type,
  candidate_user_id uuid,
  event_id uuid,
  score numeric,
  distance_km numeric,
  skill_delta numeric,
  availability_overlap_minutes integer,
  reasons jsonb
)
language sql
security definer
set search_path = public
as $$
with base_candidates as (
  select
    'pairing'::public.booking_recommendation_type as recommendation_type,
    c.candidate_user_id,
    null::uuid as event_id,
    ((100 - least(c.distance_km, 50)) + (100 - least(c.skill_delta * 20, 100)) + least(c.availability_overlap_minutes, 120)) / 3.0 as score,
    c.distance_km,
    c.skill_delta,
    c.availability_overlap_minutes,
    c.reasons
  from public.find_match_candidates_v1(
    p_requester_id,
    p_activity_id,
    coalesce((select sp.skill_band from public.skill_profiles sp where sp.user_id = p_requester_id and sp.activity_id = p_activity_id limit 1), 'intermediate'),
    p_radius_meters,
    greatest(1, p_limit)
  ) c
),
event_candidates as (
  select
    'event'::public.booking_recommendation_type as recommendation_type,
    null::uuid as candidate_user_id,
    se.id as event_id,
    (
      100
      - least(
          st_distance(
            (select u.home_location from public.users u where u.id = p_requester_id),
            se.venue_location
          ) / 1000.0,
          80
        )
      + greatest(0, 50 - extract(epoch from (se.start_time - now())) / 3600.0)
    ) / 2.0 as score,
    st_distance(
      (select u.home_location from public.users u where u.id = p_requester_id),
      se.venue_location
    ) / 1000.0 as distance_km,
    null::numeric as skill_delta,
    null::integer as availability_overlap_minutes,
    jsonb_build_array(
      'sponsored_event',
      concat('starts_', to_char(se.start_time, 'YYYY-MM-DD"T"HH24:MI'))
    ) as reasons
  from public.sponsored_events se
  where p_include_events
    and se.status = 'published'
    and se.activity_id = p_activity_id
    and se.venue_location is not null
    and (select u.home_location is not null from public.users u where u.id = p_requester_id)
    and st_dwithin(
      (select u.home_location from public.users u where u.id = p_requester_id),
      se.venue_location,
      p_radius_meters
    )
)
select recommendation_type, candidate_user_id, event_id, score, distance_km, skill_delta, availability_overlap_minutes, reasons
from (
  select * from base_candidates
  union all
  select * from event_candidates
) t
order by score desc
limit p_limit;
$$;

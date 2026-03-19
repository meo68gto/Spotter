create unique index if not exists idx_availability_slots_unique
  on public.availability_slots (
    user_id,
    coalesce(activity_id, '00000000-0000-0000-0000-000000000000'::uuid),
    weekday,
    start_minute,
    end_minute,
    timezone
  );

alter table public.matches enable row level security;
alter table public.sessions enable row level security;
alter table public.availability_slots enable row level security;

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
      st_distance(u.home_location, r.home_location) as distance_meters,
      abs(sp.canonical_score - coalesce((select canonical_score from requester_skill), sp.canonical_score)) as skill_delta,
      public.calculate_availability_overlap_minutes(p_requester_id, sp.user_id, p_activity_id) as availability_overlap_minutes
    from public.skill_profiles sp
    join public.users u on u.id = sp.user_id
    cross join requester r
    where sp.user_id <> p_requester_id
      and sp.activity_id = p_activity_id
      and sp.skill_band = p_skill_band
      and st_dwithin(u.home_location, r.home_location, greatest(coalesce(p_radius_meters, 0), 1))
  )
  select
    c.candidate_user_id,
    c.activity_id,
    c.skill_band,
    round((c.distance_meters / 1000.0)::numeric, 3) as distance_km,
    round(c.skill_delta::numeric, 3) as skill_delta,
    c.availability_overlap_minutes,
    to_jsonb(array[
      'activity_match',
      'skill_band_match',
      case
        when c.availability_overlap_minutes >= 120 then 'high_availability_overlap'
        when c.availability_overlap_minutes > 0 then 'availability_overlap'
        else 'no_availability_overlap'
      end,
      case
        when c.distance_meters <= greatest(coalesce(p_radius_meters, 0), 1) * 0.5 then 'nearby'
        else 'within_radius'
      end
    ]::text[]) as reasons,
    round((
      greatest(0::numeric, 1 - (c.distance_meters / greatest(coalesce(p_radius_meters, 0), 1)::numeric)) * 45
      + greatest(0::numeric, 1 - (c.skill_delta / 40.0)) * 35
      + (least(c.availability_overlap_minutes, 240)::numeric / 240.0) * 20
    )::numeric, 3) as match_score
  from candidates c
  order by match_score desc, c.availability_overlap_minutes desc, c.distance_meters asc, c.candidate_user_id asc
  limit least(greatest(coalesce(p_limit, 5), 1), 5);
$$;

create or replace function public.enforce_match_status_transition()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.status = new.status then
    return new;
  end if;

  if old.status = 'pending' and new.status in ('accepted', 'rejected', 'expired') then
    return new;
  end if;

  raise exception 'illegal match status transition: % -> %', old.status, new.status;
end;
$$;

drop trigger if exists trg_matches_status_transition on public.matches;
create trigger trg_matches_status_transition
before update on public.matches
for each row
execute function public.enforce_match_status_transition();

create or replace function public.enforce_session_status_transition()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.status = new.status then
    return new;
  end if;

  if old.status = 'proposed' and new.status in ('confirmed', 'cancelled') then
    return new;
  end if;

  if old.status = 'confirmed' and new.status in ('completed', 'cancelled') then
    return new;
  end if;

  raise exception 'illegal session status transition: % -> %', old.status, new.status;
end;
$$;

drop trigger if exists trg_sessions_status_transition on public.sessions;
create trigger trg_sessions_status_transition
before update on public.sessions
for each row
execute function public.enforce_session_status_transition();

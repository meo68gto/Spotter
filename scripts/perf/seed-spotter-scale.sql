-- Spotter performance seed
--
-- Usage:
--   -- Optional overrides before running this file:
--   --   select set_config('spotter.perf.users', '3000', false);
--   --   select set_config('spotter.perf.courses', '120', false);
--   --   select set_config('spotter.perf.rounds', '900', false);
--   --   select set_config('spotter.perf.connections_per_user', '3', false);
--   --
--   -- Then execute this file against the local Postgres instance.
--
-- This script seeds a production-shaped dataset for discovery, matching,
-- rounds, and network connection load testing. It is idempotent for the
-- generated "spotter-perf-*" users.

begin;

create extension if not exists pgcrypto;

do $$
declare
  v_user_count integer := greatest(coalesce(nullif(current_setting('spotter.perf.users', true), '')::integer, 3000), 300);
  v_course_count integer := greatest(coalesce(nullif(current_setting('spotter.perf.courses', true), '')::integer, 120), 12);
  v_round_count integer := greatest(coalesce(nullif(current_setting('spotter.perf.rounds', true), '')::integer, 900), 90);
  v_connections_per_user integer := greatest(coalesce(nullif(current_setting('spotter.perf.connections_per_user', true), '')::integer, 3), 1);
  v_free_tier_id uuid;
  v_select_tier_id uuid;
  v_summit_tier_id uuid;
begin
  select id into v_free_tier_id from public.membership_tiers where slug = 'free';
  select id into v_select_tier_id from public.membership_tiers where slug = 'select';
  select id into v_summit_tier_id from public.membership_tiers where slug = 'summit';

  if v_free_tier_id is null or v_select_tier_id is null or v_summit_tier_id is null then
    raise exception 'Membership tiers are required before seeding performance data.';
  end if;

  delete from auth.users where email like 'spotter-perf-%@example.test';

  insert into public.golf_courses (
    id,
    name,
    city,
    state,
    country,
    latitude,
    longitude,
    location,
    is_verified,
    is_active
  )
  select
    gen_random_uuid(),
    format('Spotter Perf Course %s', gs),
    (array['Phoenix', 'Scottsdale', 'Mesa', 'Tempe', 'Gilbert', 'Chandler'])[((gs - 1) % 6) + 1],
    'AZ',
    'US',
    33.30 + (gs * 0.005),
    -112.30 + (gs * 0.005),
    ST_SetSRID(ST_MakePoint(-112.30 + (gs * 0.005), 33.30 + (gs * 0.005)), 4326)::geography,
    true,
    true
  from generate_series(1, v_course_count) as gs
  where not exists (
    select 1
    from public.golf_courses gc
    where gc.name = format('Spotter Perf Course %s', gs)
  );

  create temporary table perf_users on commit drop as
  with generated_users as (
    select
      gen_random_uuid() as user_id,
      gs as seq,
      format('spotter-perf-%s@example.test', gs) as email,
      format('Perf Golfer %s', gs) as display_name,
      case
        when gs <= floor(v_user_count * 0.55) then 'free'
        when gs <= floor(v_user_count * 0.90) then 'select'
        else 'summit'
      end as tier_slug,
      (array['Phoenix', 'Scottsdale', 'Mesa', 'Tempe', 'Gilbert', 'Chandler'])[((gs - 1) % 6) + 1] as city,
      ((gs - 1) % v_course_count) + 1 as course_seq
    from generate_series(1, v_user_count) as gs
  )
  select
    gu.user_id,
    gu.seq,
    gu.email,
    gu.display_name,
    gu.tier_slug,
    gu.city,
    gc.id as course_id
  from generated_users gu
  join public.golf_courses gc
    on gc.name = format('Spotter Perf Course %s', gu.course_seq);

  insert into auth.users (
    id,
    instance_id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    is_sso_user,
    is_anonymous
  )
  select
    pu.user_id,
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    pu.email,
    crypt('SpotterPerf123!', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('display_name', pu.display_name),
    now(),
    now(),
    false,
    false
  from perf_users pu;

  insert into public.users (
    id,
    display_name,
    city,
    home_location,
    allow_connections,
    profile_completeness,
    onboarding_complete,
    tier_id,
    tier_enrolled_at,
    tier_status,
    hunt_mode_enabled,
    appear_in_lower_tier_search,
    search_boosted,
    profile_visibility
  )
  select
    pu.user_id,
    pu.display_name,
    pu.city,
    ST_SetSRID(ST_MakePoint(-112.10 + ((pu.seq % 25) * 0.01), 33.45 + ((pu.seq % 25) * 0.01)), 4326)::geography,
    true,
    80 + (pu.seq % 21),
    true,
    case pu.tier_slug
      when 'free' then v_free_tier_id
      when 'select' then v_select_tier_id
      else v_summit_tier_id
    end,
    now() - make_interval(days => (pu.seq % 180)),
    'active',
    (pu.tier_slug = 'select' and pu.seq % 5 = 0),
    not (pu.tier_slug = 'summit' and pu.seq % 7 = 0),
    (pu.tier_slug = 'summit' and pu.seq % 4 = 0),
    case
      when pu.tier_slug = 'summit' and pu.seq % 6 = 0 then 'summit_only'
      when pu.tier_slug = 'select' and pu.seq % 8 = 0 then 'select_only'
      else 'visible'
    end
  from perf_users pu
  on conflict (id) do update
  set
    display_name = excluded.display_name,
    city = excluded.city,
    home_location = excluded.home_location,
    allow_connections = excluded.allow_connections,
    profile_completeness = excluded.profile_completeness,
    onboarding_complete = excluded.onboarding_complete,
    tier_id = excluded.tier_id,
    tier_enrolled_at = excluded.tier_enrolled_at,
    tier_status = excluded.tier_status,
    hunt_mode_enabled = excluded.hunt_mode_enabled,
    appear_in_lower_tier_search = excluded.appear_in_lower_tier_search,
    search_boosted = excluded.search_boosted,
    profile_visibility = excluded.profile_visibility;

  insert into public.user_professional_identities (
    user_id,
    company,
    title,
    industry,
    years_experience
  )
  select
    pu.user_id,
    format('Company %s', ((pu.seq - 1) % 75) + 1),
    (array['Founder', 'Operator', 'VP Sales', 'Engineer', 'Investor'])[((pu.seq - 1) % 5) + 1],
    (array['software', 'finance', 'real_estate', 'healthcare', 'sports'])[((pu.seq - 1) % 5) + 1],
    3 + (pu.seq % 25)
  from perf_users pu
  on conflict (user_id) do update
  set
    company = excluded.company,
    title = excluded.title,
    industry = excluded.industry,
    years_experience = excluded.years_experience;

  insert into public.user_golf_identities (
    user_id,
    handicap,
    home_course_id,
    playing_frequency,
    years_playing
  )
  select
    pu.user_id,
    round(((pu.seq % 28) + ((pu.seq % 10) / 10.0))::numeric, 1),
    pu.course_id,
    (array['weekly', 'monthly', 'occasionally'])[((pu.seq - 1) % 3) + 1],
    1 + (pu.seq % 30)
  from perf_users pu
  on conflict (user_id) do update
  set
    handicap = excluded.handicap,
    home_course_id = excluded.home_course_id,
    playing_frequency = excluded.playing_frequency,
    years_playing = excluded.years_playing;

  insert into public.user_networking_preferences (
    user_id,
    networking_intent,
    open_to_intros,
    open_to_sending_intros,
    open_to_recurring_rounds,
    preferred_group_size,
    cart_preference,
    preferred_golf_area
  )
  select
    pu.user_id,
    (array['business', 'social', 'competitive', 'business_social'])[((pu.seq - 1) % 4) + 1]::public.networking_intent,
    true,
    true,
    (pu.seq % 3 = 0),
    (array['2', '3', '4', 'any'])[((pu.seq - 1) % 4) + 1]::public.preferred_group_size,
    (array['walking', 'cart', 'either'])[((pu.seq - 1) % 3) + 1]::public.cart_preference,
    format('%s Metro', pu.city)
  from perf_users pu
  on conflict (user_id) do update
  set
    networking_intent = excluded.networking_intent,
    open_to_intros = excluded.open_to_intros,
    open_to_sending_intros = excluded.open_to_sending_intros,
    open_to_recurring_rounds = excluded.open_to_recurring_rounds,
    preferred_group_size = excluded.preferred_group_size,
    cart_preference = excluded.cart_preference,
    preferred_golf_area = excluded.preferred_golf_area;

  insert into public.user_reputation (
    user_id,
    overall_score,
    completion_rate,
    ratings_average,
    network_size,
    referrals_count,
    profile_completeness,
    attendance_rate,
    calculated_at
  )
  select
    pu.user_id,
    55 + (pu.seq % 45),
    70 + (pu.seq % 30),
    round((3 + ((pu.seq % 20) / 10.0))::numeric, 2),
    v_connections_per_user * 2,
    pu.seq % 10,
    80 + (pu.seq % 20),
    75 + (pu.seq % 25),
    now()
  from perf_users pu
  on conflict (user_id) do update
  set
    overall_score = excluded.overall_score,
    completion_rate = excluded.completion_rate,
    ratings_average = excluded.ratings_average,
    network_size = excluded.network_size,
    referrals_count = excluded.referrals_count,
    profile_completeness = excluded.profile_completeness,
    attendance_rate = excluded.attendance_rate,
    calculated_at = excluded.calculated_at;

  create temporary table perf_ranked_users on commit drop as
  select
    pu.*,
    row_number() over (partition by pu.tier_slug order by pu.seq) as tier_rank,
    count(*) over (partition by pu.tier_slug) as tier_size
  from perf_users pu;

  insert into public.user_connections (
    user_id,
    connected_user_id,
    status,
    intro_source,
    responded_at
  )
  select
    a.user_id,
    b.user_id,
    'accepted',
    'direct',
    now() - make_interval(days => ((a.seq + step_offset) % 45))
  from perf_ranked_users a
  join generate_series(1, v_connections_per_user) as step_offset on true
  join perf_ranked_users b
    on b.tier_slug = a.tier_slug
   and b.tier_rank = ((a.tier_rank + step_offset - 1) % a.tier_size) + 1
  where a.user_id <> b.user_id
    and a.user_id < b.user_id
  on conflict (user_id, connected_user_id) do nothing;

  create temporary table perf_round_creators on commit drop as
  select *
  from perf_ranked_users
  where tier_slug in ('select', 'summit');

  insert into public.rounds (
    id,
    creator_id,
    course_id,
    scheduled_at,
    max_players,
    cart_preference,
    tier_id,
    status,
    notes
  )
  select
    gen_random_uuid(),
    creator.user_id,
    creator.course_id,
    now() + make_interval(days => (gs % 45), hours => (gs % 12)),
    4,
    (array['walking', 'cart', 'either'])[((gs - 1) % 3) + 1]::public.cart_preference,
    case creator.tier_slug
      when 'select' then v_select_tier_id
      else v_summit_tier_id
    end,
    (case when gs % 5 = 0 then 'full' else 'open' end)::public.round_status,
    format('Spotter perf round %s', gs)
  from generate_series(1, v_round_count) as gs
  join perf_round_creators creator
    on creator.tier_rank = ((gs - 1) % creator.tier_size) + 1
   and creator.tier_slug = (case when gs % 4 = 0 then 'summit' else 'select' end);

  create temporary table perf_round_pool on commit drop as
  select
    r.id as round_id,
    r.creator_id,
    mt.slug as tier_slug
  from public.rounds r
  join public.membership_tiers mt on mt.id = r.tier_id
  where r.notes like 'Spotter perf round %';

  insert into public.round_participants_v2 (
    round_id,
    user_id,
    is_creator,
    joined_at
  )
  select
    prp.round_id,
    participant.user_id,
    participant.user_id = prp.creator_id,
    now() - make_interval(days => (participant.seq % 10))
  from perf_round_pool prp
  join lateral (
    select prru.user_id, prru.seq
    from perf_ranked_users prru
    where prru.tier_slug = prp.tier_slug
      and (
        prru.user_id = prp.creator_id
        or prru.tier_rank in (
          ((abs(hashtextextended(prp.round_id::text, 17))::integer % prru.tier_size) + 1),
          ((abs(hashtextextended(prp.round_id::text, 31))::integer % prru.tier_size) + 1),
          ((abs(hashtextextended(prp.round_id::text, 47))::integer % prru.tier_size) + 1)
        )
      )
    order by prru.user_id = prp.creator_id desc, prru.seq
    limit 4
  ) as participant on true
  on conflict (round_id, user_id) do nothing;

  insert into public.round_invitations (
    round_id,
    invitee_id,
    status,
    invited_at
  )
  select
    prp.round_id,
    invitee.user_id,
    'pending',
    now() - make_interval(hours => (invitee.seq % 48))
  from perf_round_pool prp
  join lateral (
    select prru.user_id, prru.seq
    from perf_ranked_users prru
    where prru.tier_slug = prp.tier_slug
      and prru.user_id <> prp.creator_id
    order by abs(hashtextextended((prp.round_id::text || prru.user_id::text), 71))::bigint
    limit 2
  ) as invitee on true
  on conflict (round_id, invitee_id) do nothing;
end $$;

commit;

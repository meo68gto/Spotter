-- packages/db/seeds/seed.sql
-- Seed data for local development and testing.

-- Activities
insert into public.activities (slug, name, category, metadata)
values
  ('skiing', 'Skiing', 'snow', '{"scales": ["beginner", "intermediate", "advanced", "expert"]}'),
  ('golf', 'Golf', 'course', '{"scales": ["usga"]}'),
  ('tennis', 'Tennis', 'court', '{"scales": ["ntrp"]}'),
  ('pickleball', 'Pickleball', 'court', '{"scales": ["beginner", "intermediate", "advanced", "pro"]}'),
  ('running', 'Running', 'track', '{"scales": ["5k", "10k", "half_marathon", "marathon"]}')
on conflict (slug) do nothing;

-- Test users (local dev only — these users reference Supabase auth.users UUIDs)
-- In a real dev environment, create these via `supabase auth import` or the dashboard.
-- The UUIDs below are stable fixtures used by integration tests.
insert into public.users (
  id,
  display_name,
  bio,
  location_point,
  skill_level
)
values
  (
    '00000000-0000-0000-0000-000000000001'::uuid,
    'Alice Dev',
    'Test user — seeker looking for tennis partners.',
    ST_SetSRID(ST_MakePoint(-122.4194, 37.7749), 4326),
    'intermediate'
  ),
  (
    '00000000-0000-0000-0000-000000000002'::uuid,
    'Bob Dev',
    'Test user — expert tennis coach.',
    ST_SetSRID(ST_MakePoint(-122.4094, 37.7849), 4326),
    'advanced'
  ),
  (
    '00000000-0000-0000-0000-000000000003'::uuid,
    'Carol Dev',
    'Test user — beginner golfer.',
    ST_SetSRID(ST_MakePoint(-122.4294, 37.7649), 4326),
    'beginner'
  )
on conflict (id) do nothing;

-- Expert profiles for test users
insert into public.coach_profiles (
  id,
  user_id,
  bio,
  activity_ids,
  hourly_rate_cents,
  currency,
  active
)
values
  (
    '10000000-0000-0000-0000-000000000001'::uuid,
    '00000000-0000-0000-0000-000000000002'::uuid,
    'Certified tennis coach with 10 years experience.',
    ARRAY(select id from public.activities where slug = 'tennis'),
    7500,
    'usd',
    true
  )
on conflict (id) do nothing;

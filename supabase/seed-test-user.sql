-- Seed script for test user: free@spotter.test
-- Run this after `supabase db execute` or in the Supabase SQL editor

-- Create the test user in auth.users
-- The user will need to confirm their email (set email_confirm = true to skip)
INSERT INTO auth.users (
  id,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  instance_id,
  raw_user_meta_data,
  raw_app_meta_data
) VALUES (
  gen_random_uuid(),
  'free@spotter.test',
  -- This will be overwritten by Supabase Auth on first login attempt
  -- Run: UPDATE auth.users SET encrypted_password = ... WHERE email = 'free@spotter.test'
  crypt('SpotterTest123!', gen_salt('bf')),
  NOW(),
  NOW(),
  NOW(),
  '00000000-0000-0000-0000-000000000000',
  '{"provider": "email"}'::jsonb,
  '{"provider": "email", "role": "authenticated"}'::jsonb
) ON CONFLICT (email) DO UPDATE SET
  encrypted_password = crypt('SpotterTest123!', gen_salt('bf')),
  email_confirmed_at = NOW(),
  updated_at = NOW();

-- Alternatively, use the Supabase Auth Admin API to create the user:
-- curl -X POST 'https://api.supabase.com/v1/projects/<project-ref>/auth/users' \
--   -H 'Authorization: Bearer <service-role-key>' \
--   -H 'Content-Type: application/json' \
--   -d '{"email": "free@spotter.test", "password": "SpotterTest123!", "email_confirm": true}'

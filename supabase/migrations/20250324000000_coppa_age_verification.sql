-- ============================================================================
-- COPPA Age Verification — Migration 20250324000000
-- Fox for Diana | Legal Division | Batcave Command Center | 2026-03-24
--
-- Purpose:
--   - Add date_of_birth column to public.users for COPPA age verification
--   - The app now enforces age gate at onboarding (18+ required)
--   - date_of_birth is stored but NOT used for marketing or any other purpose
--   - RLS policy: users can only read/write their own date_of_birth
-- ============================================================================

-- Add date_of_birth to users table
alter table public.users
add column if not exists date_of_birth date;

-- Add age_verified flag (set to true once the COPPA age gate passes)
alter table public.users
add column if not exists age_verified boolean not null default false;

-- Add index for admin queries (e.g., finding accounts with suspiciously young DOBs)
create index if not exists idx_users_date_of_birth on public.users (date_of_birth);

-- RLS: Only the user themselves can read their own date of birth
drop policy if exists users_select_date_of_birth_own on public.users;
create policy users_select_date_of_birth_own on public.users
  for select using (auth.uid() = id);

-- RLS: Only the user themselves can update their own date of birth
drop policy if exists users_update_date_of_birth_own on public.users;
create policy users_update_date_of_birth_own on public.users
  for update using (auth.uid() = id)
  with check (auth.uid() = id);

-- Admin policy: admins can read date_of_birth for compliance purposes
-- (Create this only if admin_audit_logs table exists)
do $$
begin
  if exists (select 1 from information_schema.tables where table_name = 'admin_users') then
    create policy admin_select_users_date_of_birth on public.users
      for select using (
        exists (
          select 1 from public.admin_users au
          where au.user_id = auth.uid()
        )
      );
  end if;
exception when undefined_table then
  null; -- table doesn't exist yet, skip
end;
$$;

-- Comments for documentation
comment on column public.users.date_of_birth is
  'Date of birth collected at COPPA age gate during onboarding. Not used for marketing.';
comment on column public.users.age_verified is
  'True once the user has passed the COPPA age verification gate (18+).';

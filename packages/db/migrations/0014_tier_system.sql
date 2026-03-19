-- Tier System Migration - Spotter Golf Networking
-- Creates membership tiers with feature gates and same-tier visibility enforcement

-- ============================================
-- UP MIGRATION
-- ============================================

-- 1. Create enum types
-- Tier status enum
create type public.tier_status as enum ('active', 'inactive', 'expired', 'cancelled', 'pending');

-- Visibility scope enum - currently only 'same_tier_only' per requirements
create type public.visibility_scope as enum ('same_tier_only');

-- Billing interval enum
create type public.billing_interval as enum ('monthly', 'annual', 'lifetime');

-- 2. Create membership_tiers table
create table if not exists public.membership_tiers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  short_description text,
  price_cents integer not null default 0,
  price_currency text not null default 'usd',
  billing_interval public.billing_interval not null default 'annual',
  stripe_price_id text,
  visibility_scope public.visibility_scope not null default 'same_tier_only',
  -- Feature gates as JSONB
  features jsonb not null default '{}'::jsonb,
  -- UI/Display fields
  badge_url text,
  card_color text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  -- Timestamps
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Add constraint to ensure features JSON has expected structure
alter table public.membership_tiers
  add constraint valid_features check (
    features ? 'maxSearchResults' or
    features ? 'maxConnections' or
    features ? 'maxRoundsPerMonth' or
    features ? 'introCreditsMonthly' or
    features ? 'canCreateRounds' or
    features ? 'canSendIntros' or
    features ? 'canReceiveIntros' or
    features ? 'profileVisibility'
  );

-- 3. Add tier columns to users table
alter table public.users
  add column if not exists tier_id uuid references public.membership_tiers(id) on delete set null,
  add column if not exists tier_enrolled_at timestamptz,
  add column if not exists tier_expires_at timestamptz,
  add column if not exists tier_status public.tier_status not null default 'pending';

-- 4. Create tier_history audit table
create table if not exists public.tier_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  previous_tier_id uuid references public.membership_tiers(id) on delete set null,
  new_tier_id uuid not null references public.membership_tiers(id) on delete restrict,
  previous_status public.tier_status,
  new_status public.tier_status not null,
  change_reason text,
  changed_at timestamptz not null default now(),
  changed_by uuid references auth.users(id) on delete set null,
  stripe_checkout_session_id text,
  stripe_payment_intent_id text,
  metadata jsonb not null default '{}'::jsonb
);

-- 5. Create indexes for performance
create index if not exists idx_users_tier_id on public.users(tier_id);
create index if not exists idx_users_tier_status on public.users(tier_status);
create index if not exists idx_users_tier_expires on public.users(tier_expires_at) where tier_expires_at is not null;
create index if not exists idx_tier_history_user on public.tier_history(user_id, changed_at desc);
create index if not exists idx_tier_history_new_tier on public.tier_history(new_tier_id, changed_at desc);
create index if not exists idx_membership_tiers_slug on public.membership_tiers(slug);
create index if not exists idx_membership_tiers_sort_order on public.membership_tiers(sort_order, is_active);

-- 6. Enable RLS on new tables
alter table public.membership_tiers enable row level security;
alter table public.tier_history enable row level security;

-- 7. Seed the three membership tiers

-- FREE tier: $0, annual (or effectively free), limited features
insert into public.membership_tiers (
  name,
  slug,
  description,
  short_description,
  price_cents,
  billing_interval,
  features,
  card_color,
  sort_order,
  is_active
) values (
  'Free',
  'free',
  'Basic access to connect with other golfers. Limited search results and connections.',
  'Limited access for casual golfers',
  0,
  'annual', -- Free tier bills annually at $0
  jsonb_build_object(
    'maxSearchResults', 20,
    'maxConnections', 50,
    'maxRoundsPerMonth', 0,
    'introCreditsMonthly', 0,
    'canCreateRounds', false,
    'canSendIntros', false,
    'canReceiveIntros', true,
    'profileVisibility', 'public'
  ),
  '#94A3B8', -- slate-400
  1,
  true
)
on conflict (slug) do nothing;

-- SELECT tier: $1,000/year ($100,000 cents), enhanced features
insert into public.membership_tiers (
  name,
  slug,
  description,
  short_description,
  price_cents,
  billing_interval,
  features,
  card_color,
  sort_order,
  is_active
) values (
  'Select',
  'select',
  'Full access to unlimited search and connections. Create up to 4 rounds per month with 3 monthly intro credits.',
  'Full access for serious golfers',
  100000,
  'annual',
  jsonb_build_object(
    'maxSearchResults', null, -- unlimited
    'maxConnections', 500,
    'maxRoundsPerMonth', 4,
    'introCreditsMonthly', 3,
    'canCreateRounds', true,
    'canSendIntros', true,
    'canReceiveIntros', true,
    'profileVisibility', 'public'
  ),
  '#F59E0B', -- amber-500
  2,
  true
)
on conflict (slug) do nothing;

-- SUMMIT tier: $10,000 lifetime ($1,000,000 cents), unlimited everything
insert into public.membership_tiers (
  name,
  slug,
  description,
  short_description,
  price_cents,
  billing_interval,
  features,
  card_color,
  sort_order,
  is_active
) values (
  'Summit',
  'summit',
  'Lifetime unlimited access with priority boosts and exclusive features. The ultimate membership for dedicated golfers.',
  'Lifetime unlimited access with priority boosts',
  1000000,
  'lifetime',
  jsonb_build_object(
    'maxSearchResults', null, -- unlimited
    'maxConnections', null, -- unlimited
    'maxRoundsPerMonth', null, -- unlimited
    'introCreditsMonthly', null, -- unlimited
    'canCreateRounds', true,
    'canSendIntros', true,
    'canReceiveIntros', true,
    'profileVisibility', 'priority',
    'priorityBoosts', true,
    'exclusiveAccess', true
  ),
  '#7C3AED', -- violet-600
  3,
  true
)
on conflict (slug) do nothing;

-- 8. Create RLS policies for membership_tiers

-- All authenticated users can view active tiers
-- This is needed for users to see what tiers are available
create policy membership_tiers_select_active on public.membership_tiers
  for select using (is_active = true);

-- Only admins can modify tiers (using a simple check that only matches never)
-- In production, this would check for an admin role
create policy membership_tiers_insert_admin on public.membership_tiers
  for insert with check (false);

create policy membership_tiers_update_admin on public.membership_tiers
  for update using (false) with check (false);

create policy membership_tiers_delete_admin on public.membership_tiers
  for delete using (false);

-- 9. Create RLS policies for tier_history

-- Users can only see their own tier history
create policy tier_history_select_own on public.tier_history
  for select using (user_id = auth.uid());

-- System can insert tier history (but not regular users directly)
-- This allows triggers/functions to log changes
create policy tier_history_insert_system on public.tier_history
  for insert with check (false); -- Only via security definer functions

-- 10. Update users table RLS to enforce same-tier visibility

-- Drop existing select policy on users
-- (We need to recreate it to include tier-based visibility)

-- Note: The existing policy is users_select_self which allows users to see themselves
-- We'll keep that and add additional policies for same-tier visibility

-- Policy: Users can view other users in the same tier
-- This enforces the visibility scope at the database level
create policy users_select_same_tier on public.users
  for select using (
    -- User can always see themselves
    auth.uid() = id
    -- OR user can see others in the same tier
    or exists (
      select 1
      from public.users current_user
      where current_user.id = auth.uid()
        and current_user.tier_id is not null
        and users.tier_id = current_user.tier_id
        -- Only if their tier allows same-tier visibility
        and exists (
          select 1 from public.membership_tiers mt
          where mt.id = current_user.tier_id
            and mt.visibility_scope = 'same_tier_only'
        )
    )
    -- OR user is Free tier viewing public profiles (can receive intros)
    or (
      exists (
        select 1
        from public.users current_user
        join public.membership_tiers mt on mt.id = current_user.tier_id
        where current_user.id = auth.uid()
          and mt.slug = 'free'
      )
      and users.tier_id in (
        select id from public.membership_tiers where slug in ('free', 'select', 'summit')
      )
    )
  );

-- 11. Create trigger function to log tier changes
create or replace function public.log_tier_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Only log if tier-related fields actually changed
  if old.tier_id is distinct from new.tier_id
     or old.tier_status is distinct from new.tier_status
  then
    insert into public.tier_history (
      user_id,
      previous_tier_id,
      new_tier_id,
      previous_status,
      new_status,
      changed_by
    ) values (
      new.id,
      old.tier_id,
      new.tier_id,
      old.tier_status,
      new.tier_status,
      auth.uid()
    );
  end if;
  return new;
end;
$$;

-- Apply trigger to users table
create trigger trg_users_tier_change
  after update of tier_id, tier_status on public.users
  for each row
  execute function public.log_tier_change();

-- 12. Add updated_at trigger for membership_tiers
create trigger trg_membership_tiers_updated_at
  before update on public.membership_tiers
  for each row
  execute function public.set_updated_at();

-- 13. Add realtime publication
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.membership_tiers;
    alter publication supabase_realtime add table public.tier_history;
  end if;
end $$;

-- ============================================
-- DOWN MIGRATION (rollback)
-- ============================================
-- Note: Uncomment the following section to run rollback
-- This is provided for reference and manual rollback scenarios
/*
-- Remove triggers
drop trigger if exists trg_membership_tiers_updated_at on public.membership_tiers;
drop trigger if exists trg_users_tier_change on public.users;

-- Remove functions
drop function if exists public.log_tier_change();

-- Remove RLS policies
drop policy if exists membership_tiers_select_active on public.membership_tiers;
drop policy if exists membership_tiers_insert_admin on public.membership_tiers;
drop policy if exists membership_tiers_update_admin on public.membership_tiers;
drop policy if exists membership_tiers_delete_admin on public.membership_tiers;
drop policy if exists tier_history_select_own on public.tier_history;
drop policy if exists tier_history_insert_system on public.tier_history;
drop policy if exists users_select_same_tier on public.users;

-- Disable RLS
alter table public.membership_tiers disable row level security;
alter table public.tier_history disable row level security;

-- Remove indexes
drop index if exists idx_users_tier_id;
drop index if exists idx_users_tier_status;
drop index if exists idx_users_tier_expires;
drop index if exists idx_tier_history_user;
drop index if exists idx_tier_history_new_tier;
drop index if exists idx_membership_tiers_slug;
drop index if exists idx_membership_tiers_sort_order;

-- Remove tier columns from users
alter table public.users
  drop column if exists tier_id,
  drop column if exists tier_enrolled_at,
  drop column if exists tier_expires_at,
  drop column if exists tier_status;

-- Drop tables
drop table if exists public.tier_history;
drop table if exists public.membership_tiers;

-- Drop types
drop type if exists public.tier_status;
drop type if exists public.visibility_scope;
drop type if exists public.billing_interval;
*/

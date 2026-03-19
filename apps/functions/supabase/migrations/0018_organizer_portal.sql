-- Tournament Organizer Portal Schema Migration
-- Creates B2B organizer accounts with tiered pricing and event management

-- ============================================
-- UP MIGRATION
-- ============================================

-- 1. Create enum types
-- Organizer tier enum
create type public.organizer_tier as enum ('bronze', 'silver', 'gold');

-- Organizer member role enum
create type public.organizer_role as enum ('owner', 'admin', 'manager', 'viewer');

-- Event type enum
create type public.organizer_event_type as enum ('tournament', 'scramble', 'charity', 'corporate', 'social');

-- Event status enum
create type public.organizer_event_status as enum (
  'draft',
  'published',
  'registration_open',
  'full',
  'in_progress',
  'completed',
  'cancelled'
);

-- Registration status enum
create type public.organizer_registration_status as enum (
  'registered',
  'waitlisted',
  'confirmed',
  'checked_in',
  'no_show',
  'cancelled'
);

-- Payment status enum
create type public.organizer_payment_status as enum ('pending', 'paid', 'waived', 'refunded');

-- Invite status enum
create type public.organizer_invite_status as enum ('pending', 'accepted', 'declined', 'expired');

-- Analytics metric type enum
create type public.organizer_metric_type as enum ('registration', 'attendance', 'revenue', 'engagement');

-- 2. Create organizer_accounts table (B2B organizer accounts)
create table if not exists public.organizer_accounts (
  id uuid primary key default gen_random_uuid(),
  -- Basic info
  name text not null,
  slug text not null unique,
  -- Tier and quotas
  tier public.organizer_tier not null default 'bronze',
  monthly_event_quota integer, -- null means unlimited (gold tier)
  events_used_this_month integer not null default 0,
  quota_resets_at timestamptz,
  -- Contact info
  contact_email text not null,
  contact_phone text,
  billing_email text,
  -- Branding
  website_url text,
  logo_url text,
  -- Stripe integration
  stripe_customer_id text,
  -- Status
  is_active boolean not null default true,
  is_verified boolean not null default false,
  -- Timestamps
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 3. Create organizer_members table (link organizers to staff members)
create table if not exists public.organizer_members (
  id uuid primary key default gen_random_uuid(),
  organizer_id uuid not null references public.organizer_accounts(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  -- Role and permissions
  role public.organizer_role not null default 'viewer',
  permissions jsonb not null default '{}'::jsonb,
  -- Invitation tracking
  invited_at timestamptz not null default now(),
  joined_at timestamptz,
  -- Status
  is_active boolean not null default true,
  -- Timestamps
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Constraints
  unique(organizer_id, user_id)
);

-- 4. Create organizer_events table (events created by organizers)
create table if not exists public.organizer_events (
  id uuid primary key default gen_random_uuid(),
  organizer_id uuid not null references public.organizer_accounts(id) on delete cascade,
  -- Event details
  name text not null,
  slug text not null,
  description text,
  event_type public.organizer_event_type not null default 'tournament',
  status public.organizer_event_status not null default 'draft',
  -- Location and timing
  course_id uuid references public.golf_courses(id) on delete set null,
  event_date date not null,
  start_time time,
  end_time time,
  -- Registration
  max_participants integer not null default 100,
  current_participants integer not null default 0,
  registration_opens_at timestamptz,
  registration_closes_at timestamptz,
  -- Pricing
  price_cents integer,
  price_currency text not null default 'usd',
  -- Visibility
  is_private boolean not null default false,
  invite_only boolean not null default false,
  target_tiers jsonb not null default '[]'::jsonb, -- which member tiers can see this
  -- Creator reference
  created_by uuid references public.organizer_members(id) on delete set null,
  -- Timestamps
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Constraints
  unique(organizer_id, slug),
  check (current_participants <= max_participants),
  check (price_cents is null or price_cents >= 0)
);

-- 5. Create organizer_event_registrations table (member registrations)
create table if not exists public.organizer_event_registrations (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.organizer_events(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  -- Status tracking
  status public.organizer_registration_status not null default 'registered',
  registered_at timestamptz not null default now(),
  confirmed_at timestamptz,
  checked_in_at timestamptz,
  -- Payment
  payment_status public.organizer_payment_status not null default 'pending',
  payment_intent_id text, -- stripe payment intent
  -- Additional info
  notes text,
  handicap_at_registration numeric(4, 1),
  -- Timestamps
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Constraints
  unique(event_id, user_id)
);

-- 6. Create organizer_invites table (invites sent by organizers)
create table if not exists public.organizer_invites (
  id uuid primary key default gen_random_uuid(),
  organizer_id uuid not null references public.organizer_accounts(id) on delete cascade,
  event_id uuid references public.organizer_events(id) on delete set null,
  sender_id uuid not null references public.organizer_members(id) on delete cascade,
  -- Recipient
  recipient_email text not null,
  recipient_user_id uuid references public.users(id) on delete set null,
  -- Status and content
  status public.organizer_invite_status not null default 'pending',
  message text,
  sent_at timestamptz not null default now(),
  responded_at timestamptz,
  -- Quota tracking
  invite_quota_used boolean not null default false,
  -- Timestamps
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 7. Create organizer_analytics table (aggregated analytics)
create table if not exists public.organizer_analytics (
  id uuid primary key default gen_random_uuid(),
  organizer_id uuid not null references public.organizer_accounts(id) on delete cascade,
  event_id uuid references public.organizer_events(id) on delete cascade,
  -- Date range
  date_range_start date not null,
  date_range_end date not null,
  -- Metric data
  metric_type public.organizer_metric_type not null,
  data jsonb not null default '{}'::jsonb,
  -- Calculation tracking
  calculated_at timestamptz not null default now(),
  -- Timestamps
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 8. Create organizer_api_keys table (API keys for Gold tier)
create table if not exists public.organizer_api_keys (
  id uuid primary key default gen_random_uuid(),
  organizer_id uuid not null references public.organizer_accounts(id) on delete cascade,
  -- Key data (hashed for security)
  key_hash text not null,
  key_prefix text not null, -- last 4 chars for display
  -- Metadata
  name text not null,
  permissions jsonb not null default '{}'::jsonb,
  -- Usage tracking
  last_used_at timestamptz,
  expires_at timestamptz,
  -- Status
  is_active boolean not null default true,
  created_by uuid references public.organizer_members(id) on delete set null,
  -- Timestamps
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 9. Update existing tables
-- Add organizer_id to golf_courses (optional link)
alter table public.golf_courses
  add column if not exists organizer_id uuid references public.organizer_accounts(id) on delete set null;

-- Add can_see_organizer_events to membership_tiers features
-- Note: This is a JSONB field, so we update the constraint to include the new feature
alter table public.membership_tiers
  drop constraint if exists valid_features;

alter table public.membership_tiers
  add constraint valid_features check (
    features ? 'maxSearchResults' or
    features ? 'maxConnections' or
    features ? 'maxRoundsPerMonth' or
    features ? 'introCreditsMonthly' or
    features ? 'canCreateRounds' or
    features ? 'canSendIntros' or
    features ? 'canReceiveIntros' or
    features ? 'profileVisibility' or
    features ? 'canSeeOrganizerEvents'
  );

-- 10. Create indexes for performance

-- Organizer accounts indexes
create index if not exists idx_organizer_accounts_slug on public.organizer_accounts(slug);
create index if not exists idx_organizer_accounts_tier on public.organizer_accounts(tier);
create index if not exists idx_organizer_accounts_active on public.organizer_accounts(is_active) where is_active = true;

-- Organizer members indexes
create index if not exists idx_organizer_members_organizer on public.organizer_members(organizer_id);
create index if not exists idx_organizer_members_user on public.organizer_members(user_id);
create index if not exists idx_organizer_members_role on public.organizer_members(organizer_id, role) where is_active = true;

-- Organizer events indexes
create index if not exists idx_organizer_events_organizer on public.organizer_events(organizer_id);
create index if not exists idx_organizer_events_status on public.organizer_events(status);
create index if not exists idx_organizer_events_date on public.organizer_events(event_date);
create index if not exists idx_organizer_events_course on public.organizer_events(course_id);
create index if not exists idx_organizer_events_visibility on public.organizer_events(is_private, invite_only, status) where status in ('published', 'registration_open', 'full');

-- Organizer registrations indexes
create index if not exists idx_organizer_registrations_event on public.organizer_event_registrations(event_id);
create index if not exists idx_organizer_registrations_user on public.organizer_event_registrations(user_id);
create index if not exists idx_organizer_registrations_status on public.organizer_event_registrations(event_id, status);

-- Organizer invites indexes
create index if not exists idx_organizer_invites_organizer on public.organizer_invites(organizer_id);
create index if not exists idx_organizer_invites_status on public.organizer_invites(status) where status = 'pending';
create index if not exists idx_organizer_invites_recipient on public.organizer_invites(recipient_email);

-- Organizer analytics indexes
create index if not exists idx_organizer_analytics_organizer on public.organizer_analytics(organizer_id, date_range_start desc);
create index if not exists idx_organizer_analytics_event on public.organizer_analytics(event_id) where event_id is not null;
create index if not exists idx_organizer_analytics_metric on public.organizer_analytics(organizer_id, metric_type, date_range_start desc);

-- Organizer API keys indexes
create index if not exists idx_organizer_api_keys_organizer on public.organizer_api_keys(organizer_id);
create index if not exists idx_organizer_api_keys_hash on public.organizer_api_keys(key_hash);
create index if not exists idx_organizer_api_keys_active on public.organizer_api_keys(organizer_id, is_active) where is_active = true;

-- Golf courses organizer link index
create index if not exists idx_golf_courses_organizer on public.golf_courses(organizer_id) where organizer_id is not null;

-- 11. Enable RLS on new tables
alter table public.organizer_accounts enable row level security;
alter table public.organizer_members enable row level security;
alter table public.organizer_events enable row level security;
alter table public.organizer_event_registrations enable row level security;
alter table public.organizer_invites enable row level security;
alter table public.organizer_analytics enable row level security;
alter table public.organizer_api_keys enable row level security;

-- 12. Create RLS policies for organizer_accounts
-- Organizers: only own staff can see

create policy organizer_accounts_select_staff on public.organizer_accounts
  for select using (
    exists (
      select 1 from public.organizer_members om
      where om.organizer_id = organizer_accounts.id
        and om.user_id = auth.uid()
        and om.is_active = true
    )
  );

create policy organizer_accounts_update_staff on public.organizer_accounts
  for update using (
    exists (
      select 1 from public.organizer_members om
      where om.organizer_id = organizer_accounts.id
        and om.user_id = auth.uid()
        and om.is_active = true
        and om.role in ('owner', 'admin')
    )
  ) with check (
    exists (
      select 1 from public.organizer_members om
      where om.organizer_id = organizer_accounts.id
        and om.user_id = auth.uid()
        and om.is_active = true
        and om.role in ('owner', 'admin')
    )
  );

-- Only owners can delete
create policy organizer_accounts_delete_owner on public.organizer_accounts
  for delete using (
    exists (
      select 1 from public.organizer_members om
      where om.organizer_id = organizer_accounts.id
        and om.user_id = auth.uid()
        and om.is_active = true
        and om.role = 'owner'
    )
  );

-- 13. Create RLS policies for organizer_members
-- Staff can see other members of their organizer

create policy organizer_members_select_staff on public.organizer_members
  for select using (
    exists (
      select 1 from public.organizer_members om
      where om.organizer_id = organizer_members.organizer_id
        and om.user_id = auth.uid()
        and om.is_active = true
    )
  );

create policy organizer_members_insert_admin on public.organizer_members
  for insert with check (
    exists (
      select 1 from public.organizer_members om
      where om.organizer_id = organizer_members.organizer_id
        and om.user_id = auth.uid()
        and om.is_active = true
        and om.role in ('owner', 'admin')
    )
  );

create policy organizer_members_update_admin on public.organizer_members
  for update using (
    exists (
      select 1 from public.organizer_members om
      where om.organizer_id = organizer_members.organizer_id
        and om.user_id = auth.uid()
        and om.is_active = true
        and om.role in ('owner', 'admin')
    )
  ) with check (
    exists (
      select 1 from public.organizer_members om
      where om.organizer_id = organizer_members.organizer_id
        and om.user_id = auth.uid()
        and om.is_active = true
        and om.role in ('owner', 'admin')
    )
  );

-- Users can update their own member record (e.g., accept invite)
create policy organizer_members_update_self on public.organizer_members
  for update using (
    user_id = auth.uid()
  ) with check (
    user_id = auth.uid()
  );

-- 14. Create RLS policies for organizer_events
-- Events: visible to target tiers + organizer staff

create policy organizer_events_select_visible on public.organizer_events
  for select using (
    -- Organizer staff can see all their events
    exists (
      select 1 from public.organizer_members om
      where om.organizer_id = organizer_events.organizer_id
        and om.user_id = auth.uid()
        and om.is_active = true
    )
    -- Public events visible to members in target tiers
    or (
      status in ('published', 'registration_open', 'full')
      and not is_private
      and (
        jsonb_array_length(target_tiers) = 0
        or exists (
          select 1 from public.users u
          join public.membership_tiers mt on mt.id = u.tier_id
          where u.id = auth.uid()
            and mt.slug in (select jsonb_array_elements_text(target_tiers))
        )
      )
    )
    -- Invite-only events visible to invited users
    or (
      invite_only
      and exists (
        select 1 from public.organizer_invites oi
        where oi.event_id = organizer_events.id
          and oi.recipient_user_id = auth.uid()
          and oi.status = 'accepted'
      )
    )
  );

create policy organizer_events_insert_staff on public.organizer_events
  for insert with check (
    exists (
      select 1 from public.organizer_members om
      where om.organizer_id = organizer_events.organizer_id
        and om.user_id = auth.uid()
        and om.is_active = true
        and om.role in ('owner', 'admin', 'manager')
    )
  );

create policy organizer_events_update_staff on public.organizer_events
  for update using (
    exists (
      select 1 from public.organizer_members om
      where om.organizer_id = organizer_events.organizer_id
        and om.user_id = auth.uid()
        and om.is_active = true
        and om.role in ('owner', 'admin', 'manager')
    )
  ) with check (
    exists (
      select 1 from public.organizer_members om
      where om.organizer_id = organizer_events.organizer_id
        and om.user_id = auth.uid()
        and om.is_active = true
        and om.role in ('owner', 'admin', 'manager')
    )
  );

create policy organizer_events_delete_admin on public.organizer_events
  for delete using (
    exists (
      select 1 from public.organizer_members om
      where om.organizer_id = organizer_events.organizer_id
        and om.user_id = auth.uid()
        and om.is_active = true
        and om.role in ('owner', 'admin')
    )
  );

-- 15. Create RLS policies for organizer_event_registrations
-- Registrations: user sees own, organizer sees event registrations

create policy organizer_registrations_select_own on public.organizer_event_registrations
  for select using (
    user_id = auth.uid()
    or exists (
      select 1 from public.organizer_events oe
      join public.organizer_members om on om.organizer_id = oe.organizer_id
      where oe.id = organizer_event_registrations.event_id
        and om.user_id = auth.uid()
        and om.is_active = true
    )
  );

create policy organizer_registrations_insert_self on public.organizer_event_registrations
  for insert with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.organizer_events oe
      where oe.id = organizer_event_registrations.event_id
        and oe.status in ('published', 'registration_open')
    )
  );

create policy organizer_registrations_update_staff on public.organizer_event_registrations
  for update using (
    exists (
      select 1 from public.organizer_events oe
      join public.organizer_members om on om.organizer_id = oe.organizer_id
      where oe.id = organizer_event_registrations.event_id
        and om.user_id = auth.uid()
        and om.is_active = true
        and om.role in ('owner', 'admin', 'manager')
    )
  ) with check (
    exists (
      select 1 from public.organizer_events oe
      join public.organizer_members om on om.organizer_id = oe.organizer_id
      where oe.id = organizer_event_registrations.event_id
        and om.user_id = auth.uid()
        and om.is_active = true
        and om.role in ('owner', 'admin', 'manager')
    )
  );

-- Users can cancel their own registration
create policy organizer_registrations_cancel_self on public.organizer_event_registrations
  for update using (
    user_id = auth.uid()
    and status not in ('checked_in', 'no_show')
  ) with check (
    user_id = auth.uid()
    and status = 'cancelled'
  );

-- 16. Create RLS policies for organizer_invites
-- Invites: organizer staff only

create policy organizer_invites_select_staff on public.organizer_invites
  for select using (
    exists (
      select 1 from public.organizer_members om
      where om.organizer_id = organizer_invites.organizer_id
        and om.user_id = auth.uid()
        and om.is_active = true
    )
    or recipient_user_id = auth.uid()
  );

create policy organizer_invites_insert_staff on public.organizer_invites
  for insert with check (
    exists (
      select 1 from public.organizer_members om
      where om.organizer_id = organizer_invites.organizer_id
        and om.user_id = auth.uid()
        and om.is_active = true
        and om.role in ('owner', 'admin', 'manager')
    )
  );

create policy organizer_invites_update_staff on public.organizer_invites
  for update using (
    exists (
      select 1 from public.organizer_members om
      where om.organizer_id = organizer_invites.organizer_id
        and om.user_id = auth.uid()
        and om.is_active = true
    )
  ) with check (
    exists (
      select 1 from public.organizer_members om
      where om.organizer_id = organizer_invites.organizer_id
        and om.user_id = auth.uid()
        and om.is_active = true
    )
  );

-- Recipient can update their own invite (accept/decline)
create policy organizer_invites_update_recipient on public.organizer_invites
  for update using (
    recipient_user_id = auth.uid()
    and status = 'pending'
  ) with check (
    recipient_user_id = auth.uid()
    and status in ('accepted', 'declined')
  );

-- 17. Create RLS policies for organizer_analytics
-- Analytics: organizer staff only

create policy organizer_analytics_select_staff on public.organizer_analytics
  for select using (
    exists (
      select 1 from public.organizer_members om
      where om.organizer_id = organizer_analytics.organizer_id
        and om.user_id = auth.uid()
        and om.is_active = true
    )
  );

create policy organizer_analytics_insert_system on public.organizer_analytics
  for insert with check (false); -- Only via security definer functions

create policy organizer_analytics_update_system on public.organizer_analytics
  for update using (false) with check (false);

-- 18. Create RLS policies for organizer_api_keys
-- API keys: organizer admin/owner only

create policy organizer_api_keys_select_admin on public.organizer_api_keys
  for select using (
    exists (
      select 1 from public.organizer_members om
      where om.organizer_id = organizer_api_keys.organizer_id
        and om.user_id = auth.uid()
        and om.is_active = true
        and om.role in ('owner', 'admin')
    )
  );

create policy organizer_api_keys_insert_admin on public.organizer_api_keys
  for insert with check (
    exists (
      select 1 from public.organizer_members om
      where om.organizer_id = organizer_api_keys.organizer_id
        and om.user_id = auth.uid()
        and om.is_active = true
        and om.role in ('owner', 'admin')
    )
  );

create policy organizer_api_keys_update_admin on public.organizer_api_keys
  for update using (
    exists (
      select 1 from public.organizer_members om
      where om.organizer_id = organizer_api_keys.organizer_id
        and om.user_id = auth.uid()
        and om.is_active = true
        and om.role in ('owner', 'admin')
    )
  ) with check (
    exists (
      select 1 from public.organizer_members om
      where om.organizer_id = organizer_api_keys.organizer_id
        and om.user_id = auth.uid()
        and om.is_active = true
        and om.role in ('owner', 'admin')
    )
  );

create policy organizer_api_keys_delete_admin on public.organizer_api_keys
  for delete using (
    exists (
      select 1 from public.organizer_members om
      where om.organizer_id = organizer_api_keys.organizer_id
        and om.user_id = auth.uid()
        and om.is_active = true
        and om.role in ('owner', 'admin')
    )
  );

-- 19. Create trigger functions

-- Function to auto-update quota_resets_at when tier changes
create or replace function public.update_organizer_quota_reset()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Set quota_resets_at to first of next month if not set
  if new.quota_resets_at is null then
    new.quota_resets_at := date_trunc('month', now() + interval '1 month');
  end if;
  return new;
end;
$$;

-- Function to auto-update joined_at when member accepts invite
create or replace function public.update_organizer_member_joined()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Set joined_at when role changes from pending state (invited_at set but joined_at null)
  if old.joined_at is null and new.joined_at is null then
    new.joined_at := now();
  end if;
  return new;
end;
$$;

-- Function to update current_participants count on registration change
create or replace function public.update_event_participant_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Update current_participants on organizer_events
  if tg_op = 'INSERT' then
    update public.organizer_events
    set current_participants = current_participants + 1
    where id = new.event_id;
  elsif tg_op = 'DELETE' then
    update public.organizer_events
    set current_participants = current_participants - 1
    where id = old.event_id;
  elsif tg_op = 'UPDATE' and old.status != 'cancelled' and new.status = 'cancelled' then
    update public.organizer_events
    set current_participants = current_participants - 1
    where id = new.event_id;
  elsif tg_op = 'UPDATE' and old.status = 'cancelled' and new.status != 'cancelled' then
    update public.organizer_events
    set current_participants = current_participants + 1
    where id = new.event_id;
  end if;
  return coalesce(new, old);
end;
$$;

-- 20. Add updated_at triggers for all new tables

-- Get or create set_updated_at function
do $$
begin
  if not exists (
    select 1 from pg_proc
    where proname = 'set_updated_at'
      and pronamespace = 'public'::regnamespace
  ) then
    create or replace function public.set_updated_at()
    returns trigger
    language plpgsql
    security definer
    set search_path = public
    as $func$
    begin
      new.updated_at = now();
      return new;
    end;
    $func$;
  end if;
end $$;

-- Apply triggers

create trigger trg_organizer_accounts_updated_at
  before update on public.organizer_accounts
  for each row
  execute function public.set_updated_at();

create trigger trg_organizer_accounts_quota_reset
  before insert on public.organizer_accounts
  for each row
  execute function public.update_organizer_quota_reset();

create trigger trg_organizer_members_updated_at
  before update on public.organizer_members
  for each row
  execute function public.set_updated_at();

create trigger trg_organizer_members_joined
  before update on public.organizer_members
  for each row
  execute function public.update_organizer_member_joined();

create trigger trg_organizer_events_updated_at
  before update on public.organizer_events
  for each row
  execute function public.set_updated_at();

create trigger trg_organizer_registrations_updated_at
  before update on public.organizer_event_registrations
  for each row
  execute function public.set_updated_at();

create trigger trg_organizer_registrations_participant_count
  after insert or delete or update of status on public.organizer_event_registrations
  for each row
  execute function public.update_event_participant_count();

create trigger trg_organizer_invites_updated_at
  before update on public.organizer_invites
  for each row
  execute function public.set_updated_at();

create trigger trg_organizer_analytics_updated_at
  before update on public.organizer_analytics
  for each row
  execute function public.set_updated_at();

create trigger trg_organizer_api_keys_updated_at
  before update on public.organizer_api_keys
  for each row
  execute function public.set_updated_at();

-- 21. Add realtime publication for new tables
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.organizer_accounts;
    alter publication supabase_realtime add table public.organizer_members;
    alter publication supabase_realtime add table public.organizer_events;
    alter publication supabase_realtime add table public.organizer_event_registrations;
    alter publication supabase_realtime add table public.organizer_invites;
    alter publication supabase_realtime add table public.organizer_analytics;
    alter publication supabase_realtime add table public.organizer_api_keys;
  end if;
end $$;

-- 22. Create helper function to check if user can create events for organizer
create or replace function public.can_create_organizer_event(p_organizer_id uuid, p_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_member record;
  v_organizer record;
begin
  -- Get member info
  select * into v_member
  from public.organizer_members
  where organizer_id = p_organizer_id
    and user_id = p_user_id
    and is_active = true;

  if v_member is null then
    return false;
  end if;

  -- Check role permissions
  if v_member.role not in ('owner', 'admin', 'manager') then
    return false;
  end if;

  -- Get organizer info
  select * into v_organizer
  from public.organizer_accounts
  where id = p_organizer_id;

  if v_organizer is null or not v_organizer.is_active then
    return false;
  end if;

  -- Check quota
  if v_organizer.tier = 'bronze' and v_organizer.monthly_event_quota is not null then
    if v_organizer.events_used_this_month >= v_organizer.monthly_event_quota then
      return false;
    end if;
  end if;

  return true;
end;
$$;

-- 23. Create function to increment event usage (call after creating event)
create or replace function public.increment_organizer_event_usage(p_organizer_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.organizer_accounts
  set events_used_this_month = events_used_this_month + 1
  where id = p_organizer_id
    and tier = 'bronze'
    and monthly_event_quota is not null;
end;
$$;

-- 24. Create function to reset monthly quotas (call via cron/job)
create or replace function public.reset_organizer_monthly_quotas()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.organizer_accounts
  set events_used_this_month = 0,
      quota_resets_at = date_trunc('month', now() + interval '1 month')
  where quota_resets_at <= now()
    and tier = 'bronze';
end;
$$;

-- ============================================
-- DOWN MIGRATION (rollback)
-- ============================================
/*
-- Remove triggers
drop trigger if exists trg_organizer_api_keys_updated_at on public.organizer_api_keys;
drop trigger if exists trg_organizer_analytics_updated_at on public.organizer_analytics;
drop trigger if exists trg_organizer_invites_updated_at on public.organizer_invites;
drop trigger if exists trg_organizer_registrations_participant_count on public.organizer_event_registrations;
drop trigger if exists trg_organizer_registrations_updated_at on public.organizer_event_registrations;
drop trigger if exists trg_organizer_events_updated_at on public.organizer_events;
drop trigger if exists trg_organizer_members_joined on public.organizer_members;
drop trigger if exists trg_organizer_members_updated_at on public.organizer_members;
drop trigger if exists trg_organizer_accounts_quota_reset on public.organizer_accounts;
drop trigger if exists trg_organizer_accounts_updated_at on public.organizer_accounts;

-- Remove functions
drop function if exists public.reset_organizer_monthly_quotas();
drop function if exists public.increment_organizer_event_usage(uuid);
drop function if exists public.can_create_organizer_event(uuid, uuid);
drop function if exists public.update_event_participant_count();
drop function if exists public.update_organizer_member_joined();
drop function if exists public.update_organizer_quota_reset();

-- Remove RLS policies
-- organizer_accounts
drop policy if exists organizer_accounts_select_staff on public.organizer_accounts;
drop policy if exists organizer_accounts_update_staff on public.organizer_accounts;
drop policy if exists organizer_accounts_delete_owner on public.organizer_accounts;

-- organizer_members
drop policy if exists organizer_members_select_staff on public.organizer_members;
drop policy if exists organizer_members_insert_admin on public.organizer_members;
drop policy if exists organizer_members_update_admin on public.organizer_members;
drop policy if exists organizer_members_update_self on public.organizer_members;

-- organizer_events
drop policy if exists organizer_events_select_visible on public.organizer_events;
drop policy if exists organizer_events_insert_staff on public.organizer_events;
drop policy if exists organizer_events_update_staff on public.organizer_events;
drop policy if exists organizer_events_delete_admin on public.organizer_events;

-- organizer_event_registrations
drop policy if exists organizer_registrations_select_own on public.organizer_event_registrations;
drop policy if exists organizer_registrations_insert_self on public.organizer_event_registrations;
drop policy if exists organizer_registrations_update_staff on public.organizer_event_registrations;
drop policy if exists organizer_registrations_cancel_self on public.organizer_event_registrations;

-- organizer_invites
drop policy if exists organizer_invites_select_staff on public.organizer_invites;
drop policy if exists organizer_invites_insert_staff on public.organizer_invites;
drop policy if exists organizer_invites_update_staff on public.organizer_invites;
drop policy if exists organizer_invites_update_recipient on public.organizer_invites;

-- organizer_analytics
drop policy if exists organizer_analytics_select_staff on public.organizer_analytics;
drop policy if exists organizer_analytics_insert_system on public.organizer_analytics;
drop policy if exists organizer_analytics_update_system on public.organizer_analytics;

-- organizer_api_keys
drop policy if exists organizer_api_keys_select_admin on public.organizer_api_keys;
drop policy if exists organizer_api_keys_insert_admin on public.organizer_api_keys;
drop policy if exists organizer_api_keys_update_admin on public.organizer_api_keys;
drop policy if exists organizer_api_keys_delete_admin on public.organizer_api_keys;

-- Disable RLS
alter table public.organizer_accounts disable row level security;
alter table public.organizer_members disable row level security;
alter table public.organizer_events disable row level security;
alter table public.organizer_event_registrations disable row level security;
alter table public.organizer_invites disable row level security;
alter table public.organizer_analytics disable row level security;
alter table public.organizer_api_keys disable row level security;

-- Remove realtime publication
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime drop table public.organizer_accounts;
    alter publication supabase_realtime drop table public.organizer_members;
    alter publication supabase_realtime drop table public.organizer_events;
    alter publication supabase_realtime drop table public.organizer_event_registrations;
    alter publication supabase_realtime drop table public.organizer_invites;
    alter publication supabase_realtime drop table public.organizer_analytics;
    alter publication supabase_realtime drop table public.organizer_api_keys;
  end if;
end $$;

-- Remove indexes
drop index if exists idx_golf_courses_organizer;
drop index if exists idx_organizer_api_keys_active;
drop index if exists idx_organizer_api_keys_hash;
drop index if exists idx_organizer_api_keys_organizer;
drop index if exists idx_organizer_analytics_metric;
drop index if exists idx_organizer_analytics_event;
drop index if exists idx_organizer_analytics_organizer;
drop index if exists idx_organizer_invites_recipient;
drop index if exists idx_organizer_invites_status;
drop index if exists idx_organizer_invites_organizer;
drop index if exists idx_organizer_registrations_status;
drop index if exists idx_organizer_registrations_user;
drop index if exists idx_organizer_registrations_event;
drop index if exists idx_organizer_events_visibility;
drop index if exists idx_organizer_events_course;
drop index if exists idx_organizer_events_date;
drop index if exists idx_organizer_events_status;
drop index if exists idx_organizer_events_organizer;
drop index if exists idx_organizer_members_role;
drop index if exists idx_organizer_members_user;
drop index if exists idx_organizer_members_organizer;
drop index if exists idx_organizer_accounts_active;
drop index if exists idx_organizer_accounts_tier;
drop index if exists idx_organizer_accounts_slug;

-- Update membership_tiers constraint
alter table public.membership_tiers
  drop constraint if exists valid_features;

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

-- Remove column from golf_courses
alter table public.golf_courses
  drop column if exists organizer_id;

-- Drop tables
drop table if exists public.organizer_api_keys;
drop table if exists public.organizer_analytics;
drop table if exists public.organizer_invites;
drop table if exists public.organizer_event_registrations;
drop table if exists public.organizer_events;
drop table if exists public.organizer_members;
drop table if exists public.organizer_accounts;

-- Drop enum types
drop type if exists public.organizer_metric_type;
drop type if exists public.organizer_invite_status;
drop type if exists public.organizer_payment_status;
drop type if exists public.organizer_registration_status;
drop type if exists public.organizer_event_status;
drop type if exists public.organizer_event_type;
drop type if exists public.organizer_role;
drop type if exists public.organizer_tier;
*/

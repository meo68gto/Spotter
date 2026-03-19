-- Push Notification Infrastructure
-- Migration: 0019_push_notifications.sql

create type public.notification_type as enum (
  'round_invitation',
  'round_reminder',
  'trust_update',
  'reputation_update',
  'event_registration',
  'message',
  'connection_request',
  'session_reminder',
  'general'
);

-- Push tokens table: stores device tokens per user
-- One user can have multiple tokens (multiple devices)
create table if not exists public.push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  token text not null,
  platform text not null check (platform in ('ios', 'android', 'web')),
  app_version text,
  device_info jsonb default '{}'::jsonb,
  is_active boolean not null default true,
  last_used_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, token)
);

-- User notification preferences per type
create table if not exists public.user_notification_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  notification_type public.notification_type not null,
  push_enabled boolean not null default true,
  email_enabled boolean not null default true,
  sms_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, notification_type)
);

-- Notification delivery log for history
create table if not exists public.notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  notification_type public.notification_type not null,
  title text not null,
  body text not null,
  data jsonb default '{}'::jsonb,
  channel text not null check (channel in ('push', 'email', 'sms')),
  status text not null check (status in ('pending', 'sent', 'delivered', 'failed', 'bounced')),
  error_message text,
  provider_response jsonb,
  sent_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz not null default now()
);

-- Indexes for performance
create index if not exists idx_push_tokens_user_active on public.push_tokens(user_id, is_active);
create index if not exists idx_push_tokens_token on public.push_tokens(token);
create index if not exists idx_user_notification_settings_user on public.user_notification_settings(user_id);
create index if not exists idx_notification_deliveries_user_created on public.notification_deliveries(user_id, created_at desc);
create index if not exists idx_notification_deliveries_status on public.notification_deliveries(status, created_at desc);

-- Enable RLS
alter table public.push_tokens enable row level security;
alter table public.user_notification_settings enable row level security;
alter table public.notification_deliveries enable row level security;

-- RLS Policies

-- Push tokens: users can only see/manage their own tokens
create policy push_tokens_select_own on public.push_tokens
  for select using (auth.uid() = user_id);

create policy push_tokens_insert_own on public.push_tokens
  for insert with check (auth.uid() = user_id);

create policy push_tokens_update_own on public.push_tokens
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy push_tokens_delete_own on public.push_tokens
  for delete using (auth.uid() = user_id);

-- Notification settings: users can only manage their own
create policy user_notification_settings_select_own on public.user_notification_settings
  for select using (auth.uid() = user_id);

create policy user_notification_settings_insert_own on public.user_notification_settings
  for insert with check (auth.uid() = user_id);

create policy user_notification_settings_update_own on public.user_notification_settings
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy user_notification_settings_delete_own on public.user_notification_settings
  for delete using (auth.uid() = user_id);

-- Delivery history: users can only see their own
create policy notification_deliveries_select_own on public.notification_deliveries
  for select using (auth.uid() = user_id);

-- Triggers for updated_at
create trigger trg_push_tokens_updated_at
  before update on public.push_tokens
  for each row execute function public.set_updated_at();

create trigger trg_user_notification_settings_updated_at
  before update on public.user_notification_settings
  for each row execute function public.set_updated_at();

-- Function to deactivate old tokens (cleanup job)
create or replace function public.deactivate_stale_push_tokens(p_days integer default 30)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  update public.push_tokens
  set is_active = false
  where is_active = true
    and last_used_at < now() - (p_days || ' days')::interval;
  
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- Function to upsert push token (handles re-registration)
create or replace function public.upsert_push_token(
  p_user_id uuid,
  p_token text,
  p_platform text,
  p_app_version text default null,
  p_device_info jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token_id uuid;
begin
  insert into public.push_tokens (
    user_id,
    token,
    platform,
    app_version,
    device_info,
    is_active,
    last_used_at
  )
  values (
    p_user_id,
    p_token,
    p_platform,
    p_app_version,
    p_device_info,
    true,
    now()
  )
  on conflict (user_id, token)
  do update set
    is_active = true,
    last_used_at = now(),
    app_version = excluded.app_version,
    device_info = excluded.device_info,
    updated_at = now()
  returning id into v_token_id;
  
  return v_token_id;
end;
$$;

-- Function to initialize default notification settings for new users
create or replace function public.initialize_user_notification_settings(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_notification_settings (
    user_id,
    notification_type,
    push_enabled,
    email_enabled
  )
  select
    p_user_id,
    unnest(enum_range(null::public.notification_type)),
    true,
    true
  on conflict (user_id, notification_type) do nothing;
end;
$$;

-- Trigger to auto-initialize settings on user creation
create or replace function public.on_user_created_initialize_notifications()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.initialize_user_notification_settings(new.id);
  return new;
end;
$$;

create trigger trg_users_initialize_notification_settings
  after insert on public.users
  for each row execute function public.on_user_created_initialize_notifications();

-- Add realtime for notification deliveries
alter publication supabase_realtime add table public.notification_deliveries;

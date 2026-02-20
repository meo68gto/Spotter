create type public.engagement_mode as enum ('text_answer', 'video_answer', 'video_call');
create type public.engagement_status as enum (
  'created',
  'awaiting_expert',
  'accepted',
  'declined',
  'expired',
  'in_progress',
  'completed',
  'cancelled',
  'refunded'
);
create type public.moderation_status as enum ('pending', 'approved', 'rejected');

create table if not exists public.expert_profiles (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null unique references public.coaches(id) on delete cascade,
  headline text,
  bio text,
  is_dnd boolean not null default false,
  discoverable boolean not null default true,
  avg_response_minutes integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.expert_pricing (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.coaches(id) on delete cascade,
  engagement_mode public.engagement_mode not null,
  currency text not null default 'usd',
  price_cents integer not null default 0,
  per_minute_rate_cents integer,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(coach_id, engagement_mode)
);

create table if not exists public.engagement_requests (
  id uuid primary key default gen_random_uuid(),
  requester_user_id uuid references public.users(id) on delete set null,
  guest_checkout_session_id uuid,
  coach_id uuid not null references public.coaches(id) on delete cascade,
  engagement_mode public.engagement_mode not null,
  question_text text not null,
  attachment_urls jsonb not null default '[]'::jsonb,
  scheduled_time timestamptz,
  status public.engagement_status not null default 'awaiting_expert',
  expires_at timestamptz not null,
  accepted_at timestamptz,
  completed_at timestamptz,
  public_opt_in boolean not null default false,
  moderation_status public.moderation_status not null default 'pending',
  review_order_id uuid references public.review_orders(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (requester_user_id is not null or guest_checkout_session_id is not null)
);

create table if not exists public.engagement_responses (
  id uuid primary key default gen_random_uuid(),
  engagement_request_id uuid not null unique references public.engagement_requests(id) on delete cascade,
  coach_id uuid not null references public.coaches(id) on delete cascade,
  response_text text,
  audio_url text,
  video_url text,
  transcript text,
  submitted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.guest_checkout_sessions (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  verification_token_hash text not null,
  expires_at timestamptz not null,
  converted_user_id uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  verified_at timestamptz,
  unique (email, verification_token_hash)
);

alter table public.engagement_requests
  add constraint engagement_requests_guest_checkout_fk
  foreign key (guest_checkout_session_id) references public.guest_checkout_sessions(id) on delete set null;

create table if not exists public.video_call_sessions (
  id uuid primary key default gen_random_uuid(),
  engagement_request_id uuid not null unique references public.engagement_requests(id) on delete cascade,
  daily_room_name text not null,
  host_token text not null,
  guest_token text not null,
  started_at timestamptz,
  ended_at timestamptz,
  duration_seconds integer,
  billable_minutes integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.home_feed_items (
  id uuid primary key default gen_random_uuid(),
  engagement_request_id uuid not null unique references public.engagement_requests(id) on delete cascade,
  score numeric(8,3) not null default 0,
  published_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.reschedule_requests (
  id uuid primary key default gen_random_uuid(),
  engagement_request_id uuid not null references public.engagement_requests(id) on delete cascade,
  proposed_time timestamptz not null,
  requested_by_user_id uuid not null references public.users(id) on delete cascade,
  status text not null default 'pending',
  declined_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.review_orders
  alter column video_submission_id drop not null,
  add column if not exists engagement_request_id uuid references public.engagement_requests(id) on delete set null,
  add column if not exists authorization_expires_at timestamptz,
  add column if not exists authorization_released_at timestamptz;

create index if not exists idx_expert_profiles_coach on public.expert_profiles(coach_id);
create index if not exists idx_expert_profiles_discoverable on public.expert_profiles(discoverable, is_dnd);
create index if not exists idx_expert_pricing_mode on public.expert_pricing(engagement_mode, active);
create index if not exists idx_engagement_requests_status_expires on public.engagement_requests(status, expires_at);
create index if not exists idx_engagement_requests_coach_status on public.engagement_requests(coach_id, status, created_at desc);
create index if not exists idx_engagement_requests_requester_status on public.engagement_requests(requester_user_id, status, created_at desc);
create index if not exists idx_guest_checkout_expires on public.guest_checkout_sessions(expires_at);
create index if not exists idx_home_feed_published on public.home_feed_items(published_at desc, score desc);
create index if not exists idx_reschedule_status on public.reschedule_requests(engagement_request_id, status, created_at desc);
create index if not exists idx_review_orders_auth_expires on public.review_orders(status, authorization_expires_at);

alter table public.expert_profiles enable row level security;
alter table public.expert_pricing enable row level security;
alter table public.engagement_requests enable row level security;
alter table public.engagement_responses enable row level security;
alter table public.guest_checkout_sessions enable row level security;
alter table public.video_call_sessions enable row level security;
alter table public.home_feed_items enable row level security;
alter table public.reschedule_requests enable row level security;

create policy expert_profiles_select_public on public.expert_profiles
  for select using (discoverable = true);
create policy expert_profiles_insert_owner on public.expert_profiles
  for insert with check (exists (select 1 from public.coaches c where c.id = coach_id and c.user_id = auth.uid()));
create policy expert_profiles_update_owner on public.expert_profiles
  for update using (exists (select 1 from public.coaches c where c.id = coach_id and c.user_id = auth.uid()))
  with check (exists (select 1 from public.coaches c where c.id = coach_id and c.user_id = auth.uid()));

create policy expert_pricing_select_public on public.expert_pricing
  for select using (active = true);
create policy expert_pricing_write_owner on public.expert_pricing
  for all using (exists (select 1 from public.coaches c where c.id = coach_id and c.user_id = auth.uid()))
  with check (exists (select 1 from public.coaches c where c.id = coach_id and c.user_id = auth.uid()));

create policy engagement_requests_select_participants on public.engagement_requests
  for select using (
    requester_user_id = auth.uid()
    or exists (select 1 from public.coaches c where c.id = coach_id and c.user_id = auth.uid())
  );
create policy engagement_requests_insert_requester on public.engagement_requests
  for insert with check (requester_user_id = auth.uid());
create policy engagement_requests_update_participants on public.engagement_requests
  for update using (
    requester_user_id = auth.uid()
    or exists (select 1 from public.coaches c where c.id = coach_id and c.user_id = auth.uid())
  )
  with check (
    requester_user_id = auth.uid()
    or exists (select 1 from public.coaches c where c.id = coach_id and c.user_id = auth.uid())
  );

create policy engagement_responses_select_participants on public.engagement_responses
  for select using (
    exists (
      select 1 from public.engagement_requests er
      where er.id = engagement_request_id
        and (
          er.requester_user_id = auth.uid()
          or exists (select 1 from public.coaches c where c.id = coach_id and c.user_id = auth.uid())
        )
    )
  );
create policy engagement_responses_write_owner on public.engagement_responses
  for all using (exists (select 1 from public.coaches c where c.id = coach_id and c.user_id = auth.uid()))
  with check (exists (select 1 from public.coaches c where c.id = coach_id and c.user_id = auth.uid()));

create policy guest_checkout_sessions_select_none on public.guest_checkout_sessions
  for select using (false);
create policy guest_checkout_sessions_insert_none on public.guest_checkout_sessions
  for insert with check (false);
create policy guest_checkout_sessions_update_none on public.guest_checkout_sessions
  for update using (false) with check (false);

create policy video_call_sessions_select_participants on public.video_call_sessions
  for select using (
    exists (
      select 1 from public.engagement_requests er
      where er.id = engagement_request_id
        and (
          er.requester_user_id = auth.uid()
          or exists (select 1 from public.coaches c where c.id = er.coach_id and c.user_id = auth.uid())
        )
    )
  );
create policy video_call_sessions_write_participants on public.video_call_sessions
  for all using (
    exists (
      select 1 from public.engagement_requests er
      where er.id = engagement_request_id
        and (
          er.requester_user_id = auth.uid()
          or exists (select 1 from public.coaches c where c.id = er.coach_id and c.user_id = auth.uid())
        )
    )
  )
  with check (
    exists (
      select 1 from public.engagement_requests er
      where er.id = engagement_request_id
        and (
          er.requester_user_id = auth.uid()
          or exists (select 1 from public.coaches c where c.id = er.coach_id and c.user_id = auth.uid())
        )
    )
  );

create policy home_feed_items_select_public on public.home_feed_items
  for select using (
    exists (
      select 1 from public.engagement_requests er
      where er.id = engagement_request_id
        and er.public_opt_in = true
        and er.moderation_status = 'approved'
        and er.status in ('completed', 'accepted')
    )
  );
create policy home_feed_items_write_none on public.home_feed_items
  for all using (false) with check (false);

create policy reschedule_requests_select_participants on public.reschedule_requests
  for select using (
    exists (
      select 1 from public.engagement_requests er
      where er.id = engagement_request_id
        and (
          er.requester_user_id = auth.uid()
          or exists (select 1 from public.coaches c where c.id = er.coach_id and c.user_id = auth.uid())
        )
    )
  );
create policy reschedule_requests_insert_participant on public.reschedule_requests
  for insert with check (
    requested_by_user_id = auth.uid()
    and exists (
      select 1 from public.engagement_requests er
      where er.id = engagement_request_id
        and (
          er.requester_user_id = auth.uid()
          or exists (select 1 from public.coaches c where c.id = er.coach_id and c.user_id = auth.uid())
        )
    )
  );
create policy reschedule_requests_update_participant on public.reschedule_requests
  for update using (
    exists (
      select 1 from public.engagement_requests er
      where er.id = engagement_request_id
        and (
          er.requester_user_id = auth.uid()
          or exists (select 1 from public.coaches c where c.id = er.coach_id and c.user_id = auth.uid())
        )
    )
  )
  with check (
    exists (
      select 1 from public.engagement_requests er
      where er.id = engagement_request_id
        and (
          er.requester_user_id = auth.uid()
          or exists (select 1 from public.coaches c where c.id = er.coach_id and c.user_id = auth.uid())
        )
    )
  );

create trigger trg_expert_profiles_updated_at
before update on public.expert_profiles
for each row execute function public.set_updated_at();

create trigger trg_expert_pricing_updated_at
before update on public.expert_pricing
for each row execute function public.set_updated_at();

create trigger trg_engagement_requests_updated_at
before update on public.engagement_requests
for each row execute function public.set_updated_at();

create trigger trg_engagement_responses_updated_at
before update on public.engagement_responses
for each row execute function public.set_updated_at();

create trigger trg_video_call_sessions_updated_at
before update on public.video_call_sessions
for each row execute function public.set_updated_at();

create trigger trg_reschedule_requests_updated_at
before update on public.reschedule_requests
for each row execute function public.set_updated_at();

create or replace function public.expire_pending_engagement_requests()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  update public.engagement_requests
  set status = 'expired', updated_at = now()
  where status in ('awaiting_expert', 'created')
    and expires_at <= now();

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

insert into public.feature_flags (key, environment, value)
values
  ('engagement_async_answers', 'local', true),
  ('engagement_guest_checkout', 'local', true),
  ('engagement_public_feed', 'local', true),
  ('engagement_video_call_daily', 'local', true)
on conflict (key, environment) do nothing;

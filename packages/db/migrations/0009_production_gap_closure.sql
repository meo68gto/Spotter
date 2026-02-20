create type public.review_order_status as enum (
  'created',
  'requires_payment_method',
  'processing',
  'paid',
  'failed',
  'refunded',
  'cancelled'
);

create table if not exists public.coaches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.users(id) on delete cascade,
  stripe_account_id text unique,
  onboarding_status text not null default 'not_started',
  specialties text[] not null default '{}',
  rating_avg numeric(4,2),
  rating_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.coach_review_products (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.coaches(id) on delete cascade,
  activity_id uuid references public.activities(id) on delete set null,
  title text not null,
  description text,
  duration_minutes integer not null check (duration_minutes > 0),
  currency text not null default 'usd',
  price_cents integer not null check (price_cents > 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.review_orders (
  id uuid primary key default gen_random_uuid(),
  buyer_user_id uuid not null references public.users(id) on delete cascade,
  coach_id uuid not null references public.coaches(id) on delete cascade,
  coach_review_product_id uuid references public.coach_review_products(id) on delete set null,
  video_submission_id uuid not null references public.video_submissions(id) on delete cascade,
  amount_cents integer not null check (amount_cents > 0),
  currency text not null default 'usd',
  platform_fee_bps integer not null check (platform_fee_bps between 0 and 10000),
  platform_fee_cents integer not null check (platform_fee_cents >= 0),
  coach_payout_cents integer not null check (coach_payout_cents >= 0),
  stripe_payment_intent_id text,
  status public.review_order_status not null default 'created',
  metadata jsonb not null default '{}'::jsonb,
  paid_at timestamptz,
  refunded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.payment_events (
  id uuid primary key default gen_random_uuid(),
  stripe_event_id text not null unique,
  event_type text not null,
  payload jsonb not null,
  processed_at timestamptz not null default now()
);

create table if not exists public.refund_requests (
  id uuid primary key default gen_random_uuid(),
  review_order_id uuid not null references public.review_orders(id) on delete cascade,
  requester_user_id uuid not null references public.users(id) on delete cascade,
  reason text,
  status text not null default 'pending',
  stripe_refund_id text,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.notification_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete set null,
  event_type text not null,
  channel text not null,
  provider text not null,
  provider_message_id text,
  status text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.user_legal_consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  tos_version text not null,
  privacy_version text not null,
  cookie_version text not null,
  locale text,
  accepted_at timestamptz not null default now()
);

create index if not exists idx_coaches_user on public.coaches(user_id);
create index if not exists idx_coach_review_products_coach_active on public.coach_review_products(coach_id, active);
create index if not exists idx_review_orders_status_created_at on public.review_orders(status, created_at desc);
create index if not exists idx_review_orders_coach_created_at on public.review_orders(coach_id, created_at desc);
create index if not exists idx_review_orders_buyer_created_at on public.review_orders(buyer_user_id, created_at desc);
create unique index if not exists idx_review_orders_unique_video_coach on public.review_orders(video_submission_id, coach_id)
  where status in ('created', 'requires_payment_method', 'processing', 'paid');
create index if not exists idx_refund_requests_order_status on public.refund_requests(review_order_id, status);
create index if not exists idx_notification_events_user_created on public.notification_events(user_id, created_at desc);
create index if not exists idx_user_legal_consents_user_accepted on public.user_legal_consents(user_id, accepted_at desc);

alter table public.coaches enable row level security;
alter table public.coach_review_products enable row level security;
alter table public.review_orders enable row level security;
alter table public.payment_events enable row level security;
alter table public.refund_requests enable row level security;
alter table public.notification_events enable row level security;
alter table public.user_legal_consents enable row level security;

create policy coaches_select_public on public.coaches
  for select using (true);
create policy coaches_insert_self on public.coaches
  for insert with check (auth.uid() = user_id);
create policy coaches_update_self on public.coaches
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy coach_review_products_select_public on public.coach_review_products
  for select using (active = true or exists (
    select 1 from public.coaches c where c.id = coach_id and c.user_id = auth.uid()
  ));
create policy coach_review_products_write_owner on public.coach_review_products
  for all using (exists (
    select 1 from public.coaches c where c.id = coach_id and c.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.coaches c where c.id = coach_id and c.user_id = auth.uid()
  ));

create policy review_orders_select_participants on public.review_orders
  for select using (
    auth.uid() = buyer_user_id
    or exists (select 1 from public.coaches c where c.id = coach_id and c.user_id = auth.uid())
  );
create policy review_orders_insert_buyer on public.review_orders
  for insert with check (auth.uid() = buyer_user_id);
create policy review_orders_update_participants on public.review_orders
  for update using (
    auth.uid() = buyer_user_id
    or exists (select 1 from public.coaches c where c.id = coach_id and c.user_id = auth.uid())
  ) with check (
    auth.uid() = buyer_user_id
    or exists (select 1 from public.coaches c where c.id = coach_id and c.user_id = auth.uid())
  );

create policy refund_requests_select_participants on public.refund_requests
  for select using (
    auth.uid() = requester_user_id
    or exists (
      select 1
      from public.review_orders ro
      join public.coaches c on c.id = ro.coach_id
      where ro.id = review_order_id and c.user_id = auth.uid()
    )
  );
create policy refund_requests_insert_requester on public.refund_requests
  for insert with check (auth.uid() = requester_user_id);

create policy user_legal_consents_select_own on public.user_legal_consents
  for select using (auth.uid() = user_id);
create policy user_legal_consents_insert_own on public.user_legal_consents
  for insert with check (auth.uid() = user_id);

create policy notification_events_select_own on public.notification_events
  for select using (auth.uid() = user_id);

create trigger trg_coaches_updated_at
before update on public.coaches
for each row execute function public.set_updated_at();

create trigger trg_coach_review_products_updated_at
before update on public.coach_review_products
for each row execute function public.set_updated_at();

create trigger trg_review_orders_updated_at
before update on public.review_orders
for each row execute function public.set_updated_at();

create trigger trg_refund_requests_updated_at
before update on public.refund_requests
for each row execute function public.set_updated_at();

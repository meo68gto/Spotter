create type public.coach_service_type as enum ('video_review', 'live_video_call', 'swing_plan', 'text_qna');

alter type public.engagement_status add value if not exists 'draft';
alter type public.engagement_status add value if not exists 'payment_pending';
alter type public.engagement_status add value if not exists 'paid';
alter type public.engagement_status add value if not exists 'queued';
alter type public.engagement_status add value if not exists 'reschedule_pending';
alter type public.engagement_status add value if not exists 'in_review';
alter type public.engagement_status add value if not exists 'scheduled';
alter type public.engagement_status add value if not exists 'in_call';
alter type public.engagement_status add value if not exists 'delivered';
alter type public.engagement_status add value if not exists 'refund_pending';

create table if not exists public.coach_services (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.coaches(id) on delete cascade,
  service_type public.coach_service_type not null,
  title text not null,
  description text,
  price_cents integer not null check (price_cents > 0),
  currency text not null default 'usd',
  turnaround_hours integer,
  duration_minutes integer,
  requires_video boolean not null default false,
  requires_schedule boolean not null default false,
  active boolean not null default true,
  sort_order integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.engagement_assets (
  id uuid primary key default gen_random_uuid(),
  engagement_request_id uuid not null references public.engagement_requests(id) on delete cascade,
  asset_type text not null,
  video_submission_id uuid references public.video_submissions(id) on delete set null,
  storage_path text,
  role text not null default 'primary',
  sort_order integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (asset_type in ('video_submission', 'response_video', 'response_audio', 'attachment'))
);

create table if not exists public.engagement_status_events (
  id uuid primary key default gen_random_uuid(),
  engagement_request_id uuid not null references public.engagement_requests(id) on delete cascade,
  event_type text not null,
  from_status text,
  to_status text,
  actor_user_id uuid references public.users(id) on delete set null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.engagement_requests
  add column if not exists coach_service_id uuid references public.coach_services(id) on delete set null,
  add column if not exists source_surface text,
  add column if not exists source_match_id uuid references public.matches(id) on delete set null,
  add column if not exists source_intro_request_id uuid references public.introduction_requests(id) on delete set null,
  add column if not exists source_connection_user_id uuid references public.users(id) on delete set null,
  add column if not exists buyer_note text,
  add column if not exists request_details jsonb not null default '{}'::jsonb,
  add column if not exists paid_at timestamptz,
  add column if not exists accepted_deadline_at timestamptz,
  add column if not exists delivery_deadline_at timestamptz,
  add column if not exists delivered_at timestamptz,
  add column if not exists closed_reason text;

alter table public.engagement_responses
  add column if not exists response_kind text not null default 'written_feedback',
  add column if not exists summary_text text,
  add column if not exists structured_feedback jsonb not null default '{}'::jsonb,
  add column if not exists attachments jsonb not null default '[]'::jsonb,
  add column if not exists delivered_at timestamptz;

alter table public.review_orders
  add column if not exists coach_service_id uuid references public.coach_services(id) on delete set null,
  add column if not exists payout_status text not null default 'pending',
  add column if not exists refund_reason text,
  add column if not exists source_surface text;

create index if not exists idx_coach_services_coach_active on public.coach_services(coach_id, active, sort_order);
create index if not exists idx_engagement_requests_coach_queue on public.engagement_requests(coach_id, status, accepted_deadline_at, delivery_deadline_at);
create index if not exists idx_engagement_requests_requester_lifecycle on public.engagement_requests(requester_user_id, status, paid_at, created_at desc);
create index if not exists idx_engagement_assets_request on public.engagement_assets(engagement_request_id, sort_order);
create index if not exists idx_engagement_status_events_request on public.engagement_status_events(engagement_request_id, created_at desc);
create index if not exists idx_review_orders_payout_status on public.review_orders(payout_status, status, paid_at);

alter table public.coach_services enable row level security;
alter table public.engagement_assets enable row level security;
alter table public.engagement_status_events enable row level security;

create policy coach_services_select_public on public.coach_services
  for select using (active = true or exists (
    select 1 from public.coaches c where c.id = coach_id and c.user_id = auth.uid()
  ));

create policy coach_services_write_owner on public.coach_services
  for all using (exists (
    select 1 from public.coaches c where c.id = coach_id and c.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.coaches c where c.id = coach_id and c.user_id = auth.uid()
  ));

create policy engagement_assets_select_participants on public.engagement_assets
  for select using (
    exists (
      select 1
      from public.engagement_requests er
      left join public.coaches c on c.id = er.coach_id
      where er.id = engagement_request_id
        and (er.requester_user_id = auth.uid() or c.user_id = auth.uid())
    )
  );

create policy engagement_assets_write_participants on public.engagement_assets
  for all using (
    exists (
      select 1
      from public.engagement_requests er
      left join public.coaches c on c.id = er.coach_id
      where er.id = engagement_request_id
        and (er.requester_user_id = auth.uid() or c.user_id = auth.uid())
    )
  )
  with check (
    exists (
      select 1
      from public.engagement_requests er
      left join public.coaches c on c.id = er.coach_id
      where er.id = engagement_request_id
        and (er.requester_user_id = auth.uid() or c.user_id = auth.uid())
    )
  );

create policy engagement_status_events_select_participants on public.engagement_status_events
  for select using (
    exists (
      select 1
      from public.engagement_requests er
      left join public.coaches c on c.id = er.coach_id
      where er.id = engagement_request_id
        and (er.requester_user_id = auth.uid() or c.user_id = auth.uid())
    )
  );

create trigger trg_coach_services_updated_at
before update on public.coach_services
for each row execute function public.set_updated_at();

create trigger trg_engagement_assets_updated_at
before update on public.engagement_assets
for each row execute function public.set_updated_at();

insert into public.coach_services (
  coach_id,
  service_type,
  title,
  description,
  price_cents,
  currency,
  turnaround_hours,
  duration_minutes,
  requires_video,
  requires_schedule,
  active,
  sort_order,
  metadata
)
select
  ep.coach_id,
  case ep.engagement_mode
    when 'video_answer' then 'video_review'::public.coach_service_type
    when 'video_call' then 'live_video_call'::public.coach_service_type
    when 'text_answer' then 'text_qna'::public.coach_service_type
  end,
  case ep.engagement_mode
    when 'video_answer' then 'Video Review'
    when 'video_call' then 'Live Video Call'
    when 'text_answer' then 'Text Q&A'
  end,
  'Migrated from expert pricing',
  ep.price_cents,
  ep.currency,
  case when ep.engagement_mode = 'video_answer' then 48 else null end,
  case when ep.engagement_mode = 'video_call' then 60 else null end,
  ep.engagement_mode = 'video_answer',
  ep.engagement_mode = 'video_call',
  ep.active,
  case ep.engagement_mode
    when 'video_answer' then 0
    when 'video_call' then 1
    else 2
  end,
  jsonb_build_object('legacySource', 'expert_pricing')
from public.expert_pricing ep
where not exists (
  select 1
  from public.coach_services cs
  where cs.coach_id = ep.coach_id
    and cs.service_type = case ep.engagement_mode
      when 'video_answer' then 'video_review'::public.coach_service_type
      when 'video_call' then 'live_video_call'::public.coach_service_type
      when 'text_answer' then 'text_qna'::public.coach_service_type
    end
);

insert into public.coach_services (
  coach_id,
  service_type,
  title,
  description,
  price_cents,
  currency,
  turnaround_hours,
  duration_minutes,
  requires_video,
  requires_schedule,
  active,
  sort_order,
  metadata
)
select
  crp.coach_id,
  'video_review'::public.coach_service_type,
  crp.title,
  crp.description,
  crp.price_cents,
  crp.currency,
  48,
  crp.duration_minutes,
  true,
  false,
  crp.active,
  0,
  jsonb_build_object('legacySource', 'coach_review_products', 'legacyProductId', crp.id)
from public.coach_review_products crp
where not exists (
  select 1
  from public.coach_services cs
  where cs.coach_id = crp.coach_id
    and cs.title = crp.title
);

update public.engagement_requests er
set coach_service_id = cs.id
from public.coach_services cs
where er.coach_service_id is null
  and cs.coach_id = er.coach_id
  and (
    (er.engagement_mode = 'video_answer' and cs.service_type = 'video_review')
    or (er.engagement_mode = 'video_call' and cs.service_type = 'live_video_call')
    or (er.engagement_mode = 'text_answer' and cs.service_type = 'text_qna')
  );

update public.review_orders ro
set coach_service_id = er.coach_service_id
from public.engagement_requests er
where ro.engagement_request_id = er.id
  and ro.coach_service_id is null
  and er.coach_service_id is not null;

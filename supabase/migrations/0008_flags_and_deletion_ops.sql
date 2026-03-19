alter table public.user_deletion_requests enable row level security;

alter table public.user_deletion_requests
  add column if not exists processing_started_at timestamptz,
  add column if not exists failure_reason text;

create table if not exists public.deletion_audit_logs (
  id uuid primary key default gen_random_uuid(),
  deletion_request_id uuid not null references public.user_deletion_requests(id) on delete cascade,
  user_id uuid not null,
  action text not null,
  status text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_deletion_audit_logs_request on public.deletion_audit_logs(deletion_request_id, created_at desc);

alter table public.deletion_audit_logs enable row level security;

create policy deletion_audit_logs_select_own on public.deletion_audit_logs
  for select using (auth.uid() = user_id);

create policy deletion_audit_logs_insert_service on public.deletion_audit_logs
  for insert with check (true);

create table if not exists public.feature_flags (
  id uuid primary key default gen_random_uuid(),
  key text not null,
  environment text not null,
  value boolean not null,
  payload jsonb not null default '{}'::jsonb,
  updated_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (key, environment)
);

create index if not exists idx_feature_flags_environment_key on public.feature_flags(environment, key);

alter table public.feature_flags enable row level security;

create policy feature_flags_select_all_authenticated on public.feature_flags
  for select using (auth.role() = 'authenticated');

create trigger trg_feature_flags_updated_at
before update on public.feature_flags
for each row execute function public.set_updated_at();

insert into public.feature_flags (key, environment, value)
values
  ('matching_v2', 'local', false),
  ('video_pipeline', 'local', true)
on conflict (key, environment) do nothing;

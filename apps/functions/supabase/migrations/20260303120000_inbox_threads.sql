create table if not exists public.engagement_thread_messages (
  id uuid primary key default gen_random_uuid(),
  engagement_request_id uuid not null references public.engagement_requests(id) on delete cascade,
  sender_user_id uuid not null references public.users(id) on delete cascade,
  message text not null,
  client_message_id text,
  created_at timestamptz not null default now(),
  check (char_length(trim(message)) > 0)
);

create table if not exists public.inbox_thread_reads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  thread_type text not null check (thread_type in ('session', 'engagement')),
  thread_id uuid not null,
  last_read_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, thread_type, thread_id)
);

create index if not exists idx_engagement_thread_messages_request_created
  on public.engagement_thread_messages(engagement_request_id, created_at desc);

create unique index if not exists idx_engagement_thread_messages_idempotency
  on public.engagement_thread_messages(engagement_request_id, sender_user_id, client_message_id)
  where client_message_id is not null;

create index if not exists idx_inbox_thread_reads_user_type_read
  on public.inbox_thread_reads(user_id, thread_type, last_read_at desc);

alter table public.engagement_thread_messages enable row level security;
alter table public.inbox_thread_reads enable row level security;

create policy engagement_thread_messages_select_participants on public.engagement_thread_messages
  for select using (
    exists (
      select 1
      from public.engagement_requests er
      left join public.coaches c on c.id = er.coach_id
      where er.id = engagement_request_id
        and (er.requester_user_id = auth.uid() or c.user_id = auth.uid())
    )
  );

create policy engagement_thread_messages_insert_participants on public.engagement_thread_messages
  for insert with check (
    sender_user_id = auth.uid()
    and exists (
      select 1
      from public.engagement_requests er
      left join public.coaches c on c.id = er.coach_id
      where er.id = engagement_request_id
        and (er.requester_user_id = auth.uid() or c.user_id = auth.uid())
    )
  );

create policy inbox_thread_reads_select_own on public.inbox_thread_reads
  for select using (user_id = auth.uid());

create policy inbox_thread_reads_upsert_own on public.inbox_thread_reads
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

alter publication supabase_realtime add table public.engagement_thread_messages;

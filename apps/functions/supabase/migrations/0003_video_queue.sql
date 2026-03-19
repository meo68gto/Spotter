-- Video processing queue skeleton

create table if not exists public.video_processing_jobs (
  id uuid primary key default gen_random_uuid(),
  video_submission_id uuid not null references public.video_submissions(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'processing', 'completed', 'failed')),
  attempts integer not null default 0,
  max_attempts integer not null default 3,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  unique(video_submission_id)
);

create index if not exists idx_video_processing_jobs_status_created on public.video_processing_jobs(status, created_at);

alter table public.video_processing_jobs enable row level security;

create policy video_processing_jobs_select_owner on public.video_processing_jobs
  for select using (
    exists (
      select 1 from public.video_submissions vs
      where vs.id = video_submission_id and vs.user_id = auth.uid()
    )
  );

create policy video_processing_jobs_insert_owner on public.video_processing_jobs
  for insert with check (
    exists (
      select 1 from public.video_submissions vs
      where vs.id = video_submission_id and vs.user_id = auth.uid()
    )
  );

create policy video_processing_jobs_update_owner on public.video_processing_jobs
  for update using (
    exists (
      select 1 from public.video_submissions vs
      where vs.id = video_submission_id and vs.user_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from public.video_submissions vs
      where vs.id = video_submission_id and vs.user_id = auth.uid()
    )
  );

create trigger trg_video_processing_jobs_updated_at
before update on public.video_processing_jobs
for each row execute function public.set_updated_at();

alter table public.video_processing_jobs enable row level security;

alter table public.video_processing_jobs
  add column if not exists next_run_at timestamptz,
  add column if not exists last_error_code text,
  add column if not exists last_error_at timestamptz;

create index if not exists idx_video_processing_jobs_next_run
  on public.video_processing_jobs(status, next_run_at, created_at);

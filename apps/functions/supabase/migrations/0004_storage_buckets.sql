insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('videos-raw', 'videos-raw', false, 524288000, array['video/mp4', 'video/quicktime', 'video/x-m4v']),
  ('videos-processed', 'videos-processed', false, 524288000, array['video/mp4', 'video/quicktime', 'video/x-m4v'])
on conflict (id) do nothing;

alter table public.video_submissions enable row level security;

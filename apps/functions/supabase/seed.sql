insert into public.activities (slug, name, category, metadata)
values
  ('skiing', 'Skiing', 'snow', '{"scales": ["beginner", "intermediate", "advanced", "expert"]}'),
  ('golf', 'Golf', 'course', '{"scales": ["usga"]}'),
  ('tennis', 'Tennis', 'court', '{"scales": ["ntrp"]}')
on conflict (slug) do nothing;

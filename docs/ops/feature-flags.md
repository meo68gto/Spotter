# Feature Flags

## Runtime model
Feature flags are stored in `public.feature_flags` keyed by `(key, environment)` and fetched at runtime.
This enables environment rollouts without redeploy.

Supported keys:
- `matching_v2`
- `video_pipeline`

## Mobile
- Bootstrap endpoint: `POST /functions/v1/feature-flags`
- Client wrapper: `/Users/brucewayne/Documents/Spotter/apps/mobile/src/lib/flags.ts`
- Fallbacks if fetch fails:
  - `EXPO_PUBLIC_FLAG_MATCHING_V2`
  - `EXPO_PUBLIC_FLAG_VIDEO_PIPELINE`

## Functions
- Functions resolve flags from DB via `/Users/brucewayne/Documents/Spotter/apps/functions/supabase/functions/_shared/flags-db.ts`
- Fallbacks remain conservative (`matching_v2=false`, `video_pipeline=true`).
- Environment selector: `FLAG_ENVIRONMENT` (default `local`).

## Staging/prod toggle workflow
1. Set `FLAG_ENVIRONMENT` in function runtime (`staging`, `production`).
2. Upsert desired flag rows in `public.feature_flags` for that environment.
3. Verify behavior immediately (no redeploy required).

## Example SQL
```sql
insert into public.feature_flags (key, environment, value)
values
  ('matching_v2', 'staging', true),
  ('video_pipeline', 'staging', true)
on conflict (key, environment)
do update set value = excluded.value, updated_at = now();
```

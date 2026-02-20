# @spotter/db

Schema package for Spotter with migrations, seeds, and policy checks.

## Migration overview

`migrations/0001_init.sql` creates:

- `users`
- `activities`
- `skill_profiles`
- `matches`
- `sessions`
- `video_submissions`
- `coach_reviews`
- `progress_snapshots`
- `messages` (placeholder for chat/realtime)

`migrations/0002_gap_closing.sql` adds:

- `availability_slots`
- `session_feedback`
- match expiration support via `matches.expires_at`
- message idempotency/moderation fields
- upgraded matching score + availability overlap SQL helpers

## ERD (text)

- A `users` row maps 1:1 to `auth.users`
- `skill_profiles` belongs to `users` and `activities`
- `matches` links requester + candidate users around one activity
- `sessions` belongs to a `match` and links two participant users
- `video_submissions` belongs to a user and optionally a session
- `coach_reviews` belongs to a video submission and a coach user
- `progress_snapshots` belongs to a user + activity and references source submission IDs
- `messages` belongs to sessions and sender users
- `availability_slots` belongs to users and optional activity
- `session_feedback` belongs to sessions and reviewer/reviewee users

## Geospatial

- User home and session meetup points use `geography(point, 4326)`
- GIST indexes support radius and proximity queries

## RLS

- Enabled on every user-data table
- Access scoped by `auth.uid()` participant relationships
- `activities` is readable by all authenticated users

## Running checks

- `pnpm --filter @spotter/db db:check`
- `pnpm --filter @spotter/db test`

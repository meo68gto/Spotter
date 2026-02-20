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

`migrations/0009_production_gap_closure.sql` adds:

- `coaches`
- `coach_review_products`
- `review_orders`
- `payment_events`
- `refund_requests`
- `notification_events`
- `user_legal_consents`
- payment/legal indexes + RLS policies

`migrations/0010_engagements_mvp.sql` adds:

- `expert_profiles`
- `expert_pricing`
- `engagement_requests`
- `engagement_responses`
- `guest_checkout_sessions`
- `video_call_sessions`
- `home_feed_items`
- `reschedule_requests`
- engagement enums/status lifecycle
- auth-hold fields on `review_orders`

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
- `coaches` maps 1:1 from coach `users`
- `coach_review_products` belongs to a `coach`
- `review_orders` belongs to buyer user, coach, product, and video submission
- `refund_requests` belongs to review orders
- `payment_events` stores webhook idempotency
- `notification_events` stores transactional delivery receipts
- `user_legal_consents` stores legal acceptance versions

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

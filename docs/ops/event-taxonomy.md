# Event Taxonomy (PostHog)

## Mobile events
- `auth_sign_in`
- `auth_sign_up`
- `onboarding_completed`
- `match_request_created`
- `session_proposed`
- `session_confirmed`
- `session_cancelled`
- `chat_message_sent`

## Core properties
- `distinct_id` (Supabase user id)
- `activity_id` when relevant
- `session_id` or `candidate_user_id` for coordination events
- `source` fixed to `mobile`

## Usage
- Set `EXPO_PUBLIC_POSTHOG_KEY`
- Set `EXPO_PUBLIC_POSTHOG_HOST` (default PostHog cloud)

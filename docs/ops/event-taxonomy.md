# Event Taxonomy (PostHog)

## Mobile events
- `auth_sign_in`
- `auth_sign_up`
- `onboarding_completed`
- `match_request_created`
- `match_action`
- `session_proposed`
- `session_confirmed`
- `session_cancelled`
- `session_feedback_submitted`
- `chat_message_sent`
- `video_compression_attempted`
- `video_compression_fallback`
- `video_uploaded_and_queued`
- `video_upload_failed`

## Function events
- `matching_candidates_returned`
- `video_presign_created`
- `video_analysis_ingested`
- `progress_snapshot_generated`
- `deletion_request_completed`
- `deletion_request_failed`
- `payment_intent_succeeded`
- `payment_intent_failed`
- `refund_processed`
- `legal_consent_accepted`

## Core properties
- `distinct_id` (Supabase user id)
- `activity_id` when relevant
- `session_id`, `match_id`, or `video_submission_id` for workflow events
- `source` fixed to `mobile` or `functions`

## Environment variables
- Mobile:
  - `EXPO_PUBLIC_POSTHOG_KEY`
  - `EXPO_PUBLIC_POSTHOG_HOST`
- Functions:
  - `POSTHOG_PROJECT_API_KEY`
  - `POSTHOG_HOST`

## Usage notes
- Telemetry is non-blocking; product flows must never fail due to analytics transport errors.
- Keep payload cardinality controlled (avoid freeform high-cardinality properties).

# GDPR/CCPA Deletion Workflow

## User flow
1. User submits deletion request via `public.request_account_deletion()`.
2. Row is created in `public.user_deletion_requests` with `status='pending'`.

## Processor flow
1. Call edge function `admin-process-deletion` with `x-admin-token`.
2. Requests transition `pending -> processing -> completed|failed`.
3. Worker executes deletion/scrub steps and writes evidence rows to `public.deletion_audit_logs`.
4. On error, request is marked `failed` with `failure_reason`.

## Data handling strategy
- Hard delete where appropriate:
  - `messages`
  - `session_feedback`
  - `coach_reviews`
  - `video_submissions`
  - `video_processing_jobs`
  - `progress_snapshots`
  - `skill_profiles`
  - `availability_slots`
- Profile scrub in `users` before/while auth deletion executes.
- Attempt auth account delete via service admin API.

## Evidence retention
- Keep `user_deletion_requests` and `deletion_audit_logs` as compliance evidence.
- `deletion_audit_logs` records action-level status + metadata for every request.

## Operational command
```bash
curl -X POST "http://127.0.0.1:54321/functions/v1/admin-process-deletion" \
  -H "x-admin-token: $ADMIN_DELETION_TOKEN"
```

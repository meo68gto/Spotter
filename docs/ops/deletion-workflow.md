# GDPR/CCPA Deletion Workflow

## User request path
1. User submits deletion request via `public.request_account_deletion()`.
2. Row inserted in `user_deletion_requests` with status `pending`.

## Admin processing
1. Call edge function `admin-process-deletion` with header `x-admin-token`.
2. Function anonymizes user profile fields and marks request `completed`.

## Required env
- `ADMIN_DELETION_TOKEN`

## Audit
- Track processed request IDs from function response.
- Keep deletion request records for compliance evidence.

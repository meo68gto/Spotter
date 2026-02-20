# Match Expiration Job Spec

## Goal
Expire stale pending matches automatically.

## Function
Use SQL function:
- `public.expire_pending_matches()`

## Recommended schedule
- Run every 15 minutes in staging/production.

## Expiration rule
- Match status `pending`
- `expires_at` <= now

## Expected output
Returns number of matches moved to `expired`.

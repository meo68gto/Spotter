# Incident Playbook (Launch)

## Severity model
- P0: revenue/auth/core path down, data risk, or security impact
- P1: major feature broken with workaround
- P2: degraded non-core behavior

## Immediate response (first 10 minutes)
1. Assign incident commander.
2. Freeze deploys and merges.
3. Declare severity and open incident channel.
4. Collect failing request IDs, timestamps, and affected function names.

## Kill-switch order
1. Disable `engagement_video_call_daily`.
2. Disable `engagement_guest_checkout`.
3. Disable `engagement_public_feed`.
4. Disable `engagement_async_answers` only if payments path is unstable.

## Rollback order
1. Runtime mitigation (feature flag kill-switch).
2. Function rollback to previous known-good tag.
3. Database forward-fix migration (preferred).
4. Emergency DB rollback only for same-release breaking migration.

## Command checklist
1. Confirm current tag and last good tag.
2. Run:
   - `pnpm release:preflight`
3. Trigger `Ops Verify` after mitigation.
4. Validate:
   - `health`
   - `payments-webhook` signature validation path
   - `calls-daily-webhook` signature validation path

## Communications
- Internal update cadence: every 15 minutes for P0, every 30 minutes for P1.
- External user notice required for outages > 20 minutes or payment-impacting incidents.

## Exit criteria
1. Error rate back below threshold for 30 minutes.
2. Ops verification green.
3. Incident timeline documented.
4. Follow-up issue(s) created with owners and ETA.

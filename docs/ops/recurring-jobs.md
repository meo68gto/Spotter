# Recurring Jobs

The production recurring job workflow is defined in:

- `.github/workflows/ops-recurring-jobs.yml`

## Trigger cadence

- Every 30 minutes
- Manual trigger via `workflow_dispatch`

## Jobs executed

1. `jobs-engagement-expire-pending`
2. `jobs-payment-auth-release-expired`
3. `jobs-call-billing-finalize`

## Required secrets

- `SUPABASE_FUNCTIONS_URL`
- `ADMIN_DELETION_TOKEN`

## Safety

- Each job endpoint requires `x-admin-token`.
- Failures are visible in GitHub Actions run logs and should page on-call if recurring.

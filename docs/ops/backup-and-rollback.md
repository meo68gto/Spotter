# Backup and Rollback Runbook

## Backup policy

- Provider: Supabase managed PostgreSQL backups.
- Frequency: daily full snapshots + WAL/PITR according to plan.
- Retention: per production plan policy (confirm in Supabase dashboard before release).
- Owner: platform on-call.

## Restore drill checklist (staging)

1. Create fresh staging DB snapshot reference.
2. Restore the latest production-like backup into staging.
3. Run smoke scripts: auth, matching candidates, session propose, legal status.
4. Record restore start/end times and any failed checks.

## Rollback strategy

- Database migrations: forward-fix preferred; emergency rollback only for same-release breaking migrations.
- Runtime rollback: disable impacted paths via feature flags (`feature_flags` table).
- Release rollback: redeploy previous release tag.

## Release revert checklist

1. Disable failing feature flag(s).
2. Revert API deployment to previous known-good commit.
3. Validate `health`, auth, and payments webhook signature path.
4. Verify no pending deletion jobs are stuck in `processing`.

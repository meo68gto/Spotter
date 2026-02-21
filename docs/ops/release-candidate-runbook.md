# Release Candidate Runbook

## Scope
- Branch: `codex/rc-launch-control`
- Candidate tag format: `v0.1.0-rcN`
- Promotion rule: only promote an RC that has green staging and production verification artifacts.

## Inputs required before RC cut
1. `Ops Verify` workflow run is green in `staging`.
2. Device E2E checklist completed for iOS and Android:
   - `/Users/brucewayne/Documents/Spotter/docs/ops/device-e2e-checklist.md`
3. Migration diff reviewed (`apps/functions/supabase/migrations`).
4. Secret checklist complete:
   - `/Users/brucewayne/Documents/Spotter/docs/ops/env-matrix.md`

## RC cut procedure
1. Sync and create branch:
   - `git checkout main`
   - `git pull`
   - `git checkout -b codex/rc-launch-control`
2. Freeze window starts:
   - No new feature merges.
   - Only release blockers (P0) allowed.
3. Generate release notes draft:
   - run `pnpm ops:rc:prepare`
   - use generated artifact `.artifacts/rc-prep/<timestamp>/release-notes.md`
4. Tag RC:
   - `pnpm ops:rc:tag -- v0.1.0-rc1`
   - `git push origin v0.1.0-rc1`
5. Run production dress rehearsal:
   - Trigger `Ops Verify` workflow with `environment=production`.
6. If any check fails:
   - remove tag locally/remotely and cut next RC after fix (`v0.1.0-rc2`).

## Evidence required for RC sign-off
- `Ops Verify` artifacts for staging and production:
  - `.artifacts/ops-cutover/<timestamp>/summary.md`
  - `.artifacts/ops-cutover/<timestamp>/release-preflight.log`
  - `.artifacts/ops-cutover/<timestamp>/smoke-staging.log`
- Screenshot or exported report of Stripe webhook success.
- Screenshot or exported report of Daily webhook success.
- Completed device checklist with owner/date fields filled.

## Promotion to GA (`v0.1.0`)
1. Confirm latest RC is green and no open P0/P1 launch blockers.
2. Create GA tag from same commit:
   - `pnpm ops:rc:tag -- v0.1.0`
   - `git push origin v0.1.0`
3. Trigger production deploy workflow from GA tag.
4. Start launch monitoring checklist:
   - `/Users/brucewayne/Documents/Spotter/docs/ops/post-launch-monitoring.md`

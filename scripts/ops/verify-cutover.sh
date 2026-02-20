#!/usr/bin/env bash
set -euo pipefail

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1"
    exit 1
  fi
}

require_cmd pnpm
require_cmd tee
require_cmd date
require_cmd mkdir

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
TIMESTAMP="$(date -u +"%Y%m%dT%H%M%SZ")"
ARTIFACT_DIR="${ROOT_DIR}/.artifacts/ops-cutover/${TIMESTAMP}"
mkdir -p "$ARTIFACT_DIR"

SUMMARY_FILE="${ARTIFACT_DIR}/summary.md"
PREFLIGHT_LOG="${ARTIFACT_DIR}/release-preflight.log"
SMOKE_LOG="${ARTIFACT_DIR}/smoke-staging.log"

echo "# Spotter Ops Cutover Verification" >"$SUMMARY_FILE"
echo >>"$SUMMARY_FILE"
echo "- Timestamp (UTC): ${TIMESTAMP}" >>"$SUMMARY_FILE"
echo "- Workspace: ${ROOT_DIR}" >>"$SUMMARY_FILE"
echo >>"$SUMMARY_FILE"

echo "==> Running release preflight"
set +e
(
  cd "$ROOT_DIR"
  pnpm release:preflight
) | tee "$PREFLIGHT_LOG"
PREFLIGHT_EXIT=${PIPESTATUS[0]}
set -e

if [[ $PREFLIGHT_EXIT -eq 0 ]]; then
  echo "- release:preflight: PASS" >>"$SUMMARY_FILE"
else
  echo "- release:preflight: FAIL (see ${PREFLIGHT_LOG})" >>"$SUMMARY_FILE"
fi

echo "==> Running staging integration smoke"
set +e
(
  cd "$ROOT_DIR"
  pnpm smoke:staging
) | tee "$SMOKE_LOG"
SMOKE_EXIT=${PIPESTATUS[0]}
set -e

if [[ $SMOKE_EXIT -eq 0 ]]; then
  echo "- smoke:staging: PASS" >>"$SUMMARY_FILE"
else
  echo "- smoke:staging: FAIL (see ${SMOKE_LOG})" >>"$SUMMARY_FILE"
fi

echo >>"$SUMMARY_FILE"
echo "## Manual Evidence Required" >>"$SUMMARY_FILE"
echo "- Device E2E: run checklist at /Users/brucewayne/Documents/Spotter/docs/ops/device-e2e-checklist.md" >>"$SUMMARY_FILE"
echo "- Backup restore drill: record timings and outcomes per /Users/brucewayne/Documents/Spotter/docs/ops/backup-and-rollback.md" >>"$SUMMARY_FILE"
echo "- Webhook verification: capture Stripe and Daily successful deliveries in provider dashboards" >>"$SUMMARY_FILE"

echo
echo "Artifacts written to: ${ARTIFACT_DIR}"
cat "$SUMMARY_FILE"

if [[ $PREFLIGHT_EXIT -ne 0 || $SMOKE_EXIT -ne 0 ]]; then
  exit 1
fi

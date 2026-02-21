#!/usr/bin/env bash
set -euo pipefail

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1"
    exit 1
  fi
}

require_cmd git
require_cmd pnpm
require_cmd date
require_cmd mkdir
require_cmd tee

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

BRANCH="$(git rev-parse --abbrev-ref HEAD)"
if [[ "$BRANCH" != codex/* ]]; then
  echo "RC preparation requires a codex/* branch. Current: $BRANCH"
  exit 1
fi

if [[ -n "${CI:-}" ]]; then
  DIRTY=""
else
  DIRTY="$(git status --porcelain)"
fi
if [[ -n "$DIRTY" ]]; then
  echo "Working tree must be clean before RC preparation."
  exit 1
fi

TIMESTAMP="$(date -u +"%Y%m%dT%H%M%SZ")"
ARTIFACT_DIR="${ROOT_DIR}/.artifacts/rc-prep/${TIMESTAMP}"
mkdir -p "$ARTIFACT_DIR"

SUMMARY_FILE="${ARTIFACT_DIR}/summary.md"
CHANGES_FILE="${ARTIFACT_DIR}/changes-since-baseline.txt"
RELEASE_NOTES_FILE="${ARTIFACT_DIR}/release-notes.md"

BASELINE_TAG="$(git tag --list 'v*' --sort=-version:refname | head -n 1 || true)"
if [[ -z "$BASELINE_TAG" ]]; then
  BASELINE_REF="$(git rev-list --max-parents=0 HEAD | tail -n 1)"
  BASELINE_LABEL="initial-commit"
else
  BASELINE_REF="$BASELINE_TAG"
  BASELINE_LABEL="$BASELINE_TAG"
fi

echo "==> Running RC quality gate checks"
pnpm typecheck | tee "${ARTIFACT_DIR}/typecheck.log"
pnpm lint | tee "${ARTIFACT_DIR}/lint.log"
pnpm test | tee "${ARTIFACT_DIR}/test.log"
pnpm env:validate | tee "${ARTIFACT_DIR}/env-validate.log"

echo "==> Collecting changes since ${BASELINE_LABEL}"
git log --oneline "${BASELINE_REF}..HEAD" >"$CHANGES_FILE"

MIGRATION_FILES="$(git diff --name-only "${BASELINE_REF}..HEAD" -- apps/functions/supabase/migrations || true)"
FUNCTION_FILES="$(git diff --name-only "${BASELINE_REF}..HEAD" -- apps/functions/supabase/functions || true)"
WORKFLOW_FILES="$(git diff --name-only "${BASELINE_REF}..HEAD" -- .github/workflows || true)"
MOBILE_FILES="$(git diff --name-only "${BASELINE_REF}..HEAD" -- apps/mobile || true)"
OPS_DOC_FILES="$(git diff --name-only "${BASELINE_REF}..HEAD" -- docs/ops || true)"

{
  echo "# Spotter RC Release Notes Draft"
  echo
  echo "- Generated at (UTC): ${TIMESTAMP}"
  echo "- Branch: ${BRANCH}"
  echo "- Baseline: ${BASELINE_LABEL}"
  echo "- Commit: $(git rev-parse --short HEAD)"
  echo
  echo "## Summary"
  echo "- RC preparation checks passed: typecheck, lint, test, env template validation."
  echo "- Ops verification command available: \`pnpm ops:verify\`."
  echo
  echo "## Migrations"
  if [[ -n "$MIGRATION_FILES" ]]; then
    echo "$MIGRATION_FILES" | sed 's/^/- /'
  else
    echo "- none"
  fi
  echo
  echo "## Edge Functions"
  if [[ -n "$FUNCTION_FILES" ]]; then
    echo "$FUNCTION_FILES" | sed 's/^/- /'
  else
    echo "- none"
  fi
  echo
  echo "## Mobile"
  if [[ -n "$MOBILE_FILES" ]]; then
    echo "$MOBILE_FILES" | sed 's/^/- /'
  else
    echo "- none"
  fi
  echo
  echo "## Workflows"
  if [[ -n "$WORKFLOW_FILES" ]]; then
    echo "$WORKFLOW_FILES" | sed 's/^/- /'
  else
    echo "- none"
  fi
  echo
  echo "## Ops Docs"
  if [[ -n "$OPS_DOC_FILES" ]]; then
    echo "$OPS_DOC_FILES" | sed 's/^/- /'
  else
    echo "- none"
  fi
  echo
  echo "## Commits Since Baseline"
  if [[ -s "$CHANGES_FILE" ]]; then
    sed 's/^/- /' "$CHANGES_FILE"
  else
    echo "- none"
  fi
} >"$RELEASE_NOTES_FILE"

{
  echo "# RC Preparation Summary"
  echo
  echo "- Timestamp (UTC): ${TIMESTAMP}"
  echo "- Branch: ${BRANCH}"
  echo "- Baseline: ${BASELINE_LABEL}"
  echo "- Commit: $(git rev-parse HEAD)"
  echo
  echo "## Artifacts"
  echo "- ${RELEASE_NOTES_FILE}"
  echo "- ${CHANGES_FILE}"
  echo "- ${ARTIFACT_DIR}/typecheck.log"
  echo "- ${ARTIFACT_DIR}/lint.log"
  echo "- ${ARTIFACT_DIR}/test.log"
  echo "- ${ARTIFACT_DIR}/env-validate.log"
} >"$SUMMARY_FILE"

echo "RC preparation completed."
echo "Artifacts written to: ${ARTIFACT_DIR}"

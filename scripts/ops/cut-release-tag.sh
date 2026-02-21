#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "Usage: $0 <tag>"
  echo "Example: $0 v0.1.0-rc1"
  exit 1
fi

TAG="$1"
if [[ ! "$TAG" =~ ^v[0-9]+\.[0-9]+\.[0-9]+(-rc[0-9]+)?$ ]]; then
  echo "Invalid tag format: $TAG"
  echo "Expected: vX.Y.Z or vX.Y.Z-rcN"
  exit 1
fi

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

BRANCH="$(git rev-parse --abbrev-ref HEAD)"
if [[ "$BRANCH" != codex/* && "$TAG" == *-rc* ]]; then
  echo "RC tags must be cut from a codex/* branch. Current: $BRANCH"
  exit 1
fi

if [[ -n "$(git status --porcelain)" ]]; then
  echo "Working tree must be clean before tagging."
  exit 1
fi

if git rev-parse "$TAG" >/dev/null 2>&1; then
  echo "Tag already exists: $TAG"
  exit 1
fi

if ! git tag -a "$TAG" -m "Spotter release ${TAG}"; then
  echo "Failed to create tag $TAG"
  exit 1
fi

echo "Created local tag: $TAG"
echo "Push with: git push origin $TAG"

#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
FUNCTIONS_DIR="$ROOT_DIR/apps/functions"

if ! command -v supabase >/dev/null 2>&1; then
  echo "Supabase CLI is required. Install: https://supabase.com/docs/guides/cli"
  exit 1
fi

echo "[spotter] starting local Supabase stack"
cd "$FUNCTIONS_DIR"
supabase start

echo "[spotter] resetting local database and applying migrations + seed"
supabase db reset

echo "[spotter] local stack is ready"
echo "[spotter] in another terminal run: pnpm functions:serve"
echo "[spotter] then run smoke tests: pnpm smoke:local"

#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
FUNCTIONS_DIR="$ROOT_DIR/apps/functions"

if ! command -v supabase >/dev/null 2>&1; then
  echo "Supabase CLI is required. Install: https://supabase.com/docs/guides/cli"
  exit 1
fi

cd "$FUNCTIONS_DIR"
supabase stop

echo "[spotter] local Supabase stack stopped"

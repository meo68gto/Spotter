#!/bin/bash
set -euo pipefail

cd "$(dirname "$0")"

if [ -f ".env" ]; then
  set -a
  source ".env"
  set +a
fi

export SUPABASE_URL="https://$(cat .supabase-url 2>/dev/null || echo "${SUPABASE_URL#https://}")"
export SUPABASE_ANON_KEY="$(cat .supabase-anon-key 2>/dev/null || echo "${SUPABASE_ANON_KEY:-}")"
export PORT="${PORT:-3100}"

node --import tsx server.ts

#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ROOT_ENV="$ROOT_DIR/.env.local"
MOBILE_ENV="$ROOT_DIR/apps/mobile/.env.local"

if [[ ! -f "$ROOT_ENV" ]]; then
  echo "[spotter] root .env.local not found; skipping mobile env sync"
  exit 0
fi

TMP_FILE="$(mktemp)"
trap 'rm -f "$TMP_FILE"' EXIT

{
  echo "# Auto-generated from root .env.local. Do not edit manually."
  grep -E '^EXPO_PUBLIC_[A-Z0-9_]+=.*$' "$ROOT_ENV" || true
} > "$TMP_FILE"

ensure_key() {
  local key="$1"
  local value="$2"
  if ! grep -q "^${key}=" "$TMP_FILE"; then
    echo "${key}=${value}" >> "$TMP_FILE"
  fi
}

ensure_key "EXPO_PUBLIC_LEGAL_TOS_URL" "https://example.com/terms"
ensure_key "EXPO_PUBLIC_LEGAL_PRIVACY_URL" "https://example.com/privacy"
ensure_key "EXPO_PUBLIC_LEGAL_COOKIE_URL" "https://example.com/cookies"
ensure_key "EXPO_PUBLIC_LEGAL_TOS_VERSION" "1.0"
ensure_key "EXPO_PUBLIC_LEGAL_PRIVACY_VERSION" "1.0"
ensure_key "EXPO_PUBLIC_LEGAL_COOKIE_VERSION" "1.0"

mv "$TMP_FILE" "$MOBILE_ENV"
echo "[spotter] synced mobile env -> $MOBILE_ENV"

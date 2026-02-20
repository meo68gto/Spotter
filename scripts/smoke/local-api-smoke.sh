#!/usr/bin/env bash
set -euo pipefail

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1"
    exit 1
  fi
}

require_cmd curl
require_cmd jq

SUPABASE_URL="${SUPABASE_URL:-http://127.0.0.1:54321}"
FUNCTIONS_URL="${FUNCTIONS_URL:-$SUPABASE_URL/functions/v1}"
ANON_KEY="${SUPABASE_ANON_KEY:-}"
SERVICE_KEY="${SUPABASE_SERVICE_ROLE_KEY:-}"

if [[ -z "$ANON_KEY" || -z "$SERVICE_KEY" ]]; then
  echo "Set SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY before running smoke tests."
  echo "Tip: with local stack, run: supabase status -o env"
  exit 1
fi

if ! curl -sS "$FUNCTIONS_URL/health" >/dev/null; then
  echo "Health endpoint unavailable at $FUNCTIONS_URL/health"
  echo "Ensure functions are running: pnpm functions:serve"
  exit 1
fi

SUFFIX="$(date +%s)"
REQ_EMAIL="spotter_req_${SUFFIX}@example.com"
CAND_EMAIL="spotter_cand_${SUFFIX}@example.com"
PASSWORD="TestPass123!"

signup() {
  local email="$1"
  curl -sS "$SUPABASE_URL/auth/v1/signup" \
    -H "apikey: $ANON_KEY" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$email\",\"password\":\"$PASSWORD\"}"
}

REQ_SIGNUP="$(signup "$REQ_EMAIL")"
CAND_SIGNUP="$(signup "$CAND_EMAIL")"

REQ_USER_ID="$(echo "$REQ_SIGNUP" | jq -r '.user.id')"
CAND_USER_ID="$(echo "$CAND_SIGNUP" | jq -r '.user.id')"
REQ_ACCESS_TOKEN="$(echo "$REQ_SIGNUP" | jq -r '.access_token')"
CAND_ACCESS_TOKEN="$(echo "$CAND_SIGNUP" | jq -r '.access_token')"

if [[ "$REQ_USER_ID" == "null" || "$REQ_ACCESS_TOKEN" == "null" || "$CAND_USER_ID" == "null" || "$CAND_ACCESS_TOKEN" == "null" ]]; then
  echo "Failed to create test users"
  echo "$REQ_SIGNUP"
  echo "$CAND_SIGNUP"
  exit 1
fi

ACTIVITY_ID="$(curl -sS "$SUPABASE_URL/rest/v1/activities?select=id&slug=eq.skiing&limit=1" \
  -H "apikey: $ANON_KEY" \
  -H "Authorization: Bearer $ANON_KEY" | jq -r '.[0].id')"

if [[ -z "$ACTIVITY_ID" || "$ACTIVITY_ID" == "null" ]]; then
  echo "Missing skiing activity seed data. Run: pnpm local:up"
  exit 1
fi

curl -sS "$SUPABASE_URL/rest/v1/users" \
  -H "apikey: $SERVICE_KEY" \
  -H "Authorization: Bearer $SERVICE_KEY" \
  -H "Content-Type: application/json" \
  -H "Prefer: resolution=merge-duplicates" \
  -d "[{\"id\":\"$REQ_USER_ID\",\"display_name\":\"Requester\",\"home_location\":\"SRID=4326;POINT(-110.7624 43.4799)\"},{\"id\":\"$CAND_USER_ID\",\"display_name\":\"Candidate\",\"home_location\":\"SRID=4326;POINT(-110.7600 43.4800)\"}]" >/dev/null

ONBOARDING_RESPONSE="$(curl -sS "$FUNCTIONS_URL/onboarding-profile" \
  -H "apikey: $ANON_KEY" \
  -H "Authorization: Bearer $REQ_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"activityId\":\"$ACTIVITY_ID\",\"sourceScale\":\"self_assessment\",\"sourceValue\":\"intermediate\",\"canonicalScore\":55,\"skillBand\":\"intermediate\"}")"

if [[ "$(echo "$ONBOARDING_RESPONSE" | jq -r '.data.user_id // empty')" != "$REQ_USER_ID" ]]; then
  echo "Onboarding function failed"
  echo "$ONBOARDING_RESPONSE"
  exit 1
fi

curl -sS "$SUPABASE_URL/rest/v1/skill_profiles" \
  -H "apikey: $SERVICE_KEY" \
  -H "Authorization: Bearer $SERVICE_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"user_id\":\"$CAND_USER_ID\",\"activity_id\":\"$ACTIVITY_ID\",\"source_scale\":\"self_assessment\",\"source_value\":\"intermediate\",\"canonical_score\":57,\"skill_band\":\"intermediate\"}" >/dev/null

MATCH_RESPONSE="$(curl -sS "$FUNCTIONS_URL/matching-candidates" \
  -H "apikey: $ANON_KEY" \
  -H "Authorization: Bearer $REQ_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"activityId\":\"$ACTIVITY_ID\",\"radiusKm\":5,\"skillBand\":\"intermediate\",\"limit\":5}")"

MATCH_HAS_RESULTS="$(echo "$MATCH_RESPONSE" | jq -r '(.data | type == "array") and ((.data | length) > 0)')"
if [[ "$MATCH_HAS_RESULTS" != "true" ]]; then
  echo "Matching function failed"
  echo "$MATCH_RESPONSE"
  exit 1
fi

MATCH_CREATE="$(curl -sS "$FUNCTIONS_URL/matching-request" \
  -H "apikey: $ANON_KEY" \
  -H "Authorization: Bearer $REQ_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"candidateUserId\":\"$CAND_USER_ID\",\"activityId\":\"$ACTIVITY_ID\"}")"
MATCH_ID="$(echo "$MATCH_CREATE" | jq -r '.data.id')"

if [[ "$MATCH_ID" == "null" || -z "$MATCH_ID" ]]; then
  echo "Match request function failed"
  echo "$MATCH_CREATE"
  exit 1
fi

MATCH_ACCEPT="$(curl -sS "$FUNCTIONS_URL/matching-accept" \
  -H "apikey: $ANON_KEY" \
  -H "Authorization: Bearer $CAND_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"matchId\":\"$MATCH_ID\"}")"

if [[ "$(echo "$MATCH_ACCEPT" | jq -r '.data.status')" != "accepted" ]]; then
  echo "Match accept function failed"
  echo "$MATCH_ACCEPT"
  exit 1
fi

SESSION_RESPONSE="$(curl -sS "$FUNCTIONS_URL/sessions-propose" \
  -H "apikey: $ANON_KEY" \
  -H "Authorization: Bearer $REQ_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"matchId\":\"$MATCH_ID\",\"activityId\":\"$ACTIVITY_ID\",\"partnerUserId\":\"$CAND_USER_ID\",\"proposedStartTime\":\"2026-02-21T15:00:00Z\",\"latitude\":43.4799,\"longitude\":-110.7624}")"

if [[ "$(echo "$SESSION_RESPONSE" | jq -r '.data.status')" != "proposed" ]]; then
  echo "Session proposal function failed"
  echo "$SESSION_RESPONSE"
  exit 1
fi

SESSION_ID="$(echo "$SESSION_RESPONSE" | jq -r '.data.id')"

CHAT_RESPONSE="$(curl -sS "$FUNCTIONS_URL/chat-send" \
  -H "apikey: $ANON_KEY" \
  -H "Authorization: Bearer $REQ_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"sessionId\":\"$SESSION_ID\",\"message\":\"See you there\",\"clientMessageId\":\"smoke-1\"}")"

if [[ "$(echo "$CHAT_RESPONSE" | jq -r '.data.message')" != "See you there" ]]; then
  echo "Chat send function failed"
  echo "$CHAT_RESPONSE"
  exit 1
fi

CONFIRM_RESPONSE="$(curl -sS "$FUNCTIONS_URL/sessions-confirm" \
  -H "apikey: $ANON_KEY" \
  -H "Authorization: Bearer $CAND_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"sessionId\":\"$SESSION_ID\",\"confirmedTime\":\"2026-02-21T15:00:00Z\",\"latitude\":43.4799,\"longitude\":-110.7624}")"

if [[ "$(echo "$CONFIRM_RESPONSE" | jq -r '.data.status')" != "confirmed" ]]; then
  echo "Session confirm function failed"
  echo "$CONFIRM_RESPONSE"
  exit 1
fi

echo "Smoke test passed: auth + onboarding + matching + session lifecycle + chat"

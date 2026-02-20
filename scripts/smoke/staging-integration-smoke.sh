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

SUPABASE_URL="${SUPABASE_URL:-}"
FUNCTIONS_URL="${FUNCTIONS_URL:-${SUPABASE_FUNCTIONS_URL:-}}"
ANON_KEY="${SUPABASE_ANON_KEY:-}"
SERVICE_KEY="${SUPABASE_SERVICE_ROLE_KEY:-}"
ADMIN_TOKEN="${ADMIN_DELETION_TOKEN:-}"
DAILY_WEBHOOK_SECRET="${DAILY_WEBHOOK_SECRET:-}"

if [[ -z "$SUPABASE_URL" || -z "$FUNCTIONS_URL" || -z "$ANON_KEY" || -z "$SERVICE_KEY" ]]; then
  echo "Required env vars: SUPABASE_URL, FUNCTIONS_URL (or SUPABASE_FUNCTIONS_URL), SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY"
  exit 1
fi

if ! curl -sS "$FUNCTIONS_URL/health" >/dev/null; then
  echo "Health endpoint unavailable at $FUNCTIONS_URL/health"
  exit 1
fi

SUFFIX="$(date +%s)"
REQ_EMAIL="spotter_req_stage_${SUFFIX}@example.com"
COACH_EMAIL="spotter_coach_stage_${SUFFIX}@example.com"
GUEST_EMAIL="spotter_guest_stage_${SUFFIX}@example.com"
PASSWORD="StagePass123!"

create_user_admin() {
  local email="$1"
  local response
  response="$(curl -sS "$SUPABASE_URL/auth/v1/admin/users" \
    -H "apikey: $SERVICE_KEY" \
    -H "Authorization: Bearer $SERVICE_KEY" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$email\",\"password\":\"$PASSWORD\",\"email_confirm\":true}")"
  local user_id
  user_id="$(echo "$response" | jq -r '.id // empty')"
  if [[ -z "$user_id" ]]; then
    echo "Failed to create user via admin API"
    echo "$response"
    exit 1
  fi
  echo "$user_id"
}

login_user() {
  local email="$1"
  local response
  response="$(curl -sS "$SUPABASE_URL/auth/v1/token?grant_type=password" \
    -H "apikey: $ANON_KEY" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$email\",\"password\":\"$PASSWORD\"}")"
  local access_token
  access_token="$(echo "$response" | jq -r '.access_token // empty')"
  if [[ -z "$access_token" ]]; then
    echo "Failed login for $email"
    echo "$response"
    exit 1
  fi
  echo "$access_token"
}

call_fn_authed() {
  local token="$1"
  local path="$2"
  local json="$3"
  curl -sS "$FUNCTIONS_URL/$path" \
    -H "apikey: $ANON_KEY" \
    -H "Authorization: Bearer $token" \
    -H "Content-Type: application/json" \
    -d "$json"
}

REQ_USER_ID="$(create_user_admin "$REQ_EMAIL")"
COACH_USER_ID="$(create_user_admin "$COACH_EMAIL")"
REQ_ACCESS_TOKEN="$(login_user "$REQ_EMAIL")"
COACH_ACCESS_TOKEN="$(login_user "$COACH_EMAIL")"

ACTIVITY_ID="$(curl -sS "$SUPABASE_URL/rest/v1/activities?select=id&slug=eq.skiing&limit=1" \
  -H "apikey: $ANON_KEY" \
  -H "Authorization: Bearer $ANON_KEY" | jq -r '.[0].id // empty')"

if [[ -z "$ACTIVITY_ID" ]]; then
  echo "Missing skiing activity. Seed required in staging."
  exit 1
fi

curl -sS "$SUPABASE_URL/rest/v1/users" \
  -H "apikey: $SERVICE_KEY" \
  -H "Authorization: Bearer $SERVICE_KEY" \
  -H "Content-Type: application/json" \
  -H "Prefer: resolution=merge-duplicates" \
  -d "[{\"id\":\"$REQ_USER_ID\",\"display_name\":\"Stage Requester\",\"home_location\":\"SRID=4326;POINT(-110.7624 43.4799)\"},{\"id\":\"$COACH_USER_ID\",\"display_name\":\"Stage Coach\",\"home_location\":\"SRID=4326;POINT(-110.7600 43.4800)\"}]" >/dev/null

LEGAL_REQ="$(call_fn_authed "$REQ_ACCESS_TOKEN" "legal-consent" "{\"accepted\":true,\"locale\":\"en-US\"}")"
LEGAL_COACH="$(call_fn_authed "$COACH_ACCESS_TOKEN" "legal-consent" "{\"accepted\":true,\"locale\":\"en-US\"}")"
if [[ "$(echo "$LEGAL_REQ" | jq -r '.data.id // empty')" == "" || "$(echo "$LEGAL_COACH" | jq -r '.data.id // empty')" == "" ]]; then
  echo "Legal consent failed"
  echo "$LEGAL_REQ"
  echo "$LEGAL_COACH"
  exit 1
fi

COACH_ROW="$(curl -sS "$SUPABASE_URL/rest/v1/coaches?on_conflict=user_id" \
  -H "apikey: $SERVICE_KEY" \
  -H "Authorization: Bearer $SERVICE_KEY" \
  -H "Content-Type: application/json" \
  -H "Prefer: resolution=merge-duplicates,return=representation" \
  -d "{\"user_id\":\"$COACH_USER_ID\",\"onboarding_status\":\"active\"}")"
COACH_ID="$(echo "$COACH_ROW" | jq -r '.[0].id // empty')"
if [[ -z "$COACH_ID" ]]; then
  echo "Coach upsert failed"
  echo "$COACH_ROW"
  exit 1
fi

PRICING_UPSERT="$(call_fn_authed "$COACH_ACCESS_TOKEN" "experts-pricing-upsert" "{
  \"items\": [
    {\"engagementMode\":\"text_answer\",\"currency\":\"usd\",\"priceCents\":1500,\"active\":true},
    {\"engagementMode\":\"video_call\",\"currency\":\"usd\",\"priceCents\":3000,\"perMinuteRateCents\":250,\"active\":true}
  ]
}")"
if [[ "$(echo "$PRICING_UPSERT" | jq -r '.data[0].coach_id // empty')" == "" ]]; then
  echo "Pricing upsert failed"
  echo "$PRICING_UPSERT"
  exit 1
fi

ASYNC_CREATE="$(call_fn_authed "$REQ_ACCESS_TOKEN" "engagements-create" "{
  \"coachId\":\"$COACH_ID\",
  \"engagementMode\":\"text_answer\",
  \"questionText\":\"How should I improve edge control this week?\"
}")"
ASYNC_ENGAGEMENT_ID="$(echo "$ASYNC_CREATE" | jq -r '.data.request.id // empty')"
if [[ -z "$ASYNC_ENGAGEMENT_ID" ]]; then
  echo "Registered async engagement create failed"
  echo "$ASYNC_CREATE"
  exit 1
fi

ASYNC_ACCEPT="$(call_fn_authed "$COACH_ACCESS_TOKEN" "engagements-accept" "{\"engagementRequestId\":\"$ASYNC_ENGAGEMENT_ID\"}")"
ASYNC_RESPOND="$(call_fn_authed "$COACH_ACCESS_TOKEN" "engagements-respond" "{\"engagementRequestId\":\"$ASYNC_ENGAGEMENT_ID\",\"responseText\":\"Focus on outside ski pressure and earlier edge set.\"}")"
if [[ "$(echo "$ASYNC_ACCEPT" | jq -r '.data.status')" != "accepted" || "$(echo "$ASYNC_RESPOND" | jq -r '.data.engagement_request_id')" != "$ASYNC_ENGAGEMENT_ID" ]]; then
  echo "Registered async accept/respond failed"
  echo "$ASYNC_ACCEPT"
  echo "$ASYNC_RESPOND"
  exit 1
fi

PUBLIC_TOGGLE="$(call_fn_authed "$COACH_ACCESS_TOKEN" "engagements-public-toggle" "{\"engagementRequestId\":\"$ASYNC_ENGAGEMENT_ID\",\"publicOptIn\":true}")"
if [[ "$(echo "$PUBLIC_TOGGLE" | jq -r '.data.public_opt_in')" != "true" ]]; then
  echo "Public toggle failed"
  echo "$PUBLIC_TOGGLE"
  exit 1
fi

if [[ -n "$ADMIN_TOKEN" ]]; then
  MODERATE="$(curl -sS "$FUNCTIONS_URL/engagements-moderate" \
    -H "x-admin-token: $ADMIN_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"engagementRequestId\":\"$ASYNC_ENGAGEMENT_ID\",\"moderationStatus\":\"approved\"}")"
  if [[ "$(echo "$MODERATE" | jq -r '.data.moderation_status')" != "approved" ]]; then
    echo "Moderation approve failed"
    echo "$MODERATE"
    exit 1
  fi

  FEED="$(curl -sS "$FUNCTIONS_URL/feed-home?limit=10")"
  FEED_HAS_ITEM="$(echo "$FEED" | jq -r --arg id "$ASYNC_ENGAGEMENT_ID" '([.data[]?.engagement_requests?.id] | index($id)) != null')"
  if [[ "$FEED_HAS_ITEM" != "true" ]]; then
    echo "Feed missing approved public item"
    echo "$FEED"
    exit 1
  fi
fi

GUEST_START="$(curl -sS "$FUNCTIONS_URL/guest-start-checkout" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$GUEST_EMAIL\"}")"
GUEST_TOKEN="$(echo "$GUEST_START" | jq -r '.data.verificationToken // empty')"
if [[ -z "$GUEST_TOKEN" ]]; then
  echo "Guest checkout start failed"
  echo "$GUEST_START"
  exit 1
fi

GUEST_CREATE="$(curl -sS "$FUNCTIONS_URL/engagements-create" \
  -H "Content-Type: application/json" \
  -d "{\"coachId\":\"$COACH_ID\",\"engagementMode\":\"text_answer\",\"questionText\":\"Guest question\",\"guestEmail\":\"$GUEST_EMAIL\"}")"
GUEST_ENGAGEMENT_ID="$(echo "$GUEST_CREATE" | jq -r '.data.id // empty')"
GUEST_VERIFY_TOKEN="$(echo "$GUEST_CREATE" | jq -r '.data.guestVerificationToken // empty')"
if [[ -z "$GUEST_ENGAGEMENT_ID" || -z "$GUEST_VERIFY_TOKEN" ]]; then
  echo "Guest engagement create failed"
  echo "$GUEST_CREATE"
  exit 1
fi

GUEST_VERIFY="$(curl -sS "$FUNCTIONS_URL/guest-verify" \
  -H "Content-Type: application/json" \
  -d "{\"token\":\"$GUEST_VERIFY_TOKEN\"}")"
GUEST_HAS_ITEM="$(echo "$GUEST_VERIFY" | jq -r --arg id "$GUEST_ENGAGEMENT_ID" '([.data.requests[]?.id] | index($id)) != null')"
if [[ "$GUEST_HAS_ITEM" != "true" ]]; then
  echo "Guest verify failed to return request"
  echo "$GUEST_VERIFY"
  exit 1
fi

CALL_CREATE="$(call_fn_authed "$REQ_ACCESS_TOKEN" "engagements-create" "{
  \"coachId\":\"$COACH_ID\",
  \"engagementMode\":\"video_call\",
  \"questionText\":\"Can we do a 1:1 technique review?\",
  \"scheduledTime\":\"2026-02-21T18:00:00Z\"
}")"
CALL_ENGAGEMENT_ID="$(echo "$CALL_CREATE" | jq -r '.data.request.id // empty')"
if [[ -z "$CALL_ENGAGEMENT_ID" ]]; then
  echo "Video call engagement create failed"
  echo "$CALL_CREATE"
  exit 1
fi

CALL_ACCEPT="$(call_fn_authed "$COACH_ACCESS_TOKEN" "engagements-accept" "{\"engagementRequestId\":\"$CALL_ENGAGEMENT_ID\"}")"
if [[ "$(echo "$CALL_ACCEPT" | jq -r '.data.status')" != "accepted" ]]; then
  echo "Video call engagement accept failed"
  echo "$CALL_ACCEPT"
  exit 1
fi

CALL_ROOM="$(call_fn_authed "$REQ_ACCESS_TOKEN" "calls-create-room" "{\"engagementRequestId\":\"$CALL_ENGAGEMENT_ID\"}")"
CALL_ROOM_NAME="$(echo "$CALL_ROOM" | jq -r '.data.daily_room_name // empty')"
if [[ -z "$CALL_ROOM_NAME" ]]; then
  echo "Create call room failed"
  echo "$CALL_ROOM"
  exit 1
fi

CALL_START="$(call_fn_authed "$REQ_ACCESS_TOKEN" "calls-start" "{\"engagementRequestId\":\"$CALL_ENGAGEMENT_ID\"}")"
CALL_END="$(call_fn_authed "$REQ_ACCESS_TOKEN" "calls-end" "{\"engagementRequestId\":\"$CALL_ENGAGEMENT_ID\",\"durationSeconds\":125}")"
if [[ "$(echo "$CALL_END" | jq -r '.data.billableMinutes')" != "3" ]]; then
  echo "Call end billing failed (expected 3 billable minutes)"
  echo "$CALL_START"
  echo "$CALL_END"
  exit 1
fi

if [[ -n "$DAILY_WEBHOOK_SECRET" ]]; then
  DAILY_WEBHOOK="$(curl -sS "$FUNCTIONS_URL/calls-daily-webhook" \
    -H "x-daily-signature: $DAILY_WEBHOOK_SECRET" \
    -H "Content-Type: application/json" \
    -d "{\"event\":\"call.ended\",\"payload\":{\"room_name\":\"$CALL_ROOM_NAME\",\"duration\":180}}")"
  if [[ "$(echo "$DAILY_WEBHOOK" | jq -r '.data.reconciled')" != "true" ]]; then
    echo "Daily webhook reconcile failed"
    echo "$DAILY_WEBHOOK"
    exit 1
  fi
fi

echo "Staging integration smoke passed: registered + guest + public feed + video call + billing paths."

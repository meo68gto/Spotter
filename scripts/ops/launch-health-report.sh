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
require_cmd date
require_cmd mkdir

SUPABASE_URL="${SUPABASE_URL:-}"
SUPABASE_SERVICE_ROLE_KEY="${SUPABASE_SERVICE_ROLE_KEY:-}"
SUPABASE_ANON_KEY="${SUPABASE_ANON_KEY:-}"
FUNCTIONS_URL="${FUNCTIONS_URL:-${SUPABASE_FUNCTIONS_URL:-}}"

if [[ -z "$SUPABASE_URL" || -z "$SUPABASE_SERVICE_ROLE_KEY" || -z "$FUNCTIONS_URL" || -z "$SUPABASE_ANON_KEY" ]]; then
  echo "Required env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY, FUNCTIONS_URL (or SUPABASE_FUNCTIONS_URL)"
  exit 1
fi

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
TIMESTAMP="$(date -u +"%Y%m%dT%H%M%SZ")"
SINCE="$(date -u -v-24H +"%Y-%m-%dT%H:%M:%SZ" 2>/dev/null || date -u -d '24 hours ago' +"%Y-%m-%dT%H:%M:%SZ")"

ARTIFACT_DIR="${ROOT_DIR}/.artifacts/ops-health/${TIMESTAMP}"
mkdir -p "$ARTIFACT_DIR"

ORDERS_JSON="${ARTIFACT_DIR}/orders.json"
ENGAGEMENTS_JSON="${ARTIFACT_DIR}/engagements.json"
CALLS_JSON="${ARTIFACT_DIR}/calls.json"
HEALTH_JSON="${ARTIFACT_DIR}/health.json"
REPORT_MD="${ARTIFACT_DIR}/report.md"

curl -fssS "${SUPABASE_URL}/rest/v1/review_orders?select=id,status,created_at&created_at=gte.${SINCE}&limit=5000" \
  -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" >"$ORDERS_JSON"

curl -fssS "${SUPABASE_URL}/rest/v1/engagement_requests?select=id,status,created_at,expires_at&created_at=gte.${SINCE}&limit=5000" \
  -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" >"$ENGAGEMENTS_JSON"

curl -fssS "${SUPABASE_URL}/rest/v1/video_call_sessions?select=id,duration_seconds,billable_minutes,created_at&created_at=gte.${SINCE}&limit=5000" \
  -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" >"$CALLS_JSON"

curl -fssS "${FUNCTIONS_URL}/health" \
  -H "apikey: ${SUPABASE_ANON_KEY}" >"$HEALTH_JSON"

ORDER_TOTAL="$(jq 'length' "$ORDERS_JSON")"
ORDER_PAID="$(jq '[.[] | select(.status=="paid")] | length' "$ORDERS_JSON")"
ORDER_FAILED="$(jq '[.[] | select(.status=="failed")] | length' "$ORDERS_JSON")"
ORDER_REFUNDED="$(jq '[.[] | select(.status=="refunded")] | length' "$ORDERS_JSON")"

ENGAGEMENT_TOTAL="$(jq 'length' "$ENGAGEMENTS_JSON")"
ENGAGEMENT_COMPLETED="$(jq '[.[] | select(.status=="completed")] | length' "$ENGAGEMENTS_JSON")"
ENGAGEMENT_AWAITING="$(jq '[.[] | select(.status=="awaiting_expert")] | length' "$ENGAGEMENTS_JSON")"
ENGAGEMENT_EXPIRED="$(jq '[.[] | select(.status=="expired")] | length' "$ENGAGEMENTS_JSON")"
ENGAGEMENT_STUCK="$(jq --arg now "$(date -u +"%Y-%m-%dT%H:%M:%SZ")" '[.[] | select(.status=="awaiting_expert" and (.expires_at != null and .expires_at < $now))] | length' "$ENGAGEMENTS_JSON")"

CALL_TOTAL="$(jq 'length' "$CALLS_JSON")"
CALL_WITH_DURATION="$(jq '[.[] | select(.duration_seconds != null)] | length' "$CALLS_JSON")"
CALL_AVG_DURATION="$(jq 'if length==0 then 0 else ([.[] | (.duration_seconds // 0)] | add / length) end' "$CALLS_JSON")"
CALL_AVG_BILLABLE="$(jq 'if length==0 then 0 else ([.[] | (.billable_minutes // 0)] | add / length) end' "$CALLS_JSON")"

HEALTH_OK="$(jq -r '.data.ok // false' "$HEALTH_JSON")"

{
  echo "# Spotter Launch Health Report"
  echo
  echo "- Generated at (UTC): ${TIMESTAMP}"
  echo "- Window start (UTC): ${SINCE}"
  echo
  echo "## Health Endpoint"
  echo "- health ok: ${HEALTH_OK}"
  echo
  echo "## Orders (last 24h)"
  echo "- total: ${ORDER_TOTAL}"
  echo "- paid: ${ORDER_PAID}"
  echo "- failed: ${ORDER_FAILED}"
  echo "- refunded: ${ORDER_REFUNDED}"
  echo
  echo "## Engagements (last 24h)"
  echo "- total: ${ENGAGEMENT_TOTAL}"
  echo "- completed: ${ENGAGEMENT_COMPLETED}"
  echo "- awaiting_expert: ${ENGAGEMENT_AWAITING}"
  echo "- expired: ${ENGAGEMENT_EXPIRED}"
  echo "- stuck awaiting_expert past expiry: ${ENGAGEMENT_STUCK}"
  echo
  echo "## Video Calls (last 24h)"
  echo "- total sessions: ${CALL_TOTAL}"
  echo "- sessions with duration: ${CALL_WITH_DURATION}"
  echo "- avg duration seconds: ${CALL_AVG_DURATION}"
  echo "- avg billable minutes: ${CALL_AVG_BILLABLE}"
  echo
  echo "## Artifacts"
  echo "- ${HEALTH_JSON}"
  echo "- ${ORDERS_JSON}"
  echo "- ${ENGAGEMENTS_JSON}"
  echo "- ${CALLS_JSON}"
} >"$REPORT_MD"

cat "$REPORT_MD"

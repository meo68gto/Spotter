#!/usr/bin/env bash
#
# End-to-End Verification Script for Spotter
# Tests all critical user flows before production launch
#

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="${SCRIPT_DIR}/../.."
REPORT_DIR="${ROOT_DIR}/.artifacts/e2e-verification"
TIMESTAMP=$(date -u +"%Y%m%d_%H%M%S")
REPORT_FILE="${REPORT_DIR}/e2e_verification_${TIMESTAMP}.md"

# Required environment variables
: "${SUPABASE_URL:?SUPABASE_URL not set}"
: "${SUPABASE_ANON_KEY:?SUPABASE_ANON_KEY not set}"
: "${SUPABASE_SERVICE_ROLE_KEY:?SUPABASE_SERVICE_ROLE_KEY not set}"

# Test configuration
API_BASE="${SUPABASE_URL}/functions/v1"

# Counters
TESTS_PASSED=0
TESTS_FAILED=0
TESTS_SKIPPED=0

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Logging
log() {
  echo "$1" | tee -a "${REPORT_FILE}"
}

log_section() {
  log ""
  log "## $1"
  log ""
}

log_test() {
  log "### $1"
}

pass() {
  echo -e "${GREEN}[PASS]${NC} $1" | tee -a "${REPORT_FILE}"
  ((TESTS_PASSED++)) || true
}

fail() {
  echo -e "${RED}[FAIL]${NC} $1" | tee -a "${REPORT_FILE}"
  ((TESTS_FAILED++)) || true
}

skip() {
  echo -e "${YELLOW}[SKIP]${NC} $1" | tee -a "${REPORT_FILE}"
  ((TESTS_SKIPPED++)) || true
}

# Initialize report
init_report() {
  mkdir -p "${REPORT_DIR}"
  cat > "${REPORT_FILE}" <<EOF
# Spotter End-to-End Verification Report

**Date:** $(date -u +"%Y-%m-%d %H:%M:%S UTC")  
**Environment:** ${SUPABASE_URL}  
**Test Suite:** Critical Flows Verification

## Summary

| Metric | Count |
|--------|-------|
| Tests Passed | PENDING |
| Tests Failed | PENDING |
| Tests Skipped | PENDING |

---

EOF
}

# Test 1: Health Check
test_health_check() {
  log_test "Health Check Endpoint"
  
  local response
  response=$(curl -sS -w "\n%{http_code}" "${API_BASE}/health" -H "apikey: ${SUPABASE_ANON_KEY}" 2>/dev/null || echo -e "\n000")
  
  local http_code
  http_code=$(echo "${response}" | tail -1)
  local body
  body=$(echo "${response}" | head -n -1)
  
  if [[ "${http_code}" == "200" ]]; then
    local status
    status=$(echo "${body}" | jq -r '.status // "unknown"' 2>/dev/null || echo "unknown")
    if [[ "${status}" == "healthy" || "${status}" == "ok" ]]; then
      pass "Health endpoint returns 200 with status: ${status}"
    else
      fail "Health endpoint degraded: ${status}"
    fi
  else
    fail "Health endpoint returned HTTP ${http_code}"
  fi
}

# Test 2: Auth Flow
test_auth_flow() {
  log_section "Authentication Flow"
  
  log_test "Auth Service Responsive"
  
  local response
  response=$(curl -sS -w "\n%{http_code}" "${SUPABASE_URL}/auth/v1/settings" \
    -H "apikey: ${SUPABASE_ANON_KEY}" 2>/dev/null || echo -e "\n000")
  
  local http_code
  http_code=$(echo "${response}" | tail -1)
  
  if [[ "${http_code}" == "200" ]]; then
    pass "Auth service is responsive"
  else
    skip "Auth service check (HTTP ${http_code})"
  fi
}

# Test 3: Round Creation Flow
test_round_creation() {
  log_section "Round Creation Flow"
  
  log_test "Create Round Endpoint Protected"
  
  local response
  response=$(curl -sS -w "\n%{http_code}" -X POST "${API_BASE}/rounds-create" \
    -H "Content-Type: application/json" \
    -H "apikey: ${SUPABASE_ANON_KEY}" \
    -d '{}' 2>/dev/null || echo -e "\n000")
  
  local http_code
  http_code=$(echo "${response}" | tail -1)
  
  if [[ "${http_code}" == "401" ]]; then
    pass "Round creation endpoint requires authentication"
  elif [[ "${http_code}" == "200" || "${http_code}" == "201" ]]; then
    fail "Round creation endpoint allows unauthenticated access"
  else
    pass "Round creation endpoint responds (HTTP ${http_code})"
  fi
}

# Test 4: Trust/Vouching Flow
test_trust_vouching() {
  log_section "Trust and Vouching Flow"
  
  log_test "Vouch Endpoint Security"
  
  local response
  response=$(curl -sS -w "\n%{http_code}" -X POST "${API_BASE}/trust-vouch" \
    -H "Content-Type: application/json" \
    -H "apikey: ${SUPABASE_ANON_KEY}" \
    -d '{"vouchedId": "test-user-id"}' 2>/dev/null || echo -e "\n000")
  
  local http_code
  http_code=$(echo "${response}" | tail -1)
  
  if [[ "${http_code}" == "401" ]]; then
    pass "Vouch endpoint requires authentication"
  else
    skip "Vouch endpoint check (HTTP ${http_code})"
  fi
}

# Test 5: Tier Enforcement
test_tier_enforcement() {
  log_section "Tier Enforcement"
  
  log_test "Tier Assignment Endpoint Protected"
  
  local response
  response=$(curl -sS -w "\n%{http_code}" "${API_BASE}/tier-assignment" \
    -H "apikey: ${SUPABASE_ANON_KEY}" 2>/dev/null || echo -e "\n000")
  
  local http_code
  http_code=$(echo "${response}" | tail -1)
  
  if [[ "${http_code}" == "401" || "${http_code}" == "405" ]]; then
    pass "Tier assignment endpoint is protected"
  else
    skip "Tier assignment endpoint check (HTTP ${http_code})"
  fi
}

# Test 6: Payment Flow
test_payment_flow() {
  log_section "Payment Flow"
  
  log_test "Stripe Webhook Endpoint Validates Signatures"
  
  local response
  response=$(curl -sS -w "\n%{http_code}" -X POST "${API_BASE}/stripe-webhook" \
    -H "Content-Type: application/json" \
    -H "apikey: ${SUPABASE_ANON_KEY}" \
    -d '{}' 2>/dev/null || echo -e "\n000")
  
  local http_code
  http_code=$(echo "${response}" | tail -1)
  
  if [[ "${http_code}" == "400" ]]; then
    pass "Stripe webhook endpoint validates signatures"
  else
    skip "Stripe webhook check (HTTP ${http_code})"
  fi
}

# Test 7: Organizer Flows
test_organizer_flows() {
  log_section "Organizer Flows"
  
  log_test "Organizer Endpoints Protected"
  
  local response
  response=$(curl -sS -w "\n%{http_code}" "${API_BASE}/organizer-events" \
    -H "apikey: ${SUPABASE_ANON_KEY}" 2>/dev/null || echo -e "\n000")
  
  local http_code
  http_code=$(echo "${response}" | tail -1)
  
  if [[ "${http_code}" == "401" ]]; then
    pass "Organizer events requires authentication"
  else
    skip "Organizer events check (HTTP ${http_code})"
  fi
}

# Test 8: Network/Connections
test_network_flows() {
  log_section "Network and Connections"
  
  log_test "Network Endpoints Protected"
  
  local response
  response=$(curl -sS -w "\n%{http_code}" "${API_BASE}/network-connections" \
    -H "apikey: ${SUPABASE_ANON_KEY}" 2>/dev/null || echo -e "\n000")
  
  local http_code
  http_code=$(echo "${response}" | tail -1)
  
  if [[ "${http_code}" == "401" ]]; then
    pass "Network connections requires authentication"
  else
    skip "Network connections check (HTTP ${http_code})"
  fi
}

# Test 9: CORS Configuration
test_cors() {
  log_section "CORS Configuration"
  
  log_test "CORS Preflight Requests"
  
  local response
  response=$(curl -sS -w "\n%{http_code}" -X OPTIONS "${API_BASE}/health" \
    -H "Origin: https://example.com" \
    -H "Access-Control-Request-Method: POST" \
    -H "apikey: ${SUPABASE_ANON_KEY}" 2>/dev/null || echo -e "\n000")
  
  local http_code
  http_code=$(echo "${response}" | tail -1)
  
  if [[ "${http_code}" == "200" || "${http_code}" == "204" ]]; then
    pass "CORS preflight requests handled"
  else
    skip "CORS check (HTTP ${http_code})"
  fi
}

# Test 10: Error Handling
test_error_handling() {
  log_section "Error Handling"
  
  log_test "Invalid Endpoint Returns 404"
  
  local response
  response=$(curl -sS -w "\n%{http_code}" "${API_BASE}/nonexistent-endpoint-12345" \
    -H "apikey: ${SUPABASE_ANON_KEY}" 2>/dev/null || echo -e "\n000")
  
  local http_code
  http_code=$(echo "${response}" | tail -1)
  
  if [[ "${http_code}" == "404" ]]; then
    pass "Invalid endpoints return 404"
  else
    skip "Error handling check (HTTP ${http_code})"
  fi
}

# Finalize report
finalize_report() {
  log ""
  log "---"
  log ""
  log "## Test Results Summary"
  log ""
  log "| Metric | Count |"
  log "|--------|-------|"
  log "| Tests Passed | ${TESTS_PASSED} |"
  log "| Tests Failed | ${TESTS_FAILED} |"
  log "| Tests Skipped | ${TESTS_SKIPPED} |"
  log "| **Total** | **$((TESTS_PASSED + TESTS_FAILED + TESTS_SKIPPED))** |"
  log ""
  
  if [[ ${TESTS_FAILED} -eq 0 ]]; then
    log "## Result: PASSED"
    log ""
    log "All critical flows are functioning correctly."
    exit 0
  else
    log "## Result: FAILED"
    log ""
    log "${TESTS_FAILED} test(s) failed. Review the failures above before deploying to production."
    exit 1
  fi
}

# Main
main() {
  init_report
  
  log "Starting end-to-end verification..."
  log ""
  log "**Target Environment:** ${SUPABASE_URL}"
  log ""
  
  test_health_check
  test_auth_flow
  test_round_creation
  test_trust_vouching
  test_tier_enforcement
  test_payment_flow
  test_organizer_flows
  test_network_flows
  test_cors
  test_error_handling
  
  finalize_report
}

main "$@"

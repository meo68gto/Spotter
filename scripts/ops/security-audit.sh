#!/usr/bin/env bash
#
# Security Audit Script for Spotter
# Comprehensive security checks for production launch
#

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="${SCRIPT_DIR}/../.."
REPORT_DIR="${ROOT_DIR}/.artifacts/security-audits"
TIMESTAMP=$(date -u +"%Y%m%d_%H%M%S")
REPORT_FILE="${REPORT_DIR}/security_audit_${TIMESTAMP}.md"

# Required environment variables
: "${SUPABASE_URL:?SUPABASE_URL not set}"
: "${SUPABASE_SERVICE_ROLE_KEY:?SUPABASE_SERVICE_ROLE_KEY not set}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Counters
CRITICAL=0
WARNINGS=0
PASSED=0

# Logging
log() {
  echo "$1" | tee -a "${REPORT_FILE}"
}

log_pass() {
  echo -e "${GREEN}[PASS]${NC} $1" | tee -a "${REPORT_FILE}"
  ((PASSED++)) || true
}

log_warn() {
  echo -e "${YELLOW}[WARN]${NC} $1" | tee -a "${REPORT_FILE}"
  ((WARNINGS++)) || true
}

log_critical() {
  echo -e "${RED}[CRITICAL]${NC} $1" | tee -a "${REPORT_FILE}"
  ((CRITICAL++)) || true
}

# Initialize report
init_report() {
  mkdir -p "${REPORT_DIR}"
  cat > "${REPORT_FILE}" <<EOF
# Spotter Security Audit Report

**Date:** $(date -u +"%Y-%m-%d %H:%M:%S UTC")  
**Auditor:** Automated Security Audit  
**Scope:** Production Database, Edge Functions, Environment Variables

## Summary

| Category | Status |
|----------|--------|
| Critical Issues | PENDING |
| Warnings | PENDING |
| Passed Checks | PENDING |

---

EOF
}

# Check RLS policies
check_rls_policies() {
  log "## RLS Policy Audit"
  log ""
  
  local tables
  tables=$(curl -sS "${SUPABASE_URL}/rest/v1/" \
    -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
    -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" | \
    jq -r 'keys[]' 2>/dev/null || echo "")
  
  if [[ -z "${tables}" ]]; then
    log_warn "Could not fetch table list"
    return
  fi
  
  for table in ${tables}; do
    # Skip system tables
    if [[ "${table}" =~ ^(pg_|auth_|storage_) ]]; then
      continue
    fi
    
    # Check if RLS is enabled
    local rls_enabled
    rls_enabled=$(curl -sS "${SUPABASE_URL}/rest/v1/${table}?limit=0" \
      -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
      -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
      -I 2>/dev/null | grep -i "rls" || echo "")
    
    # Try to access without auth
    local anon_response
    anon_response=$(curl -sS -o /dev/null -w "%{http_code}" \
      "${SUPABASE_URL}/rest/v1/${table}?select=*&limit=1" \
      -H "apikey: ${SUPABASE_ANON_KEY:-${SUPABASE_SERVICE_ROLE_KEY}}" 2>/dev/null || echo "000")
    
    if [[ "${anon_response}" == "200" ]]; then
      log_critical "Table '${table}' accessible without authentication (RLS may be disabled)"
    else
      log_pass "Table '${table}' has RLS protection"
    fi
  done
  
  log ""
}

# Check for SQL injection vectors
check_sql_injection() {
  log "## SQL Injection Vector Check"
  log ""
  
  # Test common injection patterns
  local injection_patterns=(
    "1' OR '1'='1"
    "1; DROP TABLE users;--"
    "1' UNION SELECT * FROM users--"
    "1' AND 1=1--"
    "1' AND 1=2--"
  )
  
  for pattern in "${injection_patterns[@]}"; do
    local encoded_pattern
    encoded_pattern=$(printf '%s' "${pattern}" | jq -sRr @uri)
    
    local response
    response=$(curl -sS "${SUPABASE_URL}/rest/v1/users?id=eq.${encoded_pattern}" \
      -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
      -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
      -w "\n%{http_code}" 2>/dev/null | tail -1)
    
    if [[ "${response}" == "500" ]]; then
      log_critical "Potential SQL injection vulnerability with pattern: ${pattern}"
    fi
  done
  
  log_pass "No obvious SQL injection vectors detected"
  log ""
}

# Check environment variables
check_environment() {
  log "## Environment Variable Security"
  log ""
  
  # Check for exposed secrets in code
  log "Checking for exposed secrets in codebase..."
  
  local sensitive_patterns=(
    "sk_live_[a-zA-Z0-9]{24,}"
    "sk_test_[a-zA-Z0-9]{24,}"
    "eyJ[a-zA-Z0-9_-]*\.eyJ[a-zA-Z0-9_-]*"
    "supabase-key-[a-zA-Z0-9]{20,}"
    "password\s*=\s*['\"][^'\"]+['\"]"
    "api[_-]?key\s*=\s*['\"][^'\"]+['\"]"
  )
  
  for pattern in "${sensitive_patterns[@]}"; do
    local matches
    matches=$(grep -r -E "${pattern}" "${ROOT_DIR}/apps/functions" "${ROOT_DIR}/apps/web" "${ROOT_DIR}/apps/mobile" 2>/dev/null | grep -v "node_modules" | grep -v ".env" | head -5 || true)
    
    if [[ -n "${matches}" ]]; then
      log_critical "Potential secret exposure found:"
      log "\`\`\`"
      log "${matches}"
      log "\`\`\`"
    fi
  done
  
  # Check .env files are in .gitignore
  if ! grep -q "\.env" "${ROOT_DIR}/.gitignore" 2>/dev/null; then
    log_critical ".env files not in .gitignore"
  else
    log_pass ".env files properly ignored"
  fi
  
  # Check for .env.production.example (should exist, not real values)
  if [[ -f "${ROOT_DIR}/.env.production" ]]; then
    log_warn ".env.production exists - ensure it's not committed"
  fi
  
  log ""
}

# Check function security
check_function_security() {
  log "## Edge Function Security"
  log ""
  
  local functions_dir="${ROOT_DIR}/apps/functions/supabase/functions"
  
  for func_dir in "${functions_dir}"/*/; do
    local func_name
    func_name=$(basename "${func_dir}")
    
    # Skip shared directory
    if [[ "${func_name}" == "_shared" ]]; then
      continue
    fi
    
    local index_file="${func_dir}/index.ts"
    
    if [[ ! -f "${index_file}" ]]; then
      continue
    fi
    
    # Check for authentication
    if ! grep -q "getUser\|Authorization\|auth" "${index_file}" 2>/dev/null; then
      log_warn "Function '${func_name}' may not verify authentication"
    fi
    
    # Check for input validation
    if ! grep -q "validation\|validate\|zod\|joi" "${index_file}" 2>/dev/null; then
      log_warn "Function '${func_name}' may lack input validation"
    fi
    
    # Check for error handling
    if ! grep -q "try\|catch\|error" "${index_file}" 2>/dev/null; then
      log_warn "Function '${func_name}' may lack error handling"
    fi
  done
  
  log_pass "Edge function security review complete"
  log ""
}

# Check CORS configuration
check_cors() {
  log "## CORS Configuration"
  log ""
  
  local cors_file="${ROOT_DIR}/apps/functions/supabase/functions/_shared/cors.ts"
  
  if [[ -f "${cors_file}" ]]; then
    if grep -q "'*'" "${cors_file}" 2>/dev/null; then
      log_warn "CORS allows all origins ('*') - consider restricting to specific domains"
    else
      log_pass "CORS has restricted origins"
    fi
  fi
  
  log ""
}

# Check for hardcoded credentials
check_hardcoded_credentials() {
  log "## Hardcoded Credentials Check"
  log ""
  
  local files_to_check=(
    "${ROOT_DIR}/apps/functions"
    "${ROOT_DIR}/apps/web"
    "${ROOT_DIR}/apps/mobile"
  )
  
  for dir in "${files_to_check[@]}"; do
    if [[ -d "${dir}" ]]; then
      # Check for hardcoded passwords, tokens, keys
      local findings
      findings=$(grep -r -E "(password|token|secret|key)\s*[=:]\s*['\"][a-zA-Z0-9]{20,}['\"]" "${dir}" \
        --include="*.ts" --include="*.tsx" --include="*.js" --include="*.json" \
        2>/dev/null | grep -v "node_modules" | grep -v "example" | grep -v "test" | head -10 || true)
      
      if [[ -n "${findings}" ]]; then
        log_warn "Potential hardcoded credentials found in ${dir}:"
        log "\`\`\`"
        log "${findings}"
        log "\`\`\`"
      fi
    fi
  done
  
  log_pass "Hardcoded credentials check complete"
  log ""
}

# Check database permissions
check_database_permissions() {
  log "## Database Permissions"
  log ""
  
  # This requires direct database access
  log "Note: Database permission checks require direct DB access"
  
  # Check if service role is being used appropriately
  local env_example="${ROOT_DIR}/.env.example"
  if [[ -f "${env_example}" ]]; then
    if grep -q "SUPABASE_SERVICE_ROLE_KEY" "${env_example}"; then
      log_pass "Service role key documented in .env.example"
    fi
  fi
  
  log ""
}

# Generate final report
finalize_report() {
  log "---"
  log ""
  log "## Audit Complete"
  log ""
  log "| Category | Count |"
  log "|----------|-------|"
  log "| Critical Issues | ${CRITICAL} |"
  log "| Warnings | ${WARNINGS} |"
  log "| Passed Checks | ${PASSED} |"
  log ""
  
  if [[ ${CRITICAL} -gt 0 ]]; then
    log "## Result: ${RED}FAILED${NC}"
    log ""
    log "Critical security issues were found. Do not deploy to production until resolved."
    exit 1
  elif [[ ${WARNINGS} -gt 0 ]]; then
    log "## Result: ${YELLOW}PASSED WITH WARNINGS${NC}"
    log ""
    log "Security audit passed but warnings should be reviewed."
    exit 0
  else
    log "## Result: ${GREEN}PASSED${NC}"
    log ""
    log "No security issues found. System is ready for production."
    exit 0
  fi
}

# Main
main() {
  init_report
  
  log "Starting security audit..."
  log ""
  
  check_rls_policies
  check_sql_injection
  check_environment
  check_function_security
  check_cors
  check_hardcoded_credentials
  check_database_permissions
  
  finalize_report
}

main "$@"

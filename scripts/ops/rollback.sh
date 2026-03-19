#!/usr/bin/env bash
#
# Emergency Rollback Script for Spotter Production
# Quick rollback procedures for critical issues
#

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="${SCRIPT_DIR}/../.."
ARTIFACTS_DIR="${ROOT_DIR}/.artifacts/rollbacks"
TIMESTAMP=$(date -u +"%Y%m%d_%H%M%S")

# Required environment variables
: "${SUPABASE_URL:?SUPABASE_URL not set}"
: "${SUPABASE_SERVICE_ROLE_KEY:?SUPABASE_SERVICE_ROLE_KEY not set}"
: "${SUPABASE_ACCESS_TOKEN:?SUPABASE_ACCESS_TOKEN not set}"
: "${SUPABASE_PROJECT_ID:?SUPABASE_PROJECT_ID not set}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Logging
log() {
  echo -e "[$(date -u +"%Y-%m-%d %H:%M:%S UTC")] $1"
}

error() {
  echo -e "${RED}[ERROR]${NC} $1" >&2
}

warn() {
  echo -e "${YELLOW}[WARN]${NC} $1"
}

success() {
  echo -e "${GREEN}[SUCCESS]${NC} $1"
}

# Usage
usage() {
  cat <<EOF
Usage: $0 <command> [options]

Emergency Rollback Commands:
  functions         Rollback edge functions to previous version
  database          Rollback database to specific migration
  config            Rollback configuration changes
  full              Full system rollback (functions + config)
  status            Check rollback status

Options:
  -t, --target      Target version or migration (required for database)
  -y, --yes         Skip confirmation prompts
  -h, --help        Show this help message

Examples:
  $0 functions
  $0 database --target 20250319102800
  $0 full --yes
  $0 status
EOF
  exit 1
}

# Confirmation prompt
confirm() {
  local message="$1"
  if [[ "${SKIP_CONFIRM:-false}" == "true" ]]; then
    return 0
  fi
  
  echo ""
  echo -e "${RED}WARNING: ${message}${NC}"
  echo "This is a destructive operation that may affect production users."
  read -p "Are you sure you want to continue? Type 'yes' to proceed: " response
  
  if [[ "${response}" != "yes" ]]; then
    log "Rollback cancelled by user"
    exit 0
  fi
}

# Rollback edge functions
rollback_functions() {
  log "Starting edge functions rollback..."
  
  confirm "Rolling back edge functions to previous deployment"
  
  mkdir -p "${ARTIFACTS_DIR}"
  local log_file="${ARTIFACTS_DIR}/rollback_functions_${TIMESTAMP}.log"
  
  # Get current function versions
  log "Fetching current function versions..."
  
  # Deploy previous version using supabase CLI
  # Note: This assumes you have a previous working version in git
  log "Deploying previous function version..."
  
  if [[ -d "${ROOT_DIR}/.git" ]]; then
    # Get the last known good commit (you should tag releases)
    local last_good_commit
    last_good_commit=$(git -C "${ROOT_DIR}" tag -l "release-*" | sort -V | tail -1)
    
    if [[ -z "${last_good_commit}" ]]; then
      error "No release tags found. Cannot determine previous version."
      exit 1
    fi
    
    log "Rolling back to: ${last_good_commit}"
    
    # Stash current changes
    git -C "${ROOT_DIR}" stash push -m "rollback-stash-${TIMESTAMP}"
    
    # Checkout the release tag
    git -C "${ROOT_DIR}" checkout "${last_good_commit}" -- apps/functions/supabase/functions/
    
    # Deploy functions
    cd "${ROOT_DIR}"
    pnpm run deploy:functions 2>&1 | tee -a "${log_file}"
    
    # Restore current changes
    git -C "${ROOT_DIR}" checkout HEAD -- apps/functions/supabase/functions/
    git -C "${ROOT_DIR}" stash pop
    
    success "Edge functions rolled back to ${last_good_commit}"
  else
    error "Git repository not found. Manual rollback required."
    exit 1
  fi
  
  # Verify rollback
  log "Verifying function health..."
  sleep 5
  
  if curl -sf "${SUPABASE_URL}/functions/v1/health" >/devdev/null 2>&1; then
    success "Health check passed"
  else
    error "Health check failed after rollback"
    exit 1
  fi
}

# Rollback database
rollback_database() {
  local target_migration="${1:-}"
  
  if [[ -z "${target_migration}" ]]; then
    error "Database rollback requires a target migration"
    echo "Available migrations:"
    ls -1 "${ROOT_DIR}/supabase/migrations/" | tail -20
    exit 1
  fi
  
  log "Starting database rollback to migration: ${target_migration}"
  
  confirm "Rolling back database to migration ${target_migration}"
  
  mkdir -p "${ARTIFACTS_DIR}"
  local log_file="${ARTIFACTS_DIR}/rollback_database_${TIMESTAMP}.log"
  
  # Create pre-rollback backup
  log "Creating pre-rollback backup..."
  "${SCRIPT_DIR}/backup-database.sh" 2>&1 | tee -a "${log_file}"
  
  # Run database rollback using supabase CLI
  log "Executing database rollback..."
  cd "${ROOT_DIR}"
  
  # This requires the supabase CLI
  if command -v supabase >/dev/null 2>&1; then
    supabase db reset --target "${target_migration}" 2>&1 | tee -a "${log_file}" || {
      error "Database rollback failed. Check ${log_file} for details."
      exit 1
    }
  else
    error "Supabase CLI not found. Manual rollback required."
    exit 1
  fi
  
  success "Database rolled back to migration ${target_migration}"
}

# Rollback configuration
rollback_config() {
  log "Starting configuration rollback..."
  
  confirm "Rolling back environment configuration"
  
  mkdir -p "${ARTIFACTS_DIR}"
  local log_file="${ARTIFACTS_DIR}/rollback_config_${TIMESTAMP}.log"
  
  # Restore from backup if available
  local env_backup
  env_backup=$(find "${ARTIFACTS_DIR}" -name "env_backup_*.env" -type f -mtime -7 | sort -r | head -1)
  
  if [[ -n "${env_backup}" ]]; then
    log "Restoring configuration from: ${env_backup}"
    cp "${env_backup}" "${ROOT_DIR}/.env.production.backup"
    warn "Configuration restored. You must manually update your deployment environment."
  else
    warn "No recent configuration backup found"
  fi
  
  success "Configuration rollback complete"
}

# Full system rollback
rollback_full() {
  log "Starting FULL SYSTEM ROLLBACK..."
  
  confirm "Performing FULL SYSTEM ROLLBACK - This will affect all components"
  
  # Rollback functions first
  rollback_functions
  
  # Rollback config
  rollback_config
  
  # Note: Database rollback is manual to prevent data loss
  warn "Database was NOT rolled back automatically to prevent data loss."
  warn "If database rollback is needed, run: $0 database --target <migration>"
  
  success "Full system rollback complete (except database)"
}

# Check rollback status
check_status() {
  log "Checking system status..."
  
  echo ""
  echo "Health Check"
  echo "============"
  
  # Check health endpoint
  if curl -sf "${SUPABASE_URL}/functions/v1/health" 2>/dev/null | jq .; then
    success "Health endpoint responding"
  else
    error "Health endpoint not responding"
  fi
  
  echo ""
  echo "Recent Rollbacks"
  echo "==============="
  if [[ -d "${ARTIFACTS_DIR}" ]]; then
    ls -lt "${ARTIFACTS_DIR}" | head -10
  else
    echo "No rollback history found"
  fi
  
  echo ""
  echo "Database Migrations"
  echo "=================="
  ls -1 "${ROOT_DIR}/supabase/migrations/" | tail -5
}

# Main
main() {
  local command=""
  local target=""
  SKIP_CONFIRM=false
  
  while [[ $# -gt 0 ]]; do
    case $1 in
      functions|database|config|full|status)
        command="$1"
        shift
        ;;
      -t|--target)
        target="$2"
        shift 2
        ;;
      -y|--yes)
        SKIP_CONFIRM=true
        shift
        ;;
      -h|--help)
        usage
        ;;
      *)
        echo "Unknown option: $1"
        usage
        ;;
    esac
  done
  
  if [[ -z "${command}" ]]; then
    usage
  fi
  
  # Create artifacts directory
  mkdir -p "${ARTIFACTS_DIR}"
  
  case "${command}" in
    functions)
      rollback_functions
      ;;
    database)
      rollback_database "${target}"
      ;;
    config)
      rollback_config
      ;;
    full)
      rollback_full
      ;;
    status)
      check_status
      ;;
    *)
      usage
      ;;
  esac
}

main "$@"

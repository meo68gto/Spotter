#!/bin/bash
#
# restore-production.sh - Restore production database from backup
# Usage: ./scripts/restore-production.sh --from-file BACKUP_FILE [--force]
#
# ⚠️  WARNING: This will OVERWRITE production data!
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
BACKUP_FILE=""
FORCE=false

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --from-file)
            BACKUP_FILE="$2"
            shift 2
            ;;
        --force)
            FORCE=true
            shift
            ;;
        --help)
            echo "Usage: restore-production.sh --from-file BACKUP_FILE [--force]"
            echo ""
            echo "Options:"
            echo "  --from-file FILE   Backup file to restore from (required)"
            echo "  --force            Skip confirmation prompts"
            echo "  --help             Show this help message"
            echo ""
            echo "Examples:"
            echo "  ./scripts/restore-production.sh --from-file backups/full-20240318-120000.sql.gz"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    if ! command -v supabase > /dev/null 2>&1; then
        log_error "Supabase CLI is not installed!"
        exit 1
    fi
    
    if [[ -z "$SUPABASE_ACCESS_TOKEN" ]]; then
        log_error "SUPABASE_ACCESS_TOKEN is not set!"
        exit 1
    fi
    
    if [[ -z "$SUPABASE_PROJECT_ID" ]]; then
        log_error "SUPABASE_PROJECT_ID is not set!"
        exit 1
    fi
    
    if [[ -z "$BACKUP_FILE" ]]; then
        log_error "Backup file not specified!"
        log_info "Use --from-file to specify the backup file"
        exit 1
    fi
    
    if [[ ! -f "$BACKUP_FILE" ]]; then
        log_error "Backup file not found: $BACKUP_FILE"
        exit 1
    fi
    
    log_success "Prerequisites check passed"
}

# Confirm restore
confirm_restore() {
    if [[ "$FORCE" == true ]]; then
        return 0
    fi
    
    echo ""
    log_warning "⚠️  PRODUCTION DATABASE RESTORE ⚠️"
    echo ""
    log_error "You are about to RESTORE production data!"
    echo ""
    echo "This will:"
    echo "  1. OVERWRITE all current production data"
    echo "  2. Replace it with data from: $BACKUP_FILE"
    echo "  3. This action CANNOT be undone"
    echo ""
    echo "Backup file: $BACKUP_FILE"
    echo "Size: $(du -h "$BACKUP_FILE" | cut -f1)"
    echo ""
    read -p "Type 'RESTORE' to proceed: " confirm
    
    if [[ "$confirm" != "RESTORE" ]]; then
        log_info "Restore cancelled"
        exit 0
    fi
}

# Restore database
restore_database() {
    log_info "Restoring database..."
    
    cd "${PROJECT_ROOT}/apps/functions"
    
    # Link project
    supabase link --project-ref "$SUPABASE_PROJECT_ID"
    
    # Handle compressed backups
    if [[ "$BACKUP_FILE" == *.gz ]]; then
        log_info "Decompressing backup..."
        gunzip -c "$BACKUP_FILE" | supabase db restore
    else
        supabase db restore < "$BACKUP_FILE"
    fi
    
    log_success "Database restored"
}

# Verify restore
verify_restore() {
    log_info "Verifying restore..."
    
    # Run health check
    "${PROJECT_ROOT}/scripts/verify-deployment.sh" production
    
    log_success "Restore verified"
}

# Main execution
main() {
    echo "========================================"
    echo "  Production Database Restore"
    echo "========================================"
    echo ""
    
    check_prerequisites
    confirm_restore
    restore_database
    verify_restore
    
    echo ""
    echo "========================================"
    log_success "Restore completed!"
    echo "========================================"
}

# Handle errors
trap 'log_error "Restore failed! Check logs above."' ERR

# Run main function
main

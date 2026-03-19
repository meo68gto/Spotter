#!/bin/bash
#
# backup-production.sh - Create production database backup
# Usage: ./scripts/backup-production.sh [--full] [--schema-only]
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
FULL_BACKUP=true
SCHEMA_ONLY=false

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --schema-only)
            SCHEMA_ONLY=true
            FULL_BACKUP=false
            shift
            ;;
        --help)
            echo "Usage: backup-production.sh [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --schema-only    Backup schema only (no data)"
            echo "  --help           Show this help message"
            echo ""
            echo "Examples:"
            echo "  ./scripts/backup-production.sh"
            echo "  ./scripts/backup-production.sh --schema-only"
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
    
    log_success "Prerequisites check passed"
}

# Create backup
create_backup() {
    log_info "Creating backup..."
    
    BACKUP_DIR="${PROJECT_ROOT}/backups"
    mkdir -p "$BACKUP_DIR"
    
    TIMESTAMP=$(date +%Y%m%d-%H%M%S)
    
    if [[ "$SCHEMA_ONLY" == true ]]; then
        BACKUP_FILE="${BACKUP_DIR}/schema-${TIMESTAMP}.sql"
        log_info "Creating schema-only backup..."
        
        cd "${PROJECT_ROOT}/apps/functions"
        supabase db dump --schema-only > "$BACKUP_FILE"
    else
        BACKUP_FILE="${BACKUP_DIR}/full-${TIMESTAMP}.sql"
        log_info "Creating full backup..."
        
        cd "${PROJECT_ROOT}/apps/functions"
        supabase db dump > "$BACKUP_FILE"
    fi
    
    # Compress backup
    gzip "$BACKUP_FILE"
    BACKUP_FILE="${BACKUP_FILE}.gz"
    
    log_success "Backup created: $BACKUP_FILE"
    log_info "Size: $(du -h "$BACKUP_FILE" | cut -f1)"
}

# Cleanup old backups
cleanup_old_backups() {
    log_info "Cleaning up old backups..."
    
    BACKUP_DIR="${PROJECT_ROOT}/backups"
    
    # Keep last 7 days of backups
    find "$BACKUP_DIR" -name "*.gz" -mtime +7 -delete
    
    log_success "Old backups cleaned up"
}

# Main execution
main() {
    echo "========================================"
    echo "  Production Database Backup"
    echo "========================================"
    echo ""
    
    check_prerequisites
    create_backup
    cleanup_old_backups
    
    echo ""
    echo "========================================"
    log_success "Backup completed!"
    echo "========================================"
}

# Handle errors
trap 'log_error "Backup failed! Check logs above."' ERR

# Run main function
main

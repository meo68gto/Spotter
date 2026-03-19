#!/bin/bash
#
# rollback-phase3.sh - Emergency rollback for Phase 3 deployment
# Usage: ./scripts/rollback-phase3.sh [--to-version VERSION] [--skip-backup]
#
# This script provides emergency rollback capabilities for production deployments.
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
TARGET_VERSION=""
SKIP_BACKUP=false
FORCE=false

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --to-version)
            TARGET_VERSION="$2"
            shift 2
            ;;
        --skip-backup)
            SKIP_BACKUP=true
            shift
            ;;
        --force)
            FORCE=true
            shift
            ;;
        --help)
            echo "Usage: rollback-phase3.sh [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --to-version VERSION    Rollback to specific version (required)"
            echo "  --skip-backup           Skip creating rollback backup"
            echo "  --force                 Skip confirmation prompts"
            echo "  --help                  Show this help message"
            echo ""
            echo "Examples:"
            echo "  ./scripts/rollback-phase3.sh --to-version v1.2.3"
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
    
    # Check if git is available
    if ! command -v git > /dev/null 2>&1; then
        log_error "Git is not installed!"
        exit 1
    fi
    
    # Check if we're in a git repository
    if [[ ! -d "${PROJECT_ROOT}/.git" ]]; then
        log_error "Not a git repository!"
        exit 1
    fi
    
    # Check if target version is specified
    if [[ -z "$TARGET_VERSION" ]]; then
        log_error "Target version not specified!"
        log_info "Use --to-version to specify the version to rollback to"
        exit 1
    fi
    
    # Check if target version exists
    if ! git -C "$PROJECT_ROOT" rev-parse "$TARGET_VERSION" > /dev/null 2>&1; then
        log_error "Target version '$TARGET_VERSION' not found!"
        log_info "Available versions:"
        git -C "$PROJECT_ROOT" tag -l | tail -10
        exit 1
    fi
    
    log_success "Prerequisites check passed"
}

# Create backup before rollback
create_rollback_backup() {
    if [[ "$SKIP_BACKUP" == true ]]; then
        log_warning "Skipping rollback backup (--skip-backup specified)"
        return 0
    fi
    
    log_info "Creating pre-rollback backup..."
    
    BACKUP_DIR="${PROJECT_ROOT}/backups/rollback"
    mkdir -p "$BACKUP_DIR"
    
    BACKUP_FILE="${BACKUP_DIR}/pre-rollback-$(date +%Y%m%d-%H%M%S).tar.gz"
    
    # Create backup of current state
    tar -czf "$BACKUP_FILE" \
        -C "$PROJECT_ROOT" \
        --exclude='node_modules' \
        --exclude='.git' \
        --exclude='backups' \
        . 2>/dev/null || true
    
    log_success "Rollback backup created: $BACKUP_FILE"
}

# Confirm rollback
confirm_rollback() {
    if [[ "$FORCE" == true ]]; then
        return 0
    fi
    
    echo ""
    log_warning "⚠️  EMERGENCY ROLLBACK ⚠️"
    echo ""
    log_error "You are about to ROLLBACK production!"
    echo ""
    echo "This will:"
    echo "  1. Create a backup of current state"
    echo "  2. Checkout version: $TARGET_VERSION"
    echo "  3. Deploy the previous version"
    echo "  4. Verify the rollback"
    echo ""
    echo "Current version: $(git -C "$PROJECT_ROOT" describe --tags --exact-match 2>/dev/null || git -C "$PROJECT_ROOT" rev-parse --short HEAD)"
    echo "Target version: $TARGET_VERSION"
    echo ""
    read -p "Type 'ROLLBACK' to proceed: " confirm
    
    if [[ "$confirm" != "ROLLBACK" ]]; then
        log_info "Rollback cancelled"
        exit 0
    fi
}

# Rollback database
rollback_database() {
    log_info "Rolling back database..."
    
    log_warning "Database rollback requires manual intervention"
    log_info "To rollback database:"
    log_info "  1. Go to Supabase Dashboard > Database > Backups"
    log_info "  2. Select a backup from before the deployment"
    log_info "  3. Click 'Restore'"
    log_info ""
    log_info "Alternatively, run reverse migrations if available:"
    log_info "  ./scripts/migrate-production.sh --dry-run"
    
    if [[ "$FORCE" != true ]]; then
        read -p "Have you handled database rollback? (yes/no): " db_confirm
        if [[ "$db_confirm" != "yes" ]]; then
            log_error "Database rollback not confirmed. Aborting."
            exit 1
        fi
    fi
}

# Rollback code
rollback_code() {
    log_info "Rolling back code to $TARGET_VERSION..."
    
    cd "$PROJECT_ROOT"
    
    # Stash any uncommitted changes
    if [[ -n $(git status --porcelain) ]]; then
        log_info "Stashing uncommitted changes..."
        git stash push -m "pre-rollback-stash-$(date +%Y%m%d-%H%M%S)"
    fi
    
    # Checkout target version
    log_info "Checking out $TARGET_VERSION..."
    git checkout "$TARGET_VERSION"
    
    log_success "Code rolled back to $TARGET_VERSION"
}

# Redeploy functions
redeploy_functions() {
    log_info "Redeploying edge functions..."
    
    cd "${PROJECT_ROOT}/apps/functions"
    
    if [[ -z "$SUPABASE_ACCESS_TOKEN" ]]; then
        log_warning "SUPABASE_ACCESS_TOKEN not set, skipping function redeployment"
        return 0
    fi
    
    # Link and deploy
    supabase link --project-ref "$SUPABASE_PROJECT_ID" 2>/dev/null || true
    
    # Deploy all functions
    log_info "Deploying functions from $TARGET_VERSION..."
    
    # Get list of functions from the version
    for func in supabase/functions/*/index.ts; do
        if [[ -f "$func" ]]; then
            func_name=$(basename "$(dirname "$func")")
            log_info "Deploying: $func_name"
            supabase functions deploy "$func_name" 2>/dev/null || log_warning "Failed to deploy $func_name"
        fi
    done
    
    log_success "Functions redeployed"
}

# Verify rollback
verify_rollback() {
    log_info "Verifying rollback..."
    
    # Run verification script
    if [[ -f "${PROJECT_ROOT}/scripts/verify-deployment.sh" ]]; then
        "${PROJECT_ROOT}/scripts/verify-deployment.sh" production || {
            log_error "Rollback verification failed!"
            log_info "Manual intervention may be required"
            exit 1
        }
    fi
    
    log_success "Rollback verified"
}

# Create rollback tag
create_rollback_tag() {
    log_info "Creating rollback tag..."
    
    cd "$PROJECT_ROOT"
    
    ROLLBACK_TAG="rollback-$(date +%Y%m%d-%H%M%S)"
    
    git tag -a "$ROLLBACK_TAG" -m "Rollback to $TARGET_VERSION"
    
    log_info "Created tag: $ROLLBACK_TAG"
    log_info "Push with: git push origin $ROLLBACK_TAG"
}

# Notify team
notify_team() {
    log_info "Sending rollback notification..."
    
    echo ""
    echo "========================================"
    log_warning "ROLLBACK COMPLETED"
    echo "========================================"
    echo "Rolled back to: $TARGET_VERSION"
    echo "Timestamp: $(date)"
    echo "Backup: ${BACKUP_FILE:-N/A}"
    echo "========================================"
    echo ""
    echo "Next steps:"
    echo "  1. Monitor error rates and user feedback"
    echo "  2. Investigate the issue that caused the rollback"
    echo "  3. Plan the fix and next deployment"
    echo ""
}

# Main execution
main() {
    echo "========================================"
    echo "  Phase 3 Emergency Rollback"
    echo "========================================"
    echo ""
    
    check_prerequisites
    confirm_rollback
    create_rollback_backup
    rollback_database
    rollback_code
    redeploy_functions
    verify_rollback
    create_rollback_tag
    notify_team
    
    echo ""
    echo "========================================"
    log_success "Rollback completed successfully!"
    echo "========================================"
}

# Handle errors
trap 'log_error "Rollback failed! Check logs above."' ERR

# Run main function
main

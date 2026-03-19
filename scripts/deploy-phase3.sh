#!/bin/bash
#
# deploy-phase3.sh - Phase 3 Production Deployment
# Usage: ./scripts/deploy-phase3.sh [--skip-tests] [--force] [--dry-run]
#
# This script orchestrates the complete Phase 3 production deployment.
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
SKIP_TESTS=false
FORCE=false
DRY_RUN=false

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --skip-tests)
            SKIP_TESTS=true
            shift
            ;;
        --force)
            FORCE=true
            shift
            ;;
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        --help)
            echo "Usage: deploy-phase3.sh [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --skip-tests    Skip running tests"
            echo "  --force         Skip confirmation prompts"
            echo "  --dry-run       Show what would be deployed"
            echo "  --help          Show this help message"
            echo ""
            echo "Examples:"
            echo "  ./scripts/deploy-phase3.sh --dry-run"
            echo "  ./scripts/deploy-phase3.sh --force"
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

log_section() {
    echo ""
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}  $1${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

# Check prerequisites
check_prerequisites() {
    log_section "Prerequisites Check"
    
    # Check if we're on main branch
    CURRENT_BRANCH=$(git -C "${PROJECT_ROOT}" rev-parse --abbrev-ref HEAD)
    if [[ "$CURRENT_BRANCH" != "main" ]]; then
        log_error "Not on main branch! Current branch: $CURRENT_BRANCH"
        exit 1
    fi
    log_success "On main branch"
    
    # Check if working directory is clean
    if [[ -n $(git -C "${PROJECT_ROOT}" status --porcelain) ]]; then
        log_error "Working directory is not clean!"
        exit 1
    fi
    log_success "Working directory clean"
    
    # Check required files exist
    if [[ ! -f "${PROJECT_ROOT}/.env.production" ]]; then
        log_error ".env.production file not found!"
        exit 1
    fi
    log_success ".env.production exists"
    
    # Check required scripts exist
    local required_scripts=(
        "migrate-production.sh"
        "verify-deployment.sh"
        "backup-production.sh"
    )
    
    for script in "${required_scripts[@]}"; do
        if [[ ! -f "${PROJECT_ROOT}/scripts/${script}" ]]; then
            log_error "Required script not found: ${script}"
            exit 1
        fi
    done
    log_success "All required scripts present"
    
    log_success "Prerequisites check passed"
}

# Run tests
run_tests() {
    if [[ "$SKIP_TESTS" == true ]]; then
        log_warning "Skipping tests (--skip-tests specified)"
        return 0
    fi
    
    log_section "Running Tests"
    
    cd "${PROJECT_ROOT}"
    
    # Install dependencies
    log_info "Installing dependencies..."
    pnpm install --frozen-lockfile=false
    
    # Run linting
    log_info "Running linter..."
    pnpm lint
    
    # Run type checking
    log_info "Running type check..."
    pnpm typecheck
    
    # Run unit tests
    log_info "Running unit tests..."
    pnpm test
    
    # Run release preflight
    log_info "Running release preflight..."
    pnpm release:preflight
    
    log_success "All tests passed"
}

# Create backup
create_backup() {
    log_section "Creating Backup"
    
    if [[ "$DRY_RUN" == true ]]; then
        log_warning "DRY RUN: Would create backup"
        return 0
    fi
    
    "${PROJECT_ROOT}/scripts/backup-production.sh"
    
    log_success "Backup completed"
}

# Run migrations
run_migrations() {
    log_section "Database Migrations"
    
    if [[ "$DRY_RUN" == true ]]; then
        log_warning "DRY RUN: Would run migrations"
        "${PROJECT_ROOT}/scripts/migrate-production.sh" --dry-run
        return 0
    fi
    
    "${PROJECT_ROOT}/scripts/migrate-production.sh" --force
    
    log_success "Migrations completed"
}

# Deploy application
deploy_application() {
    log_section "Application Deployment"
    
    if [[ "$DRY_RUN" == true ]]; then
        log_warning "DRY RUN: Would deploy application"
        log_info "Would trigger GitHub Actions workflow"
        return 0
    fi
    
    cd "${PROJECT_ROOT}"
    
    # Create deployment tag
    DEPLOY_TAG="v$(date +%Y.%m.%d-%H%M%S)"
    log_info "Creating deployment tag: $DEPLOY_TAG"
    
    git tag -a "$DEPLOY_TAG" -m "Phase 3 Production Deployment"
    
    # Push tag to trigger deployment
    log_info "Pushing tag to trigger deployment..."
    git push origin "$DEPLOY_TAG"
    
    log_success "Deployment triggered via tag: $DEPLOY_TAG"
    log_info "Monitor deployment at: https://github.com/$(git remote get-url origin | sed 's/.*github.com[:/]\([^/]*\/[^/]*\).*/\1/')/actions"
}

# Verify deployment
verify_deployment() {
    log_section "Deployment Verification"
    
    if [[ "$DRY_RUN" == true ]]; then
        log_warning "DRY RUN: Would verify deployment"
        return 0
    fi
    
    log_info "Waiting for deployment to propagate (60 seconds)..."
    sleep 60
    
    "${PROJECT_ROOT}/scripts/verify-deployment.sh" production --verbose
    
    log_success "Deployment verified"
}

# Create deployment record
create_deployment_record() {
    log_section "Deployment Record"
    
    DEPLOY_DIR="${PROJECT_ROOT}/deployments"
    mkdir -p "$DEPLOY_DIR"
    
    DEPLOY_FILE="${DEPLOY_DIR}/deploy-$(date +%Y%m%d-%H%M%S).md"
    
    cat > "$DEPLOY_FILE" << EOF
# Deployment Record

**Date:** $(date)
**Tag:** ${DEPLOY_TAG:-N/A}
**Environment:** Production
**Dry Run:** ${DRY_RUN}

## Changes

$(git log --oneline --no-decorate -10 2>/dev/null || echo "See git log")

## Verification

- [ ] Health checks passing
- [ ] Database migrations applied
- [ ] Edge functions deployed
- [ ] Smoke tests passing

## Notes

$(if [[ "$DRY_RUN" == true ]]; then echo "This was a DRY RUN - no actual deployment occurred"; fi)
EOF
    
    log_success "Deployment record created: $DEPLOY_FILE"
}

# Confirm deployment
confirm_deployment() {
    if [[ "$FORCE" == true ]]; then
        return 0
    fi
    
    echo ""
    log_warning "⚠️  PHASE 3 PRODUCTION DEPLOYMENT ⚠️"
    echo ""
    log_error "You are about to deploy to PRODUCTION!"
    echo ""
    echo "This will:"
    echo "  1. Run all tests"
    echo "  2. Create database backup"
    echo "  3. Apply database migrations"
    echo "  4. Deploy application code"
    echo "  5. Verify deployment"
    echo ""
    
    if [[ "$DRY_RUN" == true ]]; then
        echo "Mode: DRY RUN (no changes will be made)"
    else
        echo "Mode: LIVE (changes WILL be made)"
    fi
    
    echo ""
    read -p "Type 'DEPLOY' to proceed: " confirm
    
    if [[ "$confirm" != "DEPLOY" ]]; then
        log_info "Deployment cancelled"
        exit 0
    fi
}

# Main execution
main() {
    echo "========================================"
    echo "  Phase 3 Production Deployment"
    echo "========================================"
    echo ""
    
    if [[ "$DRY_RUN" == true ]]; then
        log_warning "DRY RUN MODE - No changes will be made"
        echo ""
    fi
    
    check_prerequisites
    confirm_deployment
    run_tests
    create_backup
    run_migrations
    deploy_application
    verify_deployment
    create_deployment_record
    
    echo ""
    echo "========================================"
    log_success "Phase 3 deployment completed!"
    echo "========================================"
    echo ""
    
    if [[ "$DRY_RUN" == true ]]; then
        echo "This was a DRY RUN. To deploy for real, run without --dry-run"
    else
        echo "Next steps:"
        echo "  1. Monitor deployment in GitHub Actions"
        echo "  2. Watch error rates in Sentry"
        echo "  3. Verify user-facing functionality"
        echo "  4. Update status page if applicable"
    fi
}

# Handle errors
trap 'log_error "Deployment failed! Check logs above."' ERR

# Run main function
main

#!/bin/bash
#
# rollback.sh - Emergency rollback script
# Usage: ./scripts/rollback.sh [environment] [--to-version VERSION]
#
# Environments: staging (default), production
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
ENVIRONMENT="staging"
TARGET_VERSION=""

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --to-version)
            TARGET_VERSION="$2"
            shift 2
            ;;
        --help)
            echo "Usage: rollback.sh [environment] [--to-version VERSION]"
            echo ""
            echo "Environments: staging (default), production"
            echo ""
            echo "Options:"
            echo "  --to-version VERSION    Rollback to specific version/tag"
            echo "  --help                  Show this help message"
            echo ""
            echo "Examples:"
            echo "  ./scripts/rollback.sh staging"
            echo "  ./scripts/rollback.sh production --to-version v1.2.3"
            exit 0
            ;;
        -*)
            echo "Unknown option: $1"
            exit 1
            ;;
        *)
            ENVIRONMENT=$1
            shift
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

# Validate environment
validate_environment() {
    case $ENVIRONMENT in
        staging|production)
            log_info "Environment: $ENVIRONMENT"
            ;;
        *)
            log_error "Invalid environment: $ENVIRONMENT"
            log_info "Valid environments: staging, production"
            exit 1
            ;;
    esac
}

# Emergency confirmation
confirm_rollback() {
    echo ""
    log_warning "⚠️  EMERGENCY ROLLBACK INITIATED ⚠️"
    echo ""
    log_error "You are about to ROLLBACK the $ENVIRONMENT environment!"
    echo ""
    echo "This will:"
    echo "  1. Stop the current deployment"
    echo "  2. Restore the previous stable version"
    echo "  3. Verify the rollback was successful"
    echo ""
    
    if [[ -n "$TARGET_VERSION" ]]; then
        echo "Target version: $TARGET_VERSION"
    else
        echo "Target: Previous stable version"
    fi
    echo ""
    
    read -p "Type 'ROLLBACK' to confirm: " confirm
    
    if [[ "$confirm" != "ROLLBACK" ]]; then
        log_info "Rollback cancelled"
        exit 0
    fi
}

# Get previous version
get_previous_version() {
    log_info "Getting previous stable version..."
    
    cd "${PROJECT_ROOT}"
    
    if [[ -n "$TARGET_VERSION" ]]; then
        log_info "Using specified version: $TARGET_VERSION"
        return 0
    fi
    
    # Get the previous tag
    PREVIOUS_TAG=$(git describe --tags --abbrev=0 HEAD^ 2>/dev/null || echo "")
    
    if [[ -z "$PREVIOUS_TAG" ]]; then
        log_error "Could not determine previous version"
        log_info "Please specify a version with --to-version"
        exit 1
    fi
    
    TARGET_VERSION="$PREVIOUS_TAG"
    log_info "Previous version: $TARGET_VERSION"
}

# Rollback staging
rollback_staging() {
    log_info "Rolling back staging..."
    cd "${PROJECT_ROOT}"
    
    # Stop current containers
    log_info "Stopping current deployment..."
    docker-compose -f docker-compose.staging.yml down
    
    # Checkout previous version
    log_info "Checking out previous version: $TARGET_VERSION"
    git checkout "$TARGET_VERSION"
    
    # Rebuild and restart
    log_info "Rebuilding and restarting..."
    docker-compose -f docker-compose.staging.yml up -d --build
    
    # Wait for health check
    log_info "Waiting for health check..."
    sleep 10
    
    MAX_RETRIES=30
    RETRY_COUNT=0
    
    while [[ $RETRY_COUNT -lt $MAX_RETRIES ]]; do
        if curl -sf http://localhost:3000/api/health > /dev/null 2>&1; then
            log_success "Staging rollback successful!"
            break
        fi
        
        RETRY_COUNT=$((RETRY_COUNT + 1))
        log_info "Health check attempt $RETRY_COUNT/$MAX_RETRIES..."
        sleep 5
    done
    
    if [[ $RETRY_COUNT -eq $MAX_RETRIES ]]; then
        log_error "Health check failed after rollback!"
        log_error "Manual intervention required!"
        exit 1
    fi
}

# Rollback production
rollback_production() {
    log_info "Rolling back production..."
    cd "${PROJECT_ROOT}"
    
    # For production, we trigger the GitHub Actions workflow with the target version
    log_info "Triggering production rollback to: $TARGET_VERSION"
    
    # Create a rollback tag
    ROLLBACK_TAG="rollback-$(date +%Y%m%d-%H%M%S)"
    log_info "Creating rollback tag: $ROLLBACK_TAG"
    
    # Tag the previous version
    git tag -a "$ROLLBACK_TAG" -m "Rollback to $TARGET_VERSION"
    git push origin "$ROLLBACK_TAG"
    
    log_success "Production rollback triggered via GitHub Actions"
    log_info "Monitor the deployment at: https://github.com/$(git remote get-url origin | sed 's/.*github.com[:/]\([^/]*\/[^/]*\).*/\1/')/actions"
}

# Post-rollback verification
post_rollback_verification() {
    log_info "Running post-rollback verification..."
    
    # Run smoke tests
    if [[ -f "${PROJECT_ROOT}/scripts/smoke/${ENVIRONMENT}-integration-smoke.sh" ]]; then
        log_info "Running smoke tests..."
        bash "${PROJECT_ROOT}/scripts/smoke/${ENVIRONMENT}-integration-smoke.sh" || {
            log_error "Smoke tests failed after rollback!"
            log_error "Manual intervention required!"
            exit 1
        }
    fi
    
    log_success "Post-rollback verification completed"
}

# Notify team
notify_team() {
    log_info "Sending rollback notification..."
    
    # This would integrate with your notification system (Slack, PagerDuty, etc.)
    echo ""
    echo "========================================"
    log_warning "ROLLBACK COMPLETED"
    echo "========================================"
    echo "Environment: $ENVIRONMENT"
    echo "Rolled back to: $TARGET_VERSION"
    echo "Time: $(date)"
    echo "========================================"
    echo ""
}

# Main execution
main() {
    echo "========================================"
    echo "  Spotter Emergency Rollback"
    echo "========================================"
    echo ""
    
    validate_environment
    confirm_rollback
    get_previous_version
    
    case $ENVIRONMENT in
        staging)
            rollback_staging
            ;;
        production)
            rollback_production
            ;;
    esac
    
    post_rollback_verification
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

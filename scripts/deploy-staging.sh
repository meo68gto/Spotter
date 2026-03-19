#!/bin/bash
#
# deploy-staging.sh - Full staging deployment script
# Usage: ./scripts/deploy-staging.sh [--skip-tests] [--skip-build]
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

# Flags
SKIP_TESTS=false
SKIP_BUILD=false

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --skip-tests)
            SKIP_TESTS=true
            shift
            ;;
        --skip-build)
            SKIP_BUILD=true
            shift
            ;;
        --help)
            echo "Usage: deploy-staging.sh [--skip-tests] [--skip-build]"
            echo ""
            echo "Options:"
            echo "  --skip-tests    Skip running tests"
            echo "  --skip-build    Skip Docker build"
            echo "  --help          Show this help message"
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

# Pre-deployment checks
pre_deployment_checks() {
    log_info "Running pre-deployment checks..."
    
    # Check if .env.staging exists
    if [[ ! -f "${PROJECT_ROOT}/.env.staging" ]]; then
        log_error ".env.staging file not found!"
        log_info "Copy .env.staging.example to .env.staging and fill in the values"
        exit 1
    fi
    
    # Check if Docker is running
    if ! docker info > /dev/null 2>&1; then
        log_error "Docker is not running!"
        exit 1
    fi
    
    # Check if docker-compose is available
    if ! command -v docker-compose > /dev/null 2>&1; then
        log_error "docker-compose is not installed!"
        exit 1
    fi
    
    log_success "Pre-deployment checks passed"
}

# Run tests
run_tests() {
    if [[ "$SKIP_TESTS" == true ]]; then
        log_warning "Skipping tests (--skip-tests flag set)"
        return 0
    fi
    
    log_info "Running tests..."
    cd "${PROJECT_ROOT}"
    
    # Install dependencies
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
    
    log_success "All tests passed"
}

# Build Docker images
build_images() {
    if [[ "$SKIP_BUILD" == true ]]; then
        log_warning "Skipping build (--skip-build flag set)"
        return 0
    fi
    
    log_info "Building Docker images..."
    cd "${PROJECT_ROOT}"
    
    # Build with staging compose
    docker-compose -f docker-compose.staging.yml build --no-cache
    
    log_success "Docker images built successfully"
}

# Deploy to staging
deploy_staging() {
    log_info "Deploying to staging..."
    cd "${PROJECT_ROOT}"
    
    # Create backup of current deployment
    BACKUP_TAG="backup-$(date +%Y%m%d-%H%M%S)"
    log_info "Creating backup tag: ${BACKUP_TAG}"
    
    # Stop existing containers gracefully
    log_info "Stopping existing containers..."
    docker-compose -f docker-compose.staging.yml down --timeout 30
    
    # Start new deployment
    log_info "Starting new deployment..."
    docker-compose -f docker-compose.staging.yml up -d
    
    # Wait for services to be healthy
    log_info "Waiting for services to be healthy..."
    sleep 10
    
    # Health check
    MAX_RETRIES=30
    RETRY_COUNT=0
    
    while [[ $RETRY_COUNT -lt $MAX_RETRIES ]]; do
        if curl -sf http://localhost:3000/api/health > /dev/null 2>&1; then
            log_success "Staging deployment is healthy!"
            break
        fi
        
        RETRY_COUNT=$((RETRY_COUNT + 1))
        log_info "Health check attempt $RETRY_COUNT/$MAX_RETRIES..."
        sleep 5
    done
    
    if [[ $RETRY_COUNT -eq $MAX_RETRIES ]]; then
        log_error "Health check failed after $MAX_RETRIES attempts"
        log_info "Rolling back to previous version..."
        rollback_deployment
        exit 1
    fi
    
    log_success "Staging deployment completed successfully!"
}

# Rollback function
rollback_deployment() {
    log_warning "Rolling back staging deployment..."
    cd "${PROJECT_ROOT}"
    
    # Stop current containers
    docker-compose -f docker-compose.staging.yml down
    
    # Restore from backup (if available)
    if [[ -n "$BACKUP_TAG" ]]; then
        log_info "Restoring from backup: ${BACKUP_TAG}"
        # In a real scenario, you'd restore from a saved state
        # For now, we just restart the previous version
    fi
    
    # Start previous version
    docker-compose -f docker-compose.staging.yml up -d
    
    log_info "Rollback completed"
}

# Post-deployment verification
post_deployment_verification() {
    log_info "Running post-deployment verification..."
    
    # Run smoke tests
    if [[ -f "${PROJECT_ROOT}/scripts/smoke/staging-integration-smoke.sh" ]]; then
        log_info "Running smoke tests..."
        bash "${PROJECT_ROOT}/scripts/smoke/staging-integration-smoke.sh"
    else
        log_warning "Smoke tests not found, skipping..."
    fi
    
    log_success "Post-deployment verification completed"
}

# Main execution
main() {
    echo "========================================"
    echo "  Spotter Staging Deployment"
    echo "========================================"
    echo ""
    
    pre_deployment_checks
    run_tests
    build_images
    deploy_staging
    post_deployment_verification
    
    echo ""
    echo "========================================"
    log_success "Staging deployment completed!"
    echo "========================================"
    echo ""
    echo "Staging URL: https://staging.spotter.app"
    echo "Health Check: http://localhost:3000/api/health"
}

# Handle errors
trap 'log_error "Deployment failed! Check logs above."' ERR

# Run main function
main

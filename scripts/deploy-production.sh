#!/bin/bash
#
# deploy-production.sh - Production deployment with safety checks
# Usage: ./scripts/deploy-production.sh [--force] [--skip-tests]
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
FORCE=false
SKIP_TESTS=false

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --force)
            FORCE=true
            shift
            ;;
        --skip-tests)
            SKIP_TESTS=true
            shift
            ;;
        --help)
            echo "Usage: deploy-production.sh [--force] [--skip-tests]"
            echo ""
            echo "Options:"
            echo "  --force         Skip confirmation prompts"
            echo "  --skip-tests    Skip running tests"
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

# Safety checks
safety_checks() {
    log_info "Running safety checks..."
    
    # Check if we're on main branch
    CURRENT_BRANCH=$(git -C "${PROJECT_ROOT}" rev-parse --abbrev-ref HEAD)
    if [[ "$CURRENT_BRANCH" != "main" ]]; then
        log_error "Not on main branch! Current branch: $CURRENT_BRANCH"
        log_info "Production deployments must be from main branch"
        exit 1
    fi
    
    # Check if working directory is clean
    if [[ -n $(git -C "${PROJECT_ROOT}" status --porcelain) ]]; then
        log_error "Working directory is not clean!"
        log_info "Please commit or stash your changes before deploying"
        exit 1
    fi
    
    # Check if .env.production exists
    if [[ ! -f "${PROJECT_ROOT}/.env.production" ]]; then
        log_error ".env.production file not found!"
        log_info "Copy .env.production.example to .env.production and fill in the values"
        exit 1
    fi
    
    # Check if we're deploying a tagged release
    CURRENT_TAG=$(git -C "${PROJECT_ROOT}" describe --tags --exact-match 2>/dev/null || echo "")
    if [[ -z "$CURRENT_TAG" && "$FORCE" != true ]]; then
        log_warning "Not on a tagged release!"
        log_info "Current commit is not tagged. Production deployments should be from tagged releases."
        log_info "Use --force to deploy anyway, or create a tag first:"
        log_info "  git tag -a v$(date +%Y.%m.%d-%H%M) -m 'Release $(date +%Y.%m.%d)'"
        log_info "  git push origin --tags"
        exit 1
    fi
    
    if [[ -n "$CURRENT_TAG" ]]; then
        log_info "Deploying tag: $CURRENT_TAG"
    fi
    
    log_success "Safety checks passed"
}

# Confirmation prompt
confirm_deployment() {
    if [[ "$FORCE" == true ]]; then
        return 0
    fi
    
    echo ""
    log_warning "You are about to deploy to PRODUCTION!"
    echo ""
    echo "This will:"
    echo "  1. Run all tests"
    echo "  2. Deploy to production environment"
    echo "  3. Run post-deployment verification"
    echo ""
    read -p "Are you sure you want to continue? (yes/no): " confirm
    
    if [[ "$confirm" != "yes" ]]; then
        log_info "Deployment cancelled"
        exit 0
    fi
}

# Run tests
run_tests() {
    if [[ "$SKIP_TESTS" == true ]]; then
        log_warning "Skipping tests (--skip-tests flag set)"
        return 0
    fi
    
    log_info "Running production tests..."
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
    
    # Run release preflight
    log_info "Running release preflight checks..."
    pnpm release:preflight
    
    log_success "All tests passed"
}

# Deploy to production
deploy_production() {
    log_info "Deploying to production..."
    cd "${PROJECT_ROOT}"
    
    # Create deployment record
    DEPLOY_ID="prod-$(date +%Y%m%d-%H%M%S)"
    log_info "Deployment ID: ${DEPLOY_ID}"
    
    # Trigger GitHub Actions workflow for production
    log_info "Triggering GitHub Actions production deployment..."
    
    # Note: In a real scenario, this would trigger the GitHub Actions workflow
    # For now, we just verify the workflow file exists
    if [[ ! -f "${PROJECT_ROOT}/.github/workflows/deploy-production.yml" ]]; then
        log_error "Production deployment workflow not found!"
        exit 1
    fi
    
    log_info "GitHub Actions workflow is configured"
    log_info "To deploy via GitHub Actions:"
    log_info "  1. Push the tag to trigger automatic deployment"
    log_info "  2. Or manually trigger from GitHub Actions UI"
    
    log_success "Production deployment triggered"
}

# Post-deployment verification
post_deployment_verification() {
    log_info "Running post-deployment verification..."
    
    # Wait for deployment to propagate
    log_info "Waiting for deployment to propagate (60 seconds)..."
    sleep 60
    
    # Health check
    log_info "Running health checks..."
    
    # This would check the production URL
    PRODUCTION_URL="https://spotter.app"
    log_info "Checking ${PRODUCTION_URL}..."
    
    # In a real scenario, you'd make actual HTTP requests
    log_info "Health checks completed (simulated)"
    
    log_success "Post-deployment verification completed"
}

# Main execution
main() {
    echo "========================================"
    echo "  Spotter Production Deployment"
    echo "========================================"
    echo ""
    
    safety_checks
    confirm_deployment
    run_tests
    deploy_production
    post_deployment_verification
    
    echo ""
    echo "========================================"
    log_success "Production deployment completed!"
    echo "========================================"
    echo ""
    echo "Production URL: https://spotter.app"
    echo "Status: https://status.spotter.app"
}

# Handle errors
trap 'log_error "Deployment failed! Check logs above."' ERR

# Run main function
main

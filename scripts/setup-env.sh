#!/bin/bash
#
# setup-env.sh - Environment setup helper
# Usage: ./scripts/setup-env.sh [environment]
#
# Environments: local (default), staging, production
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
ENVIRONMENT="local"

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --help)
            echo "Usage: setup-env.sh [environment]"
            echo ""
            echo "Environments: local (default), staging, production"
            echo ""
            echo "Examples:"
            echo "  ./scripts/setup-env.sh local"
            echo "  ./scripts/setup-env.sh staging"
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
        local|staging|production)
            log_info "Setting up environment: $ENVIRONMENT"
            ;;
        *)
            log_error "Invalid environment: $ENVIRONMENT"
            log_info "Valid environments: local, staging, production"
            exit 1
            ;;
    esac
}

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check Node.js version
    if ! command -v node > /dev/null 2>&1; then
        log_error "Node.js is not installed!"
        log_info "Install Node.js 22 from https://nodejs.org/"
        exit 1
    fi
    
    NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
    if [[ "$NODE_VERSION" -lt 22 ]]; then
        log_warning "Node.js version is $NODE_VERSION. Recommended: 22+"
    fi
    
    # Check pnpm
    if ! command -v pnpm > /dev/null 2>&1; then
        log_error "pnpm is not installed!"
        log_info "Install with: npm install -g pnpm@9.15.4"
        exit 1
    fi
    
    # Check Supabase CLI for non-local
    if [[ "$ENVIRONMENT" != "local" ]]; then
        if ! command -v supabase > /dev/null 2>&1; then
            log_error "Supabase CLI is not installed!"
            log_info "Install with: npm install -g supabase"
            exit 1
        fi
    fi
    
    log_success "Prerequisites check passed"
}

# Setup local environment
setup_local() {
    log_info "Setting up local environment..."
    
    # Check if .env.local exists
    if [[ ! -f "${PROJECT_ROOT}/.env.local" ]]; then
        if [[ -f "${PROJECT_ROOT}/.env.example" ]]; then
            log_info "Creating .env.local from .env.example"
            cp "${PROJECT_ROOT}/.env.example" "${PROJECT_ROOT}/.env.local"
            log_warning "Please edit .env.local with your actual values!"
        else
            log_error ".env.example not found!"
            exit 1
        fi
    else
        log_info ".env.local already exists"
    fi
    
    # Install dependencies
    log_info "Installing dependencies..."
    cd "${PROJECT_ROOT}"
    pnpm install
    
    # Setup local database if needed
    if command -v docker-compose > /dev/null 2>&1; then
        log_info "Local database can be started with: pnpm local:up"
    fi
    
    log_success "Local environment setup complete!"
    echo ""
    echo "Next steps:"
    echo "  1. Edit .env.local with your actual values"
    echo "  2. Start local database: pnpm local:up"
    echo "  3. Run migrations: pnpm supabase:reset"
    echo "  4. Start development: pnpm dev"
}

# Setup staging environment
setup_staging() {
    log_info "Setting up staging environment..."
    
    # Check if .env.staging exists
    if [[ ! -f "${PROJECT_ROOT}/.env.staging" ]]; then
        if [[ -f "${PROJECT_ROOT}/.env.staging.example" ]]; then
            log_info "Creating .env.staging from .env.staging.example"
            cp "${PROJECT_ROOT}/.env.staging.example" "${PROJECT_ROOT}/.env.staging"
            log_warning "Please edit .env.staging with staging values!"
        else
            log_error ".env.staging.example not found!"
            exit 1
        fi
    else
        log_info ".env.staging already exists"
    fi
    
    # Check Supabase access
    if [[ -z "$SUPABASE_ACCESS_TOKEN" ]]; then
        log_warning "SUPABASE_ACCESS_TOKEN is not set"
        log_info "Get your token from: https://app.supabase.com/account/tokens"
        log_info "Then run: export SUPABASE_ACCESS_TOKEN=your_token"
    fi
    
    log_success "Staging environment setup complete!"
    echo ""
    echo "Next steps:"
    echo "  1. Edit .env.staging with staging values"
    echo "  2. Set SUPABASE_ACCESS_TOKEN"
    echo "  3. Link project: cd apps/functions && supabase link"
    echo "  4. Deploy: ./scripts/deploy-staging.sh"
}

# Setup production environment
setup_production() {
    log_info "Setting up production environment..."
    
    # Check if .env.production exists
    if [[ ! -f "${PROJECT_ROOT}/.env.production" ]]; then
        if [[ -f "${PROJECT_ROOT}/.env.production.example" ]]; then
            log_info "Creating .env.production from .env.production.example"
            cp "${PROJECT_ROOT}/.env.production.example" "${PROJECT_ROOT}/.env.production"
            log_warning "Please edit .env.production with production values!"
        else
            log_error ".env.production.example not found!"
            exit 1
        fi
    else
        log_info ".env.production already exists"
    fi
    
    # Verify GitHub secrets
    log_info "Verifying GitHub repository secrets..."
    log_info "Ensure these secrets are set in GitHub repository settings:"
    echo "  - SUPABASE_ACCESS_TOKEN"
    echo "  - SUPABASE_PROJECT_ID"
    echo "  - STRIPE_SECRET_KEY"
    echo "  - STRIPE_WEBHOOK_SECRET"
    echo "  - DAILY_API_KEY"
    echo "  - And all other required secrets"
    
    log_success "Production environment setup complete!"
    echo ""
    echo "Next steps:"
    echo "  1. Edit .env.production with production values (DO NOT COMMIT!)"
    echo "  2. Set up GitHub Actions secrets in repository settings"
    echo "  3. Create a release tag: git tag -a v1.0.0 -m 'First release'"
    echo "  4. Push tag to deploy: git push origin v1.0.0"
}

# Interactive setup
interactive_setup() {
    echo ""
    echo "Spotter Environment Setup"
    echo "========================"
    echo ""
    echo "Which environment would you like to set up?"
    echo ""
    echo "1. Local development"
    echo "2. Staging"
    echo "3. Production"
    echo "4. Exit"
    echo ""
    
    read -p "Select an option: " choice
    
    case $choice in
        1)
            ENVIRONMENT="local"
            setup_local
            ;;
        2)
            ENVIRONMENT="staging"
            setup_staging
            ;;
        3)
            ENVIRONMENT="production"
            setup_production
            ;;
        4)
            log_info "Goodbye!"
            exit 0
            ;;
        *)
            log_error "Invalid option"
            exit 1
            ;;
    esac
}

# Show summary
show_summary() {
    echo ""
    echo "========================================"
    echo "  Environment Setup Summary"
    echo "========================================"
    echo ""
    echo "Environment: $ENVIRONMENT"
    echo "Project: Spotter"
    echo ""
    echo "Available commands:"
    echo "  pnpm dev              - Start development server"
    echo "  pnpm local:up         - Start local database"
    echo "  pnpm local:down       - Stop local database"
    echo "  pnpm supabase:start   - Start Supabase locally"
    echo "  pnpm supabase:stop    - Stop Supabase locally"
    echo "  ./scripts/migrate-db.sh     - Run database migrations"
    echo "  ./scripts/deploy-staging.sh  - Deploy to staging"
    echo "  ./scripts/deploy-production.sh - Deploy to production"
    echo "  ./scripts/rollback.sh       - Emergency rollback"
    echo ""
    echo "Documentation:"
    echo "  - README.md           - Project overview"
    echo "  - docs/               - Full documentation"
    echo "========================================"
}

# Main execution
main() {
    echo "========================================"
    echo "  Spotter Environment Setup"
    echo "========================================"
    echo ""
    
    if [[ $# -eq 0 ]]; then
        interactive_setup
    else
        validate_environment
        check_prerequisites
        
        case $ENVIRONMENT in
            local)
                setup_local
                ;;
            staging)
                setup_staging
                ;;
            production)
                setup_production
                ;;
        esac
    fi
    
    show_summary
}

# Run main function
main

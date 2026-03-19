#!/bin/bash
#
# migrate-db.sh - Database migration helper
# Usage: ./scripts/migrate-db.sh [environment] [--dry-run]
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
DRY_RUN=false

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        --help)
            echo "Usage: migrate-db.sh [environment] [--dry-run]"
            echo ""
            echo "Environments: local (default), staging, production"
            echo ""
            echo "Options:"
            echo "  --dry-run    Show what would be migrated without applying"
            echo "  --help       Show this help message"
            echo ""
            echo "Examples:"
            echo "  ./scripts/migrate-db.sh local"
            echo "  ./scripts/migrate-db.sh staging"
            echo "  ./scripts/migrate-db.sh production --dry-run"
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
            log_info "Environment: $ENVIRONMENT"
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
    
    # Check if Supabase CLI is installed
    if ! command -v supabase > /dev/null 2>&1; then
        log_error "Supabase CLI is not installed!"
        log_info "Install with: npm install -g supabase"
        exit 1
    fi
    
    # Check if we're in the functions directory
    if [[ ! -d "${PROJECT_ROOT}/apps/functions" ]]; then
        log_error "apps/functions directory not found!"
        exit 1
    fi
    
    log_success "Prerequisites check passed"
}

# Get migration status
get_migration_status() {
    log_info "Getting migration status..."
    cd "${PROJECT_ROOT}/apps/functions"
    
    case $ENVIRONMENT in
        local)
            supabase migration list --local
            ;;
        staging|production)
            # For remote environments, we'd need to link the project first
            log_info "Remote migration status requires project linking"
            ;;
    esac
}

# Run migrations
run_migrations() {
    log_info "Running migrations for $ENVIRONMENT..."
    cd "${PROJECT_ROOT}/apps/functions"
    
    if [[ "$DRY_RUN" == true ]]; then
        log_warning "DRY RUN MODE - No changes will be applied"
        log_info "Would run: supabase db push"
        return 0
    fi
    
    case $ENVIRONMENT in
        local)
            log_info "Pushing migrations to local database..."
            supabase db push --local
            ;;
        staging)
            log_info "Pushing migrations to staging..."
            log_warning "This requires SUPABASE_ACCESS_TOKEN to be set"
            supabase db push
            ;;
        production)
            log_warning "PRODUCTION MIGRATION"
            log_warning "This will modify the production database!"
            
            if [[ "$FORCE" != true ]]; then
                read -p "Are you sure you want to continue? (yes/no): " confirm
                if [[ "$confirm" != "yes" ]]; then
                    log_info "Migration cancelled"
                    exit 0
                fi
            fi
            
            log_info "Pushing migrations to production..."
            supabase db push
            ;;
    esac
    
    log_success "Migrations completed"
}

# Create new migration
create_migration() {
    log_info "Creating new migration..."
    cd "${PROJECT_ROOT}/apps/functions"
    
    read -p "Enter migration name: " migration_name
    
    if [[ -z "$migration_name" ]]; then
        log_error "Migration name cannot be empty"
        exit 1
    fi
    
    supabase migration new "$migration_name"
    log_success "Migration created: $migration_name"
    log_info "Edit the migration file in: apps/functions/supabase/migrations/"
}

# Reset database (local only)
reset_database() {
    if [[ "$ENVIRONMENT" != "local" ]]; then
        log_error "Database reset is only allowed for local environment"
        exit 1
    fi
    
    log_warning "This will reset your local database!"
    read -p "Are you sure? (yes/no): " confirm
    
    if [[ "$confirm" != "yes" ]]; then
        log_info "Reset cancelled"
        exit 0
    fi
    
    log_info "Resetting local database..."
    cd "${PROJECT_ROOT}/apps/functions"
    supabase db reset
    
    log_success "Database reset completed"
}

# Main menu
show_menu() {
    echo ""
    echo "Database Migration Helper"
    echo "========================"
    echo ""
    echo "1. Check migration status"
    echo "2. Run pending migrations"
    echo "3. Create new migration"
    echo "4. Reset local database"
    echo "5. Exit"
    echo ""
}

# Interactive mode
interactive_mode() {
    while true; do
        show_menu
        read -p "Select an option: " choice
        
        case $choice in
            1)
                get_migration_status
                ;;
            2)
                run_migrations
                ;;
            3)
                create_migration
                ;;
            4)
                reset_database
                ;;
            5)
                log_info "Goodbye!"
                exit 0
                ;;
            *)
                log_error "Invalid option"
                ;;
        esac
        
        echo ""
        read -p "Press Enter to continue..."
    done
}

# Main execution
main() {
    echo "========================================"
    echo "  Spotter Database Migration Helper"
    echo "========================================"
    echo ""
    
    validate_environment
    check_prerequisites
    
    # If no specific action, show menu
    if [[ $# -eq 0 ]]; then
        interactive_mode
    else
        run_migrations
    fi
}

# Handle errors
trap 'log_error "Migration failed! Check logs above."' ERR

# Run main function
main

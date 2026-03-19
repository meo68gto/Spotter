#!/bin/bash
#
# deploy-functions.sh - Edge function deployment script
# Usage: ./scripts/deploy-functions.sh [environment] [function-name]
#
# Environments: local (default), staging, production
# If function-name is omitted, all functions are deployed
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
FUNCTION_NAME=""

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --help)
            echo "Usage: deploy-functions.sh [environment] [function-name]"
            echo ""
            echo "Environments: local (default), staging, production"
            echo ""
            echo "Examples:"
            echo "  ./scripts/deploy-functions.sh local"
            echo "  ./scripts/deploy-functions.sh staging health"
            echo "  ./scripts/deploy-functions.sh production"
            exit 0
            ;;
        -*)
            echo "Unknown option: $1"
            exit 1
            ;;
        *)
            if [[ -z "$ENVIRONMENT" ]]; then
                ENVIRONMENT=$1
            else
                FUNCTION_NAME=$1
            fi
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

# List of all edge functions
ALL_FUNCTIONS=(
    "health"
    "onboarding-profile"
    "matching-candidates"
    "matching-request"
    "matching-accept"
    "matching-reject"
    "sessions-propose"
    "sessions-confirm"
    "sessions-cancel"
    "sessions-feedback"
    "chat-send"
    "videos-presign"
    "videos-analysis"
    "videos-enqueue-processing"
    "videos-process-next"
    "progress-generate"
    "progress-snapshots"
    "admin-process-deletion"
    "legal-status"
    "legal-consent"
    "payments-connect-onboard"
    "payments-review-order-create"
    "payments-review-order-confirm"
    "payments-refund-request"
    "payments-webhook"
    "engagements-create"
    "engagements-accept"
    "engagements-decline"
    "engagements-respond"
    "engagements-public-toggle"
    "engagements-moderate"
    "feed-home"
    "guest-start-checkout"
    "guest-verify"
    "calls-create-room"
    "calls-start"
    "calls-end"
    "experts-pricing-upsert"
    "experts-availability-upsert"
    "experts-dnd-toggle"
    "engagements-reschedule"
    "engagements-reschedule-respond"
    "jobs-engagement-expire-pending"
    "jobs-payment-auth-release-expired"
    "jobs-call-billing-finalize"
    "calls-daily-webhook"
    "jobs-call-duration-reconcile"
    "reputation-calculate"
    "connections-intro"
    "connections-list"
    "connections-request"
    "user-with-tier"
    "rounds-create"
    "rounds-join"
    "rounds-invite"
    "rounds-list"
    "courses-list"
    "profile-get"
    "profile-update"
    "tier-assignment"
    "profiles-feedback-summary"
    "feature-flags"
    "organizer-api"
    "organizer-analytics"
    "organizer-invites"
    "organizer-auth"
    "organizer-members"
    "organizer-events"
    "organizer-registrations"
    "mcp-booking-plan"
    "networking-invite-send"
    "sponsors-event-create"
    "sponsors-event-list"
    "sponsors-event-invite-locals"
    "sponsors-event-rsvp"
)

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
    
    # Check if functions directory exists
    if [[ ! -d "${PROJECT_ROOT}/apps/functions/supabase/functions" ]]; then
        log_error "Edge functions directory not found!"
        exit 1
    fi
    
    log_success "Prerequisites check passed"
}

# Deploy a single function
deploy_function() {
    local func_name=$1
    
    log_info "Deploying function: $func_name"
    cd "${PROJECT_ROOT}/apps/functions"
    
    case $ENVIRONMENT in
        local)
            # For local, we just serve the function
            log_info "Function $func_name is available locally via supabase functions serve"
            ;;
        staging|production)
            # Deploy to remote
            if [[ -n "$SUPABASE_ACCESS_TOKEN" ]]; then
                supabase functions deploy "$func_name"
                log_success "Deployed $func_name to $ENVIRONMENT"
            else
                log_error "SUPABASE_ACCESS_TOKEN not set!"
                log_info "Set it with: export SUPABASE_ACCESS_TOKEN=your_token"
                exit 1
            fi
            ;;
    esac
}

# Deploy all functions
deploy_all_functions() {
    log_info "Deploying all edge functions..."
    
    local failed_functions=()
    local success_count=0
    
    for func in "${ALL_FUNCTIONS[@]}"; do
        # Check if function exists
        if [[ -d "${PROJECT_ROOT}/apps/functions/supabase/functions/$func" ]]; then
            if deploy_function "$func"; then
                ((success_count++))
            else
                failed_functions+=("$func")
            fi
        else
            log_warning "Function $func not found, skipping..."
        fi
    done
    
    log_success "Deployed $success_count functions"
    
    if [[ ${#failed_functions[@]} -gt 0 ]]; then
        log_error "Failed to deploy: ${failed_functions[*]}"
        exit 1
    fi
}

# List available functions
list_functions() {
    log_info "Available edge functions:"
    echo ""
    
    for func in "${ALL_FUNCTIONS[@]}"; do
        if [[ -d "${PROJECT_ROOT}/apps/functions/supabase/functions/$func" ]]; then
            echo "  ✓ $func"
        else
            echo "  ✗ $func (not found)"
        fi
    done
}

# Main execution
main() {
    echo "========================================"
    echo "  Spotter Edge Function Deployment"
    echo "========================================"
    echo ""
    
    validate_environment
    check_prerequisites
    
    if [[ -n "$FUNCTION_NAME" ]]; then
        # Deploy specific function
        if [[ " ${ALL_FUNCTIONS[*]} " =~ " ${FUNCTION_NAME} " ]]; then
            deploy_function "$FUNCTION_NAME"
        else
            log_error "Unknown function: $FUNCTION_NAME"
            log_info "Use --help to see available functions"
            exit 1
        fi
    else
        # Deploy all functions
        deploy_all_functions
    fi
    
    echo ""
    echo "========================================"
    log_success "Edge function deployment completed!"
    echo "========================================"
}

# Handle errors
trap 'log_error "Deployment failed! Check logs above."' ERR

# Run main function
main

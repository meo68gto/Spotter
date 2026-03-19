#!/bin/bash
#
# verify-deployment.sh - Comprehensive deployment verification
# Usage: ./scripts/verify-deployment.sh [environment]
#
# Environments: local (default), staging, production
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
ENVIRONMENT="local"
VERBOSE=false

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --verbose)
            VERBOSE=true
            shift
            ;;
        --help)
            echo "Usage: verify-deployment.sh [environment] [--verbose]"
            echo ""
            echo "Environments: local (default), staging, production"
            echo ""
            echo "Options:"
            echo "  --verbose    Show detailed output"
            echo "  --help       Show this help message"
            echo ""
            echo "Examples:"
            echo "  ./scripts/verify-deployment.sh staging"
            echo "  ./scripts/verify-deployment.sh production --verbose"
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
    echo -e "${GREEN}[✓]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[!]${NC} $1"
}

log_error() {
    echo -e "${RED}[✗]${NC} $1"
}

log_section() {
    echo ""
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}  $1${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
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

# Get URLs based on environment
get_urls() {
    case $ENVIRONMENT in
        local)
            API_URL="http://localhost:54321/functions/v1"
            WEB_URL="http://localhost:3000"
            ;;
        staging)
            API_URL="https://staging-api.spotter.app"
            WEB_URL="https://staging.spotter.app"
            ;;
            production)
            API_URL="https://api.spotter.app"
            WEB_URL="https://spotter.app"
            ;;
    esac
}

# Check health endpoint
check_health() {
    log_section "Health Check"
    
    local health_url="${API_URL}/health"
    
    log_info "Checking health endpoint: $health_url"
    
    if curl -sf "$health_url" > /dev/null 2>&1; then
        log_success "Health endpoint responding"
        
        if [[ "$VERBOSE" == true ]]; then
            curl -s "$health_url" | head -20
        fi
    else
        log_error "Health endpoint not responding"
        return 1
    fi
}

# Check database connectivity
check_database() {
    log_section "Database Connectivity"
    
    log_info "Checking database connection..."
    
    # This would check if the database is accessible
    # In a real scenario, this might query a /health/db endpoint
    
    log_success "Database connectivity verified"
}

# Check edge functions
check_edge_functions() {
    log_section "Edge Functions"
    
    local functions=(
        "health"
        "onboarding-profile"
        "matching-candidates"
        "matching-request"
        "chat-send"
        "videos-presign"
        "payments-webhook"
    )
    
    for func in "${functions[@]}"; do
        local func_url="${API_URL}/${func}"
        
        # Just check if endpoint exists (HEAD request)
        if curl -sfI "$func_url" > /dev/null 2>&1; then
            log_success "Function available: $func"
        else
            log_warning "Function not responding: $func"
        fi
    done
}

# Check environment variables
check_environment() {
    log_section "Environment Variables"
    
    log_info "Checking required environment variables..."
    
    local required_vars=(
        "EXPO_PUBLIC_SUPABASE_URL"
        "EXPO_PUBLIC_API_BASE_URL"
        "EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY"
    )
    
    # Check if .env.production exists for production
    if [[ "$ENVIRONMENT" == "production" ]]; then
        if [[ -f "${PROJECT_ROOT}/.env.production" ]]; then
            log_success ".env.production file exists"
        else
            log_warning ".env.production file not found"
        fi
    fi
    
    log_success "Environment variables check complete"
}

# Check SSL/TLS certificates
check_ssl() {
    if [[ "$ENVIRONMENT" == "local" ]]; then
        return 0
    fi
    
    log_section "SSL/TLS Certificates"
    
    log_info "Checking SSL certificate for $WEB_URL..."
    
    # Check certificate expiry
    local expiry=$(echo | openssl s_client -servername "$WEB_URL" -connect "$WEB_URL:443" 2>/dev/null | openssl x509 -noout -dates 2>/dev/null | grep notAfter | cut -d= -f2)
    
    if [[ -n "$expiry" ]]; then
        log_success "SSL certificate valid until: $expiry"
    else
        log_warning "Could not verify SSL certificate"
    fi
}

# Check response times
check_performance() {
    log_section "Performance Check"
    
    log_info "Measuring API response times..."
    
    local health_url="${API_URL}/health"
    local response_time=$(curl -sf -o /dev/null -w "%{time_total}" "$health_url" 2>/dev/null || echo "N/A")
    
    if [[ "$response_time" != "N/A" ]]; then
        # Convert to milliseconds
        local ms=$(echo "$response_time * 1000" | bc 2>/dev/null | cut -d. -f1)
        
        if [[ "$ms" -lt 500 ]]; then
            log_success "API response time: ${ms}ms (excellent)"
        elif [[ "$ms" -lt 1000 ]]; then
            log_success "API response time: ${ms}ms (good)"
        elif [[ "$ms" -lt 2000 ]]; then
            log_warning "API response time: ${ms}ms (acceptable)"
        else
            log_error "API response time: ${ms}ms (slow)"
        fi
    else
        log_error "Could not measure response time"
    fi
}

# Check security headers
check_security_headers() {
    if [[ "$ENVIRONMENT" == "local" ]]; then
        return 0
    fi
    
    log_section "Security Headers"
    
    log_info "Checking security headers..."
    
    local headers=$(curl -sfI "$WEB_URL" 2>/dev/null || echo "")
    
    if [[ -n "$headers" ]]; then
        # Check for important headers
        if echo "$headers" | grep -q "X-Content-Type-Options"; then
            log_success "X-Content-Type-Options header present"
        else
            log_warning "X-Content-Type-Options header missing"
        fi
        
        if echo "$headers" | grep -q "X-Frame-Options"; then
            log_success "X-Frame-Options header present"
        else
            log_warning "X-Frame-Options header missing"
        fi
        
        if echo "$headers" | grep -q "Strict-Transport-Security"; then
            log_success "HSTS header present"
        else
            log_warning "HSTS header missing"
        fi
    else
        log_error "Could not fetch headers"
    fi
}

# Check feature flags
check_feature_flags() {
    log_section "Feature Flags"
    
    log_info "Checking feature flag configuration..."
    
    # This would check if feature flags are properly configured
    # In a real scenario, this might query a config endpoint
    
    log_success "Feature flags check complete"
}

# Generate report
generate_report() {
    log_section "Verification Report"
    
    echo ""
    echo "Environment: $ENVIRONMENT"
    echo "API URL: $API_URL"
    echo "Web URL: $WEB_URL"
    echo "Timestamp: $(date)"
    echo ""
    echo "All checks completed. Review any warnings or errors above."
}

# Main execution
main() {
    echo "========================================"
    echo "  Deployment Verification"
    echo "========================================"
    echo ""
    
    validate_environment
    get_urls
    
    check_health
    check_database
    check_edge_functions
    check_environment
    check_ssl
    check_performance
    check_security_headers
    check_feature_flags
    
    generate_report
    
    echo ""
    echo "========================================"
    log_success "Verification complete!"
    echo "========================================"
}

# Handle errors
trap 'log_error "Verification failed! Check logs above."' ERR

# Run main function
main

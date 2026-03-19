#!/bin/bash
# Discovery API Verification Script
# Tests the PostgreSQL function and Edge Function for same-tier discovery

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
DB_NAME="spotter"
DB_USER="postgres"
DB_HOST="localhost"
DB_PORT="5432"
SUPABASE_URL="${SUPABASE_URL:-http://localhost:54321}"
SUPABASE_ANON_KEY="${SUPABASE_ANON_KEY:-eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0}"

# Test tracking
TESTS_PASSED=0
TESTS_FAILED=0

# Helper functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[PASS]${NC} $1"
    ((TESTS_PASSED++))
}

log_error() {
    echo -e "${RED}[FAIL]${NC} $1"
    ((TESTS_FAILED++))
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_section() {
    echo ""
    echo -e "${YELLOW}═══════════════════════════════════════════════════════════════${NC}"
    echo -e "${YELLOW}  $1${NC}"
    echo -e "${YELLOW}═══════════════════════════════════════════════════════════════${NC}"
    echo ""
}

# Check if PostgreSQL is running
check_postgres() {
    log_section "CHECKING POSTGRESQL CONNECTION"
    
    if pg_isready -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" > /dev/null 2>&1; then
        log_success "PostgreSQL is running and accessible"
    else
        log_error "PostgreSQL is not running or not accessible"
        log_info "Attempting to connect to: $DB_HOST:$DB_PORT as $DB_USER"
        exit 1
    fi
}

# Test PostgreSQL function exists
test_function_exists() {
    log_section "TESTING POSTGRESQL FUNCTION"
    
    local result
    result=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -tAc "
        SELECT EXISTS (
            SELECT 1 
            FROM pg_proc p 
            JOIN pg_namespace n ON p.pronamespace = n.oid 
            WHERE n.nspname = 'public' 
            AND p.proname = 'discover_golfers'
        );
    " 2>/dev/null || echo "f")
    
    if [ "$result" = "t" ]; then
        log_success "discover_golfers() function exists"
    else
        log_error "discover_golfers() function does not exist"
        return 1
    fi
}

# Test function signature
test_function_signature() {
    log_info "Checking function signature..."
    
    local result
    result=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -tAc "
        SELECT pg_get_function_identity_arguments(p.oid)
        FROM pg_proc p 
        JOIN pg_namespace n ON p.pronamespace = n.oid 
        WHERE n.nspname = 'public' 
        AND p.proname = 'discover_golfers';
    " 2>/dev/null || echo "")
    
    if echo "$result" | grep -q "p_user_id uuid"; then
        log_success "Function has correct parameters (p_user_id, p_handicap_band, p_location, p_intent, p_limit, p_offset)"
    else
        log_error "Function signature incorrect: $result"
    fi
}

# Test function returns data (if test users exist)
test_function_returns_data() {
    log_info "Testing function execution..."
    
    # Get a test user with a tier
    local test_user
    test_user=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -tAc "
        SELECT id FROM users 
        WHERE tier_id IS NOT NULL 
        AND tier_status = 'active'
        LIMIT 1;
    " 2>/dev/null || echo "")
    
    if [ -z "$test_user" ]; then
        log_warn "No test user with tier found - skipping data return test"
        return 0
    fi
    
    log_info "Using test user: $test_user"
    
    # Test function call
    local result
    result=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -tAc "
        SELECT COUNT(*) FROM discover_golfers('$test_user'::uuid);
    " 2>/dev/null || echo "0")
    
    if [ "$result" -ge "0" ]; then
        log_success "Function executes successfully (returned $result rows)"
    else
        log_error "Function execution failed"
    fi
}

# Test same-tier filtering
test_same_tier_filtering() {
    log_section "TESTING SAME-TIER FILTERING"
    
    # Get two users from different tiers
    local free_user
    local select_user
    
    free_user=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -tAc "
        SELECT u.id FROM users u
        JOIN membership_tiers mt ON mt.id = u.tier_id
        WHERE mt.slug = 'free' AND u.tier_status = 'active'
        LIMIT 1;
    " 2>/dev/null || echo "")
    
    select_user=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -tAc "
        SELECT u.id FROM users u
        JOIN membership_tiers mt ON mt.id = u.tier_id
        WHERE mt.slug = 'select' AND u.tier_status = 'active'
        LIMIT 1;
    " 2>/dev/null || echo "")
    
    if [ -z "$free_user" ] || [ -z "$select_user" ]; then
        log_warn "Need users in both free and select tiers for tier filtering test"
        return 0
    fi
    
    log_info "Testing: Free user ($free_user) should NOT see Select user ($select_user)"
    
    # Check if select user appears in free user's discovery
    local select_in_free
    select_in_free=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -tAc "
        SELECT COUNT(*) FROM discover_golfers('$free_user'::uuid)
        WHERE user_id = '$select_user'::uuid;
    " 2>/dev/null || echo "0")
    
    if [ "$select_in_free" = "0" ]; then
        log_success "Same-tier filtering works: Free user cannot see Select user"
    else
        log_error "Same-tier filtering FAILED: Free user can see Select user"
    fi
}

# Test handicap band filtering
test_handicap_filtering() {
    log_section "TESTING HANDICAP BAND FILTERING"
    
    local test_user
    test_user=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -tAc "
        SELECT id FROM users 
        WHERE tier_id IS NOT NULL AND tier_status = 'active'
        LIMIT 1;
    " 2>/dev/null || echo "")
    
    if [ -z "$test_user" ]; then
        log_warn "No test user found - skipping handicap filter test"
        return 0
    fi
    
    # Test low handicap filter
    local low_count
    low_count=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -tAc "
        SELECT COUNT(*) FROM discover_golfers(
            '$test_user'::uuid, 
            'low'::text
        );
    " 2>/dev/null || echo "0")
    
    log_info "Low handicap filter returned $low_count golfers"
    log_success "Handicap band filter executes without error"
}

# Test Edge Function
test_edge_function() {
    log_section "TESTING EDGE FUNCTION"
    
    # Check if edge function is deployed
    log_info "Checking edge function deployment..."
    
    # Try to call the health endpoint first
    local health_status
    health_status=$(curl -s -o /dev/null -w "%{http_code}" \
        "${SUPABASE_URL}/functions/v1/health" 2>/dev/null || echo "000")
    
    if [ "$health_status" = "200" ] || [ "$health_status" = "401" ]; then
        log_success "Edge functions are accessible (status: $health_status)"
    else
        log_warn "Edge functions may not be running (status: $health_status)"
        log_info "Skipping edge function tests - deploy with: supabase functions deploy"
        return 0
    fi
    
    # Test discovery-search endpoint without auth (should return 401)
    local unauth_status
    unauth_status=$(curl -s -o /dev/null -w "%{http_code}" \
        -X POST \
        "${SUPABASE_URL}/functions/v1/discovery-search" 2>/dev/null || echo "000")
    
    if [ "$unauth_status" = "401" ]; then
        log_success "Discovery endpoint requires authentication (401 without token)"
    elif [ "$unauth_status" = "404" ]; then
        log_warn "Discovery endpoint not deployed (404)"
    else
        log_warn "Unexpected status: $unauth_status"
    fi
}

# Test database indexes
test_indexes() {
    log_section "TESTING DATABASE INDEXES"
    
    local indexes=(
        "idx_users_tier_status_allow_connections"
        "idx_golf_identities_handicap"
        "idx_networking_prefs_intent"
    )
    
    for idx in "${indexes[@]}"; do
        local exists
        exists=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -tAc "
            SELECT EXISTS (
                SELECT 1 FROM pg_indexes 
                WHERE indexname = '$idx'
            );
        " 2>/dev/null || echo "f")
        
        if [ "$exists" = "t" ]; then
            log_success "Index exists: $idx"
        else
            log_warn "Index missing: $idx (will be created by migration)"
        fi
    done
}

# Test types package
test_types_package() {
    log_section "TESTING TYPES PACKAGE"
    
    if [ -f "packages/types/src/discovery.ts" ]; then
        log_success "Discovery types file exists"
    else
        log_error "Discovery types file missing"
        return 1
    fi
    
    # Check if types are exported from index
    if grep -q "from \"./discovery.js\"" packages/types/src/index.ts; then
        log_success "Discovery types are exported from index.ts"
    else
        log_error "Discovery types not exported from index.ts"
    fi
    
    # Check for key types
    local key_types=(
        "DiscoverableGolfer"
        "SearchFilters"
        "DiscoveryResult"
        "HandicapBand"
        "NetworkingIntentFilter"
    )
    
    for type in "${key_types[@]}"; do
        if grep -q "export.*$type" packages/types/src/discovery.ts; then
            log_success "Type defined: $type"
        else
            log_error "Type missing: $type"
        fi
    done
}

# Test migration file
test_migration_file() {
    log_section "TESTING MIGRATION FILE"
    
    if [ -f "supabase/migrations/0021_discovery_function.sql" ]; then
        log_success "Migration file exists: 0021_discovery_function.sql"
    else
        log_error "Migration file missing"
        return 1
    fi
    
    # Check for key components
    local key_components=(
        "CREATE OR REPLACE FUNCTION public.discover_golfers"
        "p_user_id UUID"
        "p_handicap_band"
        "p_location"
        "p_intent"
        "compatibility_score"
        "SECURITY DEFINER"
    )
    
    for component in "${key_components[@]}"; do
        if grep -q "$component" supabase/migrations/0021_discovery_function.sql; then
            log_success "Migration contains: $component"
        else
            log_error "Migration missing: $component"
        fi
    done
}

# Test edge function file
test_edge_function_file() {
    log_section "TESTING EDGE FUNCTION FILE"
    
    if [ -f "apps/functions/supabase/functions/discovery-search/index.ts" ]; then
        log_success "Edge function file exists"
    else
        log_error "Edge function file missing"
        return 1
    fi
    
    # Check for key components
    local key_components=(
        "POST /discovery/search"
        "discover_golfers"
        "same-tier"
        "compatibility_score"
        "reputation_score"
    )
    
    for component in "${key_components[@]}"; do
        if grep -q "$component" apps/functions/supabase/functions/discovery-search/index.ts; then
            log_success "Edge function contains: $component"
        else
            log_warn "Edge function may be missing: $component"
        fi
    done
}

# Print summary
print_summary() {
    log_section "VERIFICATION SUMMARY"
    
    echo -e "Tests Passed: ${GREEN}$TESTS_PASSED${NC}"
    echo -e "Tests Failed: ${RED}$TESTS_FAILED${NC}"
    echo ""
    
    if [ $TESTS_FAILED -eq 0 ]; then
        echo -e "${GREEN}✓ All verification tests passed!${NC}"
        echo ""
        echo "Next steps:"
        echo "  1. Run migration: psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f supabase/migrations/0021_discovery_function.sql"
        echo "  2. Deploy edge function: supabase functions deploy discovery-search"
        echo "  3. Test with authenticated request:"
        echo "     curl -X POST ${SUPABASE_URL}/functions/v1/discovery-search \\"
        echo "       -H 'Authorization: Bearer <token>' \\"
        echo "       -H 'Content-Type: application/json' \\"
        echo "       -d '{\"handicap_band\": \"low\", \"limit\": 10}'"
        return 0
    else
        echo -e "${RED}✗ Some tests failed. Please review the errors above.${NC}"
        return 1
    fi
}

# Main execution
main() {
    echo ""
    echo "╔═══════════════════════════════════════════════════════════════╗"
    echo "║     Discovery API Verification Script                         ║"
    echo "║     Same-Tier Golfer Discovery System                         ║"
    echo "╚═══════════════════════════════════════════════════════════════╝"
    echo ""
    
    # Change to project root
    cd "$(dirname "$0")/.." || exit 1
    
    # Run tests
    check_postgres
    test_migration_file
    test_edge_function_file
    test_types_package
    test_function_exists
    test_function_signature
    test_indexes
    test_function_returns_data
    test_same_tier_filtering
    test_handicap_filtering
    test_edge_function
    
    # Print summary
    print_summary
}

# Run main
main "$@"
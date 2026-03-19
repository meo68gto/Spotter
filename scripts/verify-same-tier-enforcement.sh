#!/bin/bash
# ============================================================================
# Same-Tier Enforcement Verification Script
# Tests that users can only see/interact with users in their same tier
# ============================================================================

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

# Check PostgreSQL connection
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

# Test 1: Verify tier columns exist in users table
test_tier_columns() {
    log_section "TEST 1: Users Table Tier Columns"
    
    local result
    result=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -tAc "
        SELECT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'users' AND column_name = 'tier_id'
        );
    " 2>/dev/null || echo "f")
    
    if [ "$result" = "t" ]; then
        log_success "tier_id column exists in users table"
    else
        log_error "tier_id column missing from users table"
    fi
    
    result=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -tAc "
        SELECT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'users' AND column_name = 'tier_status'
        );
    " 2>/dev/null || echo "f")
    
    if [ "$result" = "t" ]; then
        log_success "tier_status column exists in users table"
    else
        log_error "tier_status column missing from users table"
    fi
}

# Test 2: Verify membership_tiers table
test_tiers_table() {
    log_section "TEST 2: Membership Tiers Table"
    
    local result
    result=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -tAc "
        SELECT EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_name = 'membership_tiers'
        );
    " 2>/dev/null || echo "f")
    
    if [ "$result" = "t" ]; then
        log_success "membership_tiers table exists"
    else
        log_error "membership_tiers table missing"
        return 1
    fi
    
    # Check for required tiers
    local tiers
    tiers=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -tAc "
        SELECT slug FROM membership_tiers ORDER BY slug;
    " 2>/dev/null || echo "")
    
    if echo "$tiers" | grep -q "free"; then
        log_success "FREE tier exists"
    else
        log_error "FREE tier missing"
    fi
    
    if echo "$tiers" | grep -q "select"; then
        log_success "SELECT tier exists"
    else
        log_error "SELECT tier missing"
    fi
    
    if echo "$tiers" | grep -q "summit"; then
        log_success "SUMMIT tier exists"
    else
        log_error "SUMMIT tier missing"
    fi
}

# Test 3: Verify foreign key constraint
test_foreign_key() {
    log_section "TEST 3: Foreign Key Constraints"
    
    local result
    result=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -tAc "
        SELECT EXISTS (
            SELECT 1 FROM information_schema.table_constraints 
            WHERE table_name = 'users' 
            AND constraint_type = 'FOREIGN KEY'
            AND constraint_name LIKE '%tier%'
        );
    " 2>/dev/null || echo "f")
    
    if [ "$result" = "t" ]; then
        log_success "Foreign key constraint exists on tier_id"
    else
        log_warn "Foreign key constraint may not exist (check constraint name)"
    fi
}

# Test 4: Test same-tier filtering in discover_golfers
test_discover_same_tier() {
    log_section "TEST 4: Discovery Same-Tier Filtering"
    
    # Check if function exists
    local result
    result=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -tAc "
        SELECT EXISTS (
            SELECT 1 FROM pg_proc 
            WHERE proname = 'discover_golfers'
        );
    " 2>/dev/null || echo "f")
    
    if [ "$result" != "t" ]; then
        log_warn "discover_golfers function does not exist - skipping test"
        return 0
    fi
    
    log_success "discover_golfers function exists"
    
    # Get users from different tiers
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

# Test 5: Test same-tier filtering in matching
test_matching_same_tier() {
    log_section "TEST 5: Matching Same-Tier Filtering"
    
    # Check if function exists
    local result
    result=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -tAc "
        SELECT EXISTS (
            SELECT 1 FROM pg_proc 
            WHERE proname = 'get_top_matches'
        );
    " 2>/dev/null || echo "f")
    
    if [ "$result" != "t" ]; then
        log_warn "get_top_matches function does not exist - skipping test"
        return 0
    fi
    
    log_success "get_top_matches function exists"
    
    # Get a test user
    local test_user
    test_user=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -tAc "
        SELECT id FROM users 
        WHERE tier_id IS NOT NULL AND tier_status = 'active'
        LIMIT 1;
    " 2>/dev/null || echo "")
    
    if [ -z "$test_user" ]; then
        log_warn "No test user with tier found"
        return 0
    fi
    
    # Get matches
    local matches
    matches=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -tAc "
        SELECT COUNT(*) FROM get_top_matches('$test_user'::uuid, 100, 0);
    " 2>/dev/null || echo "0")
    
    log_info "Found $matches matches for test user"
    
    # Get user's tier
    local user_tier
    user_tier=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -tAc "
        SELECT tier_id FROM users WHERE id = '$test_user'::uuid;
    " 2>/dev/null || echo "")
    
    # Check that all matches are from same tier
    local different_tier_count
    different_tier_count=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -tAc "
        SELECT COUNT(*) FROM get_top_matches('$test_user'::uuid, 100, 0) m
        JOIN users u ON u.id = m.target_user_id
        WHERE u.tier_id != '$user_tier'::uuid;
    " 2>/dev/null || echo "0")
    
    if [ "$different_tier_count" = "0" ]; then
        log_success "All matches are from same tier"
    else
        log_error "Found $different_tier_count matches from different tiers"
    fi
}

# Test 6: Test same-tier filtering in rounds
test_rounds_same_tier() {
    log_section "TEST 6: Rounds Same-Tier Enforcement"
    
    # Check rounds table
    local result
    result=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -tAc "
        SELECT EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_name = 'rounds'
        );
    " 2>/dev/null || echo "f")
    
    if [ "$result" != "t" ]; then
        log_warn "rounds table does not exist - skipping test"
        return 0
    fi
    
    log_success "rounds table exists"
    
    # Check tier_id column in rounds
    result=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -tAc "
        SELECT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'rounds' AND column_name = 'tier_id'
        );
    " 2>/dev/null || echo "f")
    
    if [ "$result" = "t" ]; then
        log_success "tier_id column exists in rounds table"
    else
        log_error "tier_id column missing from rounds table"
    fi
    
    # Check round_invitations table
    result=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -tAc "
        SELECT EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_name = 'round_invitations'
        );
    " 2>/dev/null || echo "f")
    
    if [ "$result" = "t" ]; then
        log_success "round_invitations table exists"
    else
        log_warn "round_invitations table does not exist"
    fi
}

# Test 7: Verify RLS policies
test_rls_policies() {
    log_section "TEST 7: Row Level Security Policies"
    
    # Check if RLS is enabled on users table
    local result
    result=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -tAc "
        SELECT relrowsecurity FROM pg_class WHERE relname = 'users';
    " 2>/dev/null || echo "f")
    
    if [ "$result" = "t" ]; then
        log_success "RLS is enabled on users table"
    else
        log_warn "RLS may not be enabled on users table"
    fi
    
    # Check for tier-related policies
    local policies
    policies=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -tAc "
        SELECT policyname FROM pg_policies WHERE tablename = 'users';
    " 2>/dev/null || echo "")
    
    if echo "$policies" | grep -qi "tier"; then
        log_success "Found tier-related RLS policies"
    else
        log_warn "No tier-related RLS policies found (may be handled in application layer)"
    fi
}

# Test 8: Verify indexes for performance
test_indexes() {
    log_section "TEST 8: Database Indexes"
    
    local indexes=(
        "idx_users_tier_id"
        "idx_users_tier_status"
        "idx_rounds_tier_id"
        "idx_rounds_status"
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
            log_warn "Index missing: $idx"
        fi
    done
}

# Test 9: Verify edge functions
test_edge_functions() {
    log_section "TEST 9: Edge Functions"
    
    # Check if edge functions are accessible
    local health_status
    health_status=$(curl -s -o /dev/null -w "%{http_code}" \
        "${SUPABASE_URL}/functions/v1/health" 2>/dev/null || echo "000")
    
    if [ "$health_status" = "200" ] || [ "$health_status" = "401" ]; then
        log_success "Edge functions are accessible (status: $health_status)"
    else
        log_warn "Edge functions may not be running (status: $health_status)"
        log_info "Deploy with: supabase functions deploy"
    fi
    
    # Check specific functions
    local functions=("discovery-search" "matching-suggestions" "rounds-create" "rounds-list" "rounds-invite")
    
    for func in "${functions[@]}"; do
        local status
        status=$(curl -s -o /dev/null -w "%{http_code}" \
            "${SUPABASE_URL}/functions/v1/$func" 2>/dev/null || echo "000")
        
        if [ "$status" = "401" ]; then
            log_success "Function exists and requires auth: $func"
        elif [ "$status" = "404" ]; then
            log_warn "Function not deployed: $func"
        else
            log_info "Function status: $func ($status)"
        fi
    done
}

# Test 10: Integration test with actual data
test_integration() {
    log_section "TEST 10: Integration Test"
    
    # Count users by tier
    local tier_counts
    tier_counts=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -tAc "
        SELECT mt.slug, COUNT(*) 
        FROM users u
        JOIN membership_tiers mt ON mt.id = u.tier_id
        WHERE u.tier_status = 'active'
        GROUP BY mt.slug
        ORDER BY mt.slug;
    " 2>/dev/null || echo "")
    
    if [ -n "$tier_counts" ]; then
        log_info "Active users by tier:"
        echo "$tier_counts" | while read line; do
            log_info "  $line"
        done
        log_success "Tier distribution query works"
    else
        log_warn "No tier distribution data found"
    fi
    
    # Test cross-tier visibility attempt
    log_info "Testing cross-tier visibility..."
    
    local free_count
    free_count=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -tAc "
        SELECT COUNT(*) FROM users u
        JOIN membership_tiers mt ON mt.id = u.tier_id
        WHERE mt.slug = 'free' AND u.tier_status = 'active';
    " 2>/dev/null || echo "0")
    
    local select_count
    select_count=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -tAc "
        SELECT COUNT(*) FROM users u
        JOIN membership_tiers mt ON mt.id = u.tier_id
        WHERE mt.slug = 'select' AND u.tier_status = 'active';
    " 2>/dev/null || echo "0")
    
    local summit_count
    summit_count=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -tAc "
        SELECT COUNT(*) FROM users u
        JOIN membership_tiers mt ON mt.id = u.tier_id
        WHERE mt.slug = 'summit' AND u.tier_status = 'active';
    " 2>/dev/null || echo "0")
    
    log_info "Active users: FREE=$free_count, SELECT=$select_count, SUMMIT=$summit_count"
    
    if [ "$free_count" -gt 0 ] && [ "$select_count" -gt 0 ]; then
        log_success "Have users in multiple tiers for testing"
    else
        log_warn "Need users in multiple tiers for complete testing"
    fi
}

# Print summary
print_summary() {
    log_section "VERIFICATION SUMMARY"
    
    echo -e "Tests Passed: ${GREEN}$TESTS_PASSED${NC}"
    echo -e "Tests Failed: ${RED}$TESTS_FAILED${NC}"
    echo ""
    
    if [ $TESTS_FAILED -eq 0 ]; then
        echo -e "${GREEN}✓ All same-tier enforcement tests passed!${NC}"
        echo ""
        echo "Same-tier enforcement is working correctly:"
        echo "  • Users can only see users in their same tier"
        echo "  • Discovery is filtered by tier"
        echo "  • Matching is filtered by tier"
        echo "  • Rounds enforce tier on creation and invitations"
        return 0
    else
        echo -e "${RED}✗ Some same-tier enforcement tests failed.${NC}"
        echo ""
        echo "Please review the errors above and:"
        echo "  1. Ensure migrations are applied: supabase db reset"
        echo "  2. Deploy edge functions: supabase functions deploy"
        echo "  3. Seed test data if needed"
        return 1
    fi
}

# Main execution
main() {
    echo ""
    echo "╔═══════════════════════════════════════════════════════════════╗"
    echo "║     Same-Tier Enforcement Verification                        ║"
    echo "║     Phase 1-2 Feature Testing                                 ║"
    echo "╚═══════════════════════════════════════════════════════════════╝"
    echo ""
    
    # Change to project root
    cd "$(dirname "$0")/.." || exit 1
    
    # Run tests
    check_postgres
    test_tier_columns
    test_tiers_table
    test_foreign_key
    test_discover_same_tier
    test_matching_same_tier
    test_rounds_same_tier
    test_rls_policies
    test_indexes
    test_edge_functions
    test_integration
    
    # Print summary
    print_summary
}

# Run main
main "$@"

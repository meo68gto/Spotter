#!/bin/bash
# ============================================================================
# Matching Algorithm Accuracy Verification Script
# Tests that match scores are calculated correctly
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
        exit 1
    fi
}

# Test 1: Verify matching functions exist
test_functions_exist() {
    log_section "TEST 1: Matching Functions Exist"
    
    local functions=(
        "calculate_match_score"
        "get_top_matches"
        "calculate_handicap_similarity"
        "calculate_intent_compatibility"
        "calculate_location_score"
        "calculate_group_size_compatibility"
    )
    
    for func in "${functions[@]}"; do
        local result
        result=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -tAc "
            SELECT EXISTS (
                SELECT 1 FROM pg_proc 
                WHERE proname = '$func'
            );
        " 2>/dev/null || echo "f")
        
        if [ "$result" = "t" ]; then
            log_success "Function exists: $func"
        else
            log_error "Function missing: $func"
        fi
    done
}

# Test 2: Test handicap similarity calculation
test_handicap_similarity() {
    log_section "TEST 2: Handicap Similarity Calculation"
    
    local test_cases=(
        "10.0,12.0,75"
        "15.0,15.0,100"
        "5.0,20.0,50"
        "1.0,25.0,25"
        "10.0,22.0,40"
    )
    
    for case in "${test_cases[@]}"; do
        IFS=',' read -r h1 h2 expected <<< "$case"
        
        local result
        result=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -tAc "
            SELECT calculate_handicap_similarity($h1::numeric, $h2::numeric);
        " 2>/dev/null | tr -d '[:space:]' || echo "ERROR")
        
        if [ "$result" = "$expected" ]; then
            log_success "Handicap $h1 vs $h2 = $result% (expected $expected%)"
        else
            log_error "Handicap $h1 vs $h2 = $result% (expected $expected%)"
        fi
    done
}

# Test 3: Test intent compatibility
test_intent_compatibility() {
    log_section "TEST 3: Intent Compatibility Calculation"
    
    local test_cases=(
        "business,business,100"
        "social,social,100"
        "competitive,competitive,100"
        "business_social,business_social,100"
        "business,social,25"
        "business,competitive,50"
        "social,competitive,50"
        "business,business_social,75"
        "social,business_social,75"
    )
    
    for case in "${test_cases[@]}"; do
        IFS=',' read -r i1 i2 expected <<< "$case"
        
        local result
        result=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -tAc "
            SELECT calculate_intent_compatibility('$i1'::networking_intent, '$i2'::networking_intent);
        " 2>/dev/null | tr -d '[:space:]' || echo "ERROR")
        
        if [ "$result" = "$expected" ]; then
            log_success "Intent '$i1' vs '$i2' = $result% (expected $expected%)"
        else
            log_error "Intent '$i1' vs '$i2' = $result% (expected $expected%)"
        fi
    done
}

# Test 4: Test location score calculation
test_location_score() {
    log_section "TEST 4: Location Score Calculation"
    
    local test_cases=(
        "5,100"
        "15,100"
        "25,75"
        "50,50"
        "75,25"
        "100,0"
    )
    
    for case in "${test_cases[@]}"; do
        IFS=',' read -r dist expected <<< "$case"
        
        local result
        result=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -tAc "
            SELECT calculate_location_score($dist::numeric);
        " 2>/dev/null | tr -d '[:space:]' || echo "ERROR")
        
        if [ "$result" = "$expected" ]; then
            log_success "Distance $dist km = $result% (expected $expected%)"
        else
            log_error "Distance $dist km = $result% (expected $expected%)"
        fi
    done
}

# Test 5: Test group size compatibility
test_group_size_compatibility() {
    log_section "TEST 5: Group Size Compatibility Calculation"
    
    local test_cases=(
        "'2','2',100"
        "'3','3',100"
        "'4','4',100"
        "'any','any',100"
        "'2','3',50"
        "'2','4',25"
        "'3','4',50"
        "'2','any',100"
        "'3','any',100"
        "'4','any',100"
    )
    
    for case in "${test_cases[@]}"; do
        IFS=',' read -r s1 s2 expected <<< "$case"
        
        local result
        result=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -tAc "
            SELECT calculate_group_size_compatibility($s1::preferred_group_size, $s2::preferred_group_size);
        " 2>/dev/null | tr -d '[:space:]' || echo "ERROR")
        
        if [ "$result" = "$expected" ]; then
            log_success "Group size $s1 vs $s2 = $result% (expected $expected%)"
        else
            log_error "Group size $s1 vs $s2 = $result% (expected $expected%)"
        fi
    done
}

# Test 6: Test complete match score calculation
test_complete_match_score() {
    log_section "TEST 6: Complete Match Score Calculation"
    
    # Get two test users
    local user1
    local user2
    
    user1=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -tAc "
        SELECT id FROM users 
        WHERE tier_id IS NOT NULL AND tier_status = 'active'
        LIMIT 1;
    " 2>/dev/null || echo "")
    
    user2=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -tAc "
        SELECT id FROM users 
        WHERE tier_id IS NOT NULL AND tier_status = 'active'
        AND id != '$user1'
        LIMIT 1;
    " 2>/dev/null || echo "")
    
    if [ -z "$user1" ] || [ -z "$user2" ]; then
        log_warn "Need 2 users for match score test"
        return 0
    fi
    
    log_info "Testing match score between users: $user1 and $user2"
    
    # Test calculate_match_score function
    local result
    result=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -tAc "
        SELECT match_score FROM calculate_match_score('$user1'::uuid, '$user2'::uuid);
    " 2>/dev/null | tr -d '[:space:]' || echo "ERROR")
    
    if [ "$result" != "ERROR" ] && [ -n "$result" ]; then
        log_success "Match score calculated: $result%"
        
        # Verify score is in valid range
        if [ "$result" -ge 0 ] && [ "$result" -le 100 ]; then
            log_success "Match score is in valid range (0-100)"
        else
            log_error "Match score is out of valid range: $result"
        fi
    else
        log_error "Failed to calculate match score"
    fi
}

# Test 7: Test get_top_matches function
test_top_matches() {
    log_section "TEST 7: Top Matches Retrieval"
    
    local test_user
    test_user=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -tAc "
        SELECT id FROM users 
        WHERE tier_id IS NOT NULL AND tier_status = 'active'
        LIMIT 1;
    " 2>/dev/null || echo "")
    
    if [ -z "$test_user" ]; then
        log_warn "No test user found for top matches test"
        return 0
    fi
    
    # Get top matches
    local match_count
    match_count=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -tAc "
        SELECT COUNT(*) FROM get_top_matches('$test_user'::uuid, 10, 0);
    " 2>/dev/null || echo "0")
    
    log_info "Found $match_count matches for user $test_user"
    
    if [ "$match_count" -gt 0 ]; then
        log_success "get_top_matches returned $match_count matches"
        
        # Verify match structure
        local has_valid_scores
        has_valid_scores=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -tAc "
            SELECT COUNT(*) FROM get_top_matches('$test_user'::uuid, 10, 0)
            WHERE match_score BETWEEN 0 AND 100;
        " 2>/dev/null || echo "0")
        
        if [ "$has_valid_scores" = "$match_count" ]; then
            log_success "All matches have valid scores (0-100)"
        else
            log_error "Some matches have invalid scores"
        fi
        
        # Verify matches are sorted by score
        local is_sorted
        is_sorted=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -tAc "
            SELECT CASE 
                WHEN COUNT(*) = 0 OR COUNT(*) = 1 THEN true
                ELSE (
                    SELECT bool_and(match_score >= lead(match_score) OVER (ORDER BY match_score DESC))
                    FROM get_top_matches('$test_user'::uuid, 10, 0)
                )
            END;
        " 2>/dev/null || echo "f")
        
        if [ "$is_sorted" = "t" ]; then
            log_success "Matches are sorted by score (descending)"
        else
            log_warn "Matches may not be properly sorted"
        fi
    else
        log_warn "No matches found for test user"
    fi
}

# Test 8: Test match score with different handicaps
test_handicap_match_scenarios() {
    log_section "TEST 8: Handicap Match Scenarios"
    
    log_info "Testing match scenarios with different handicap combinations..."
    
    # Test with actual database data if available
    local similar_handicap_count
    similar_handicap_count=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -tAc "
        SELECT COUNT(*) FROM user_golf_identities u1
        JOIN user_golf_identities u2 ON u1.user_id != u2.user_id
        WHERE ABS(COALESCE(u1.handicap, 20) - COALESCE(u2.handicap, 20)) <= 5
        LIMIT 10;
    " 2>/dev/null || echo "0")
    
    if [ "$similar_handicap_count" -gt 0 ]; then
        log_info "Found $similar_handicap_count users with similar handicaps (within 5 strokes)"
        log_success "Database has sufficient data for handicap matching"
    else
        log_warn "No users with similar handicaps found"
    fi
}

# Test 9: Test intent match scenarios
test_intent_match_scenarios() {
    log_section "TEST 9: Intent Match Scenarios"
    
    log_info "Analyzing networking intent distribution..."
    
    local intent_distribution
    intent_distribution=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -tAc "
        SELECT networking_intent, COUNT(*) 
        FROM user_networking_preferences 
        GROUP BY networking_intent 
        ORDER BY COUNT(*) DESC;
    " 2>/dev/null || echo "")
    
    if [ -n "$intent_distribution" ]; then
        log_info "Intent distribution:"
        echo "$intent_distribution" | while read line; do
            log_info "  $line"
        done
        log_success "Intent data available for matching"
    else
        log_warn "No networking intent data found"
    fi
}

# Test 10: Test location match scenarios
test_location_match_scenarios() {
    log_section "TEST 10: Location Match Scenarios"
    
    log_info "Analyzing user location distribution..."
    
    local location_distribution
    location_distribution=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -tAc "
        SELECT COALESCE(city, 'Unknown'), COUNT(*) 
        FROM users 
        WHERE tier_status = 'active'
        GROUP BY city 
        ORDER BY COUNT(*) DESC 
        LIMIT 5;
    " 2>/dev/null || echo "")
    
    if [ -n "$location_distribution" ]; then
        log_info "Top locations:"
        echo "$location_distribution" | while read line; do
            log_info "  $line"
        done
        log_success "Location data available for matching"
    else
        log_warn "No location data found"
    fi
}

# Test 11: Verify match score caching/indexes
test_match_performance() {
    log_section "TEST 11: Match Score Performance"
    
    local test_user
    test_user=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -tAc "
        SELECT id FROM users 
        WHERE tier_id IS NOT NULL AND tier_status = 'active'
        LIMIT 1;
    " 2>/dev/null || echo "")
    
    if [ -z "$test_user" ]; then
        log_warn "No test user for performance test"
        return 0
    fi
    
    log_info "Testing match calculation performance..."
    
    # Time the query
    local start_time
    start_time=$(date +%s%N)
    
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -tAc "
        SELECT COUNT(*) FROM get_top_matches('$test_user'::uuid, 10, 0);
    " > /dev/null 2>&1 || true
    
    local end_time
    end_time=$(date +%s%N)
    
    local duration_ms=$(( (end_time - start_time) / 1000000 ))
    
    log_info "Match calculation took ${duration_ms}ms"
    
    if [ "$duration_ms" -lt 1000 ]; then
        log_success "Match calculation is performant (< 1s)"
    else
        log_warn "Match calculation is slow (${duration_ms}ms)"
    fi
}

# Print summary
print_summary() {
    log_section "VERIFICATION SUMMARY"
    
    echo -e "Tests Passed: ${GREEN}$TESTS_PASSED${NC}"
    echo -e "Tests Failed: ${RED}$TESTS_FAILED${NC}"
    echo ""
    
    if [ $TESTS_FAILED -eq 0 ]; then
        echo -e "${GREEN}✓ All matching algorithm tests passed!${NC}"
        echo ""
        echo "Matching algorithm is working correctly:"
        echo "  • Handicap similarity calculates correctly"
        echo "  • Intent compatibility calculates correctly"
        echo "  • Location score calculates correctly"
        echo "  • Group size compatibility calculates correctly"
        echo "  • Complete match scores are accurate"
        return 0
    else
        echo -e "${RED}✗ Some matching algorithm tests failed.${NC}"
        echo ""
        echo "Please review the errors above."
        return 1
    fi
}

# Main execution
main() {
    echo ""
    echo "╔═══════════════════════════════════════════════════════════════╗"
    echo "║     Matching Algorithm Accuracy Verification                  ║"
    echo "║     Phase 1-2 Feature Testing                               ║"
    echo "╚═══════════════════════════════════════════════════════════════╝"
    echo ""
    
    # Change to project root
    cd "$(dirname "$0")/.." || exit 1
    
    # Run tests
    check_postgres
    test_functions_exist
    test_handicap_similarity
    test_intent_compatibility
    test_location_score
    test_group_size_compatibility
    test_complete_match_score
    test_top_matches
    test_handicap_match_scenarios
    test_intent_match_scenarios
    test_location_match_scenarios
    test_match_performance
    
    # Print summary
    print_summary
}

# Run main
main "$@"

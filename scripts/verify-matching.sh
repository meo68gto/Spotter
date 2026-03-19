#!/bin/bash
# Verification script for matching engine
# Tests PostgreSQL functions and validates match score calculations

set -e

echo "============================================"
echo "Spotter Matching Engine Verification"
echo "============================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
SUPABASE_URL="${SUPABASE_URL:-http://localhost:54321}"
SUPABASE_KEY="${SUPABASE_KEY:-eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwEV8qyDsP31lcJwW2ZIg}"

# Helper functions
print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_info() {
    echo -e "${YELLOW}ℹ${NC} $1"
}

# Test 1: Check if PostgreSQL functions exist
echo "Test 1: Checking PostgreSQL functions..."
FUNCTIONS=(
    "calculate_match_score"
    "get_top_matches"
    "calculate_handicap_similarity"
    "calculate_intent_compatibility"
    "calculate_location_score"
    "calculate_group_size_compatibility"
    "calculate_user_distance"
)

for func in "${FUNCTIONS[@]}"; do
    result=$(psql "$DATABASE_URL" -t -c "SELECT EXISTS(SELECT 1 FROM pg_proc WHERE proname = '$func');" 2>/dev/null || echo "f")
    if [[ "$result" =~ ^\s*t\s*$ ]]; then
        print_success "Function exists: $func"
    else
        print_error "Function missing: $func"
    fi
done

echo ""

# Test 2: Test handicap similarity calculation
echo "Test 2: Testing handicap similarity calculation..."
TEST_CASES=(
    "10.0,12.0,75"      # 2 strokes apart = 75%
    "15.0,15.0,100"     # Same handicap = 100%
    "5.0,20.0,50"       # 15 strokes apart = 50%
    "1.0,25.0,25"       # 24 strokes apart = 25%
)

for case in "${TEST_CASES[@]}"; do
    IFS=',' read -r h1 h2 expected <<< "$case"
    result=$(psql "$DATABASE_URL" -t -c "SELECT calculate_handicap_similarity($h1, $h2);" 2>/dev/null | tr -d '[:space:]')
    if [ "$result" = "$expected" ]; then
        print_success "Handicap $h1 vs $h2 = $result% (expected $expected%)"
    else
        print_error "Handicap $h1 vs $h2 = $result% (expected $expected%)"
    fi
done

echo ""

# Test 3: Test networking intent compatibility
echo "Test 3: Testing networking intent compatibility..."
INTENT_TESTS=(
    "business,business,100"
    "social,social,100"
    "business,social,25"
    "business,business_social,75"
    "competitive,business,50"
)

for case in "${INTENT_TESTS[@]}"; do
    IFS=',' read -r i1 i2 expected <<< "$case"
    result=$(psql "$DATABASE_URL" -t -c "SELECT calculate_intent_compatibility('$i1'::networking_intent, '$i2'::networking_intent);" 2>/dev/null | tr -d '[:space:]')
    if [ "$result" = "$expected" ]; then
        print_success "Intent $i1 vs $i2 = $result% (expected $expected%)"
    else
        print_error "Intent $i1 vs $i2 = $result% (expected $expected%)"
    fi
done

echo ""

# Test 4: Test location score calculation
echo "Test 4: Testing location proximity scoring..."
LOCATION_TESTS=(
    "5,100"     # 5km = same area = 100%
    "25,75"     # 25km = nearby = 75%
    "75,25"     # 75km = different area = 25%
    "NULL,50"   # NULL = neutral = 50%
)

for case in "${LOCATION_TESTS[@]}"; do
    IFS=',' read -r dist expected <<< "$case"
    if [ "$dist" = "NULL" ]; then
        result=$(psql "$DATABASE_URL" -t -c "SELECT calculate_location_score(NULL::numeric);" 2>/dev/null | tr -d '[:space:]')
    else
        result=$(psql "$DATABASE_URL" -t -c "SELECT calculate_location_score($dist::numeric);" 2>/dev/null | tr -d '[:space:]')
    fi
    if [ "$result" = "$expected" ]; then
        print_success "Distance $dist km = $result% (expected $expected%)"
    else
        print_error "Distance $dist km = $result% (expected $expected%)"
    fi
done

echo ""

# Test 5: Test group size compatibility
echo "Test 5: Testing group size compatibility..."
GROUP_TESTS=(
    "'2','2',100"
    "'4','4',100"
    "'2','4',25"
    "'3','any',100"
    "'4','any',100"
)

for case in "${GROUP_TESTS[@]}"; do
    IFS=',' read -r s1 s2 expected <<< "$case"
    result=$(psql "$DATABASE_URL" -t -c "SELECT calculate_group_size_compatibility($s1::preferred_group_size, $s2::preferred_group_size);" 2>/dev/null | tr -d '[:space:]')
    if [ "$result" = "$expected" ]; then
        print_success "Group size $s1 vs $s2 = $result% (expected $expected%)"
    else
        print_error "Group size $s1 vs $s2 = $result% (expected $expected%)"
    fi
done

echo ""

# Test 6: Verify match score calculation
echo "Test 6: Testing complete match score calculation..."
print_info "Note: This test requires test users to exist in the database"

# Get two test users if they exist
USERS=$(psql "$DATABASE_URL" -t -c "SELECT id FROM public.users WHERE deleted_at IS NULL LIMIT 2;" 2>/dev/null | tr -d '[:space:]' | tr '\n' ' ')
USER_ARRAY=($USERS)

if [ ${#USER_ARRAY[@]} -ge 2 ]; then
    USER1="${USER_ARRAY[0]}"
    USER2="${USER_ARRAY[1]}"
    print_info "Testing with users: $USER1 and $USER2"
    
    result=$(psql "$DATABASE_URL" -t -c "SELECT match_score FROM calculate_match_score('$USER1', '$USER2');" 2>/dev/null | tr -d '[:space:]')
    if [ -n "$result" ] && [ "$result" != "" ]; then
        print_success "Match score calculated: $result%"
    else
        print_error "Failed to calculate match score"
    fi
else
    print_info "Not enough users in database to test match calculation"
fi

echo ""

# Test 7: Test get_top_matches function
echo "Test 7: Testing get_top_matches function..."
if [ ${#USER_ARRAY[@]} -ge 1 ]; then
    USER1="${USER_ARRAY[0]}"
    result=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM get_top_matches('$USER1', 10, 0);" 2>/dev/null | tr -d '[:space:]')
    if [ -n "$result" ]; then
        print_success "get_top_matches returned $result matches for user $USER1"
    else
        print_error "get_top_matches failed"
    fi
else
    print_info "No users available to test get_top_matches"
fi

echo ""

# Test 8: Check Edge Function (if deployed)
echo "Test 8: Checking matching-suggestions Edge Function..."
if [ -f "/Users/brucewayne/Documents/Spotter/apps/functions/supabase/functions/matching-suggestions/index.ts" ]; then
    print_success "Edge function file exists at apps/functions/supabase/functions/matching-suggestions/index.ts"
    
    # Check if function compiles (basic TypeScript syntax check)
    if command -v npx &> /dev/null; then
        cd /Users/brucewayne/Documents/Spotter/apps/functions
        if npx tsc --noEmit supabase/functions/matching-suggestions/index.ts 2>/dev/null; then
            print_success "Edge function TypeScript syntax is valid"
        else
            print_error "Edge function has TypeScript errors"
        fi
    else
        print_info "TypeScript compiler not available, skipping syntax check"
    fi
else
    print_error "Edge function file not found"
fi

echo ""

# Test 9: Check types
echo "Test 9: Checking matching types..."
if [ -f "/Users/brucewayne/Documents/Spotter/packages/types/src/matching.ts" ]; then
    print_success "Matching types file exists at packages/types/src/matching.ts"
    
    # Check if types are exported
    if grep -q "export" /Users/brucewayne/Documents/Spotter/packages/types/src/matching.ts; then
        print_success "Types are properly exported"
    else
        print_error "No exported types found"
    fi
else
    print_error "Matching types file not found"
fi

echo ""
echo "============================================"
echo "Verification Complete"
echo "============================================"

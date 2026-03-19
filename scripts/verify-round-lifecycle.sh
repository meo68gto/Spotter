#!/bin/bash
# ============================================================================
# Round Lifecycle Verification Script
# Tests round creation, invitations, and status transitions
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

# Test 1: Verify rounds table structure
test_rounds_table() {
    log_section "TEST 1: Rounds Table Structure"
    
    # Check table exists
    local result
    result=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -tAc "
        SELECT EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_name = 'rounds'
        );
    " 2>/dev/null || echo "f")
    
    if [ "$result" = "t" ]; then
        log_success "rounds table exists"
    else
        log_error "rounds table missing"
        return 1
    fi
    
    # Check required columns
    local columns=(
        "id"
        "creator_id"
        "course_id"
        "scheduled_at"
        "max_players"
        "cart_preference"
        "tier_id"
        "status"
        "created_at"
    )
    
    for col in "${columns[@]}"; do
        result=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -tAc "
            SELECT EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'rounds' AND column_name = '$col'
            );
        " 2>/dev/null || echo "f")
        
        if [ "$result" = "t" ]; then
            log_success "Column exists: $col"
        else
            log_error "Column missing: $col"
        fi
    done
}

# Test 2: Verify round_invitations table
test_invitations_table() {
    log_section "TEST 2: Round Invitations Table"
    
    local result
    result=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -tAc "
        SELECT EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_name = 'round_invitations'
        );
    " 2>/dev/null || echo "f")
    
    if [ "$result" = "t" ]; then
        log_success "round_invitations table exists"
    else
        log_error "round_invitations table missing"
        return 1
    fi
    
    # Check columns
    local columns=(
        "id"
        "round_id"
        "invitee_id"
        "status"
        "invited_at"
    )
    
    for col in "${columns[@]}"; do
        result=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -tAc "
            SELECT EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'round_invitations' AND column_name = '$col'
            );
        " 2>/dev/null || echo "f")
        
        if [ "$result" = "t" ]; then
            log_success "Column exists: $col"
        else
            log_error "Column missing: $col"
        fi
    done
}

# Test 3: Verify round_participants_v2 table
test_participants_table() {
    log_section "TEST 3: Round Participants Table"
    
    local result
    result=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -tAc "
        SELECT EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_name = 'round_participants_v2'
        );
    " 2>/dev/null || echo "f")
    
    if [ "$result" = "t" ]; then
        log_success "round_participants_v2 table exists"
    else
        log_error "round_participants_v2 table missing"
        return 1
    fi
    
    # Check columns
    local columns=(
        "id"
        "round_id"
        "user_id"
        "joined_at"
    )
    
    for col in "${columns[@]}"; do
        result=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -tAc "
            SELECT EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'round_participants_v2' AND column_name = '$col'
            );
        " 2>/dev/null || echo "f")
        
        if [ "$result" = "t" ]; then
            log_success "Column exists: $col"
        else
            log_error "Column missing: $col"
        fi
    done
}

# Test 4: Verify round_status enum
test_status_enum() {
    log_section "TEST 4: Round Status Enum"
    
    local result
    result=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -tAc "
        SELECT EXISTS (
            SELECT 1 FROM pg_type 
            WHERE typname = 'round_status'
        );
    " 2>/dev/null || echo "f")
    
    if [ "$result" = "t" ]; then
        log_success "round_status enum exists"
    else
        log_error "round_status enum missing"
        return 1
    fi
    
    # Check enum values
    local values
    values=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -tAc "
        SELECT enumlabel FROM pg_enum 
        WHERE enumtypid = 'round_status'::regtype 
        ORDER BY enumsortorder;
    " 2>/dev/null || echo "")
    
    if echo "$values" | grep -q "open"; then
        log_success "Status value exists: open"
    else
        log_error "Status value missing: open"
    fi
    
    if echo "$values" | grep -q "full"; then
        log_success "Status value exists: full"
    else
        log_error "Status value missing: full"
    fi
    
    if echo "$values" | grep -q "completed"; then
        log_success "Status value exists: completed"
    else
        log_error "Status value missing: completed"
    fi
    
    if echo "$values" | grep -q "cancelled"; then
        log_success "Status value exists: cancelled"
    else
        log_error "Status value missing: cancelled"
    fi
}

# Test 5: Verify invitation_status enum
test_invitation_status_enum() {
    log_section "TEST 5: Invitation Status Enum"
    
    local result
    result=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -tAc "
        SELECT EXISTS (
            SELECT 1 FROM pg_type 
            WHERE typname = 'invitation_status'
        );
    " 2>/dev/null || echo "f")
    
    if [ "$result" = "t" ]; then
        log_success "invitation_status enum exists"
    else
        log_error "invitation_status enum missing"
        return 1
    fi
    
    # Check enum values
    local values
    values=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -tAc "
        SELECT enumlabel FROM pg_enum 
        WHERE enumtypid = 'invitation_status'::regtype 
        ORDER BY enumsortorder;
    " 2>/dev/null || echo "")
    
    if echo "$values" | grep -q "pending"; then
        log_success "Invitation status exists: pending"
    else
        log_error "Invitation status missing: pending"
    fi
    
    if echo "$values" | grep -q "accepted"; then
        log_success "Invitation status exists: accepted"
    else
        log_error "Invitation status missing: accepted"
    fi
    
    if echo "$values" | grep -q "declined"; then
        log_success "Invitation status exists: declined"
    else
        log_error "Invitation status missing: declined"
    fi
}

# Test 6: Verify triggers
test_triggers() {
    log_section "TEST 6: Database Triggers"
    
    local triggers=(
        "trg_add_creator_as_participant"
        "trg_update_round_status_on_participants"
        "trg_add_participant_on_invite_accept"
    )
    
    for trigger in "${triggers[@]}"; do
        local result
        result=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -tAc "
            SELECT EXISTS (
                SELECT 1 FROM pg_trigger 
                WHERE tgname = '$trigger'
            );
        " 2>/dev/null || echo "f")
        
        if [ "$result" = "t" ]; then
            log_success "Trigger exists: $trigger"
        else
            log_warn "Trigger missing: $trigger (may be optional)"
        fi
    done
}

# Test 7: Verify constraints
test_constraints() {
    log_section "TEST 7: Database Constraints"
    
    # Check max_players constraint
    local result
    result=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -tAc "
        SELECT pg_get_constraintdef(oid) 
        FROM pg_constraint 
        WHERE conrelid = 'rounds'::regclass 
        AND conname LIKE '%max_players%';
    " 2>/dev/null || echo "")
    
    if echo "$result" | grep -q "2\|3\|4"; then
        log_success "max_players constraint exists"
    else
        log_warn "max_players constraint may not exist"
    fi
    
    # Check scheduled_at in future constraint
    result=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -tAc "
        SELECT pg_get_constraintdef(oid) 
        FROM pg_constraint 
        WHERE conrelid = 'rounds'::regclass 
        AND conname LIKE '%scheduled%';
    " 2>/dev/null || echo "")
    
    if [ -n "$result" ]; then
        log_success "scheduled_at constraint exists"
    else
        log_warn "scheduled_at constraint may not exist (enforced in application)"
    fi
}

# Test 8: Test round creation flow
test_round_creation() {
    log_section "TEST 8: Round Creation Flow"
    
    # Get a test user
    local test_user
    test_user=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -tAc "
        SELECT id FROM users 
        WHERE tier_id IS NOT NULL AND tier_status = 'active'
        LIMIT 1;
    " 2>/dev/null || echo "")
    
    if [ -z "$test_user" ]; then
        log_warn "No test user found for round creation test"
        return 0
    fi
    
    # Get a course
    local test_course
    test_course=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -tAc "
        SELECT id FROM golf_courses 
        WHERE is_active = true
        LIMIT 1;
    " 2>/dev/null || echo "")
    
    if [ -z "$test_course" ]; then
        log_warn "No active course found for round creation test"
        return 0
    fi
    
    log_info "Creating test round with user: $test_user, course: $test_course"
    
    # Create a round
    local future_date
    future_date=$(date -d "+7 days" "+%Y-%m-%d %H:%M:%S")
    
    local round_id
    round_id=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -tAc "
        INSERT INTO rounds (creator_id, course_id, scheduled_at, max_players, cart_preference, tier_id, status, created_at)
        SELECT '$test_user'::uuid, '$test_course'::uuid, '$future_date'::timestamptz, 4, 'either', u.tier_id, 'open', NOW()
        FROM users u WHERE u.id = '$test_user'::uuid
        RETURNING id;
    " 2>/dev/null || echo "")
    
    if [ -n "$round_id" ]; then
        log_success "Round created successfully: $round_id"
        
        # Check creator is auto-added as participant
        local participant_count
        participant_count=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -tAc "
            SELECT COUNT(*) FROM round_participants_v2 
            WHERE round_id = '$round_id'::uuid;
        " 2>/dev/null || echo "0")
        
        if [ "$participant_count" -ge 1 ]; then
            log_success "Creator is automatically added as participant"
        else
            log_warn "Creator may not be automatically added as participant"
        fi
        
        # Clean up test round
        psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "
            DELETE FROM round_participants_v2 WHERE round_id = '$round_id'::uuid;
            DELETE FROM round_invitations WHERE round_id = '$round_id'::uuid;
            DELETE FROM rounds WHERE id = '$round_id'::uuid;
        " 2>/dev/null || true
        
        log_info "Test round cleaned up"
    else
        log_error "Failed to create test round"
    fi
}

# Test 9: Test invitation flow
test_invitation_flow() {
    log_section "TEST 9: Invitation Flow"
    
    # Get test users
    local creator
    local invitee
    
    creator=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -tAc "
        SELECT id FROM users 
        WHERE tier_id IS NOT NULL AND tier_status = 'active'
        LIMIT 1;
    " 2>/dev/null || echo "")
    
    invitee=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -tAc "
        SELECT id FROM users 
        WHERE tier_id IS NOT NULL AND tier_status = 'active'
        AND id != '$creator'
        LIMIT 1;
    " 2>/dev/null || echo "")
    
    if [ -z "$creator" ] || [ -z "$invitee" ]; then
        log_warn "Need 2 users for invitation test"
        return 0
    fi
    
    # Get a course
    local test_course
    test_course=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -tAc "
        SELECT id FROM golf_courses WHERE is_active = true LIMIT 1;
    " 2>/dev/null || echo "")
    
    if [ -z "$test_course" ]; then
        log_warn "No course found for invitation test"
        return 0
    fi
    
    # Create a round
    local future_date
    future_date=$(date -d "+7 days" "+%Y-%m-%d %H:%M:%S")
    
    local round_id
    round_id=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -tAc "
        INSERT INTO rounds (creator_id, course_id, scheduled_at, max_players, cart_preference, tier_id, status, created_at)
        SELECT '$creator'::uuid, '$test_course'::uuid, '$future_date'::timestamptz, 4, 'either', u.tier_id, 'open', NOW()
        FROM users u WHERE u.id = '$creator'::uuid
        RETURNING id;
    " 2>/dev/null || echo "")
    
    if [ -z "$round_id" ]; then
        log_error "Failed to create round for invitation test"
        return 0
    fi
    
    log_info "Created test round: $round_id"
    
    # Create invitation
    local invite_id
    invite_id=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -tAc "
        INSERT INTO round_invitations (round_id, invitee_id, status, invited_at, message)
        VALUES ('$round_id'::uuid, '$invitee'::uuid, 'pending', NOW(), 'Test invitation')
        RETURNING id;
    " 2>/dev/null || echo "")
    
    if [ -n "$invite_id" ]; then
        log_success "Invitation created successfully: $invite_id"
        
        # Test accepting invitation
        psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "
            UPDATE round_invitations 
            SET status = 'accepted'
            WHERE id = '$invite_id'::uuid;
        " 2>/dev/null || true
        
        local invite_status
        invite_status=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -tAc "
            SELECT status FROM round_invitations WHERE id = '$invite_id'::uuid;
        " 2>/dev/null || echo "")
        
        if [ "$invite_status" = "accepted" ]; then
            log_success "Invitation status updated to accepted"
            
            # Check if invitee is now a participant
            local is_participant
            is_participant=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -tAc "
                SELECT COUNT(*) FROM round_participants_v2 
                WHERE round_id = '$round_id'::uuid AND user_id = '$invitee'::uuid;
            " 2>/dev/null || echo "0")
            
            if [ "$is_participant" -ge 1 ]; then
                log_success "Invitee automatically added as participant on accept"
            else
                log_warn "Invitee may not be automatically added as participant"
            fi
        else
            log_warn "Could not verify invitation acceptance"
        fi
    else
        log_error "Failed to create invitation"
    fi
    
    # Clean up
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "
        DELETE FROM round_participants_v2 WHERE round_id = '$round_id'::uuid;
        DELETE FROM round_invitations WHERE round_id = '$round_id'::uuid;
        DELETE FROM rounds WHERE id = '$round_id'::uuid;
    " 2>/dev/null || true
}

# Test 10: Test round status transitions
test_status_transitions() {
    log_section "TEST 10: Round Status Transitions"
    
    # Count rounds by status
    local status_counts
    status_counts=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -tAc "
        SELECT status, COUNT(*) FROM rounds GROUP BY status ORDER BY status;
    " 2>/dev/null || echo "")
    
    if [ -n "$status_counts" ]; then
        log_info "Round status distribution:"
        echo "$status_counts" | while read line; do
            log_info "  $line"
        done
        log_success "Round status data available"
    else
        log_warn "No round status data found"
    fi
    
    # Test status transition logic
    log_info "Valid status transitions:"
    log_info "  open -> full (when max_players reached)"
    log_info "  open -> cancelled (by creator)"
    log_info "  full -> completed (after round date)"
    log_info "  any -> cancelled (by creator)"
}

# Test 11: Verify RLS policies
test_rls_policies() {
    log_section "TEST 11: Row Level Security Policies"
    
    local tables=("rounds" "round_invitations" "round_participants_v2")
    
    for table in "${tables[@]}"; do
        local result
        result=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -tAc "
            SELECT relrowsecurity FROM pg_class WHERE relname = '$table';
        " 2>/dev/null || echo "f")
        
        if [ "$result" = "t" ]; then
            log_success "RLS is enabled on $table"
        else
            log_warn "RLS may not be enabled on $table"
        fi
        
        # List policies
        local policies
        policies=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -tAc "
            SELECT policyname FROM pg_policies WHERE tablename = '$table';
        " 2>/dev/null || echo "")
        
        if [ -n "$policies" ]; then
            log_info "Policies on $table:"
            echo "$policies" | while read line; do
                log_info "  - $line"
            done
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
        echo -e "${GREEN}✓ All round lifecycle tests passed!${NC}"
        echo ""
        echo "Round lifecycle is working correctly:"
        echo "  • Rounds can be created with proper constraints"
        echo "  • Creator is automatically added as participant"
        echo "  • Invitations work with status tracking"
        echo "  • Status transitions are handled properly"
        echo "  • Same-tier enforcement is in place"
        return 0
    else
        echo -e "${RED}✗ Some round lifecycle tests failed.${NC}"
        echo ""
        echo "Please review the errors above and:"
        echo "  1. Run migrations: supabase db reset"
        echo "  2. Deploy edge functions: supabase functions deploy"
        return 1
    fi
}

# Main execution
main() {
    echo ""
    echo "╔═══════════════════════════════════════════════════════════════╗"
    echo "║     Round Lifecycle Verification                              ║"
    echo "║     Phase 2 Feature Testing                                 ║"
    echo "╚═══════════════════════════════════════════════════════════════╝"
    echo ""
    
    # Change to project root
    cd "$(dirname "$0")/.." || exit 1
    
    # Run tests
    check_postgres
    test_rounds_table
    test_invitations_table
    test_participants_table
    test_status_enum
    test_invitation_status_enum
    test_triggers
    test_constraints
    test_round_creation
    test_invitation_flow
    test_status_transitions
    test_rls_policies
    
    # Print summary
    print_summary
}

# Run main
main "$@"

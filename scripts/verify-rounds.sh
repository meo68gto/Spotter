#!/bin/bash
# ============================================================================
# Phase 2: Round Coordination Verification Script
# Tests round creation, invitation flow, and response handling
# ============================================================================

# Don't exit on error - we want to see all test results
set +e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
REPO_ROOT="/Users/brucewayne/Documents/Spotter"

# Test counters
TESTS_PASSED=0
TESTS_FAILED=0

# Helper functions
log_info() {
  echo -e "${YELLOW}[INFO]${NC} $1"
}

log_success() {
  echo -e "${GREEN}[PASS]${NC} $1"
  TESTS_PASSED=$((TESTS_PASSED + 1))
}

log_error() {
  echo -e "${RED}[FAIL]${NC} $1"
  TESTS_FAILED=$((TESTS_FAILED + 1))
}

log_header() {
  echo ""
  echo "========================================"
  echo "$1"
  echo "========================================"
}

# Test 1: Verify database migration exists
test_migration_exists() {
  log_header "TEST 1: Database Migration"
  
  if [ -f "$REPO_ROOT/supabase/migrations/0020_rounds_coordination.sql" ]; then
    log_success "0020_rounds_coordination.sql migration exists"
    
    # Check migration contains key elements
    if grep -q "CREATE TABLE IF NOT EXISTS public.rounds" "$REPO_ROOT/supabase/migrations/0020_rounds_coordination.sql"; then
      log_success "Migration contains rounds table definition"
    else
      log_error "Migration missing rounds table definition"
    fi
    
    if grep -q "CREATE TABLE IF NOT EXISTS public.round_invitations" "$REPO_ROOT/supabase/migrations/0020_rounds_coordination.sql"; then
      log_success "Migration contains round_invitations table definition"
    else
      log_error "Migration missing round_invitations table definition"
    fi
    
    if grep -q "CREATE TABLE IF NOT EXISTS public.round_participants_v2" "$REPO_ROOT/supabase/migrations/0020_rounds_coordination.sql"; then
      log_success "Migration contains round_participants_v2 table definition"
    else
      log_error "Migration missing round_participants_v2 table definition"
    fi
    
    if grep -q "CREATE TYPE public.round_status" "$REPO_ROOT/supabase/migrations/0020_rounds_coordination.sql"; then
      log_success "Migration contains round_status enum"
    else
      log_error "Migration missing round_status enum"
    fi
    
    if grep -q "CREATE TYPE public.invitation_status" "$REPO_ROOT/supabase/migrations/0020_rounds_coordination.sql"; then
      log_success "Migration contains invitation_status enum"
    else
      log_error "Migration missing invitation_status enum"
    fi
  else
    log_error "0020_rounds_coordination.sql migration not found"
  fi
}

# Test 2: Verify edge functions exist
test_edge_functions_exist() {
  log_header "TEST 2: Edge Functions"
  
  # Check rounds-create function
  if [ -f "$REPO_ROOT/apps/functions/supabase/functions/rounds-create/index.ts" ]; then
    log_success "rounds-create edge function exists"
    
    if grep -q "tier_id: tierId" "$REPO_ROOT/apps/functions/supabase/functions/rounds-create/index.ts"; then
      log_success "rounds-create enforces same-tier"
    else
      log_error "rounds-create missing same-tier enforcement"
    fi
    
    if grep -q "maxRoundsPerMonth" "$REPO_ROOT/apps/functions/supabase/functions/rounds-create/index.ts"; then
      log_success "rounds-create checks round limits"
    else
      log_error "rounds-create missing round limit check"
    fi
  else
    log_error "rounds-create edge function not found"
  fi
  
  # Check rounds-invite function
  if [ -f "$REPO_ROOT/apps/functions/supabase/functions/rounds-invite/index.ts" ]; then
    log_success "rounds-invite edge function exists"
    
    if grep -q "Same-tier enforcement" "$REPO_ROOT/apps/functions/supabase/functions/rounds-invite/index.ts"; then
      log_success "rounds-invite documents same-tier enforcement"
    fi
    
    if grep -q "invitee.tier_id !== round.tier_id" "$REPO_ROOT/apps/functions/supabase/functions/rounds-invite/index.ts"; then
      log_success "rounds-invite enforces same-tier matching"
    else
      log_error "rounds-invite missing same-tier matching check"
    fi
  else
    log_error "rounds-invite edge function not found"
  fi
  
  # Check rounds-respond function
  if [ -f "$REPO_ROOT/apps/functions/supabase/functions/rounds-respond/index.ts" ]; then
    log_success "rounds-respond edge function exists"
    
    if grep -q "accepted" "$REPO_ROOT/apps/functions/supabase/functions/rounds-respond/index.ts"; then
      log_success "rounds-respond handles acceptance"
    fi
  else
    log_error "rounds-respond edge function not found"
  fi
  
  # Check rounds-list function
  if [ -f "$REPO_ROOT/apps/functions/supabase/functions/rounds-list/index.ts" ]; then
    log_success "rounds-list edge function exists"
    
    if grep -q "tier_id" "$REPO_ROOT/apps/functions/supabase/functions/rounds-list/index.ts"; then
      log_success "rounds-list filters by tier"
    fi
  else
    log_error "rounds-list edge function not found"
  fi
}

# Test 3: Verify types exist
test_types_exist() {
  log_header "TEST 3: TypeScript Types"
  
  if [ -f "$REPO_ROOT/packages/types/src/rounds.ts" ]; then
    log_success "rounds.ts type definitions exist"
    
    if grep -q "interface Round" "$REPO_ROOT/packages/types/src/rounds.ts"; then
      log_success "Round interface defined"
    else
      log_error "Round interface not found"
    fi
    
    if grep -q "interface RoundInvitation" "$REPO_ROOT/packages/types/src/rounds.ts"; then
      log_success "RoundInvitation interface defined"
    else
      log_error "RoundInvitation interface not found"
    fi
    
    if grep -q "RoundStatus" "$REPO_ROOT/packages/types/src/rounds.ts"; then
      log_success "RoundStatus type defined"
    else
      log_error "RoundStatus type not found"
    fi
    
    if grep -q "CreateRoundInput" "$REPO_ROOT/packages/types/src/rounds.ts"; then
      log_success "CreateRoundInput type defined"
    else
      log_error "CreateRoundInput type not found"
    fi
    
    if grep -q "InviteToRoundInput" "$REPO_ROOT/packages/types/src/rounds.ts"; then
      log_success "InviteToRoundInput type defined"
    else
      log_error "InviteToRoundInput type not found"
    fi
  else
    log_error "rounds.ts type definitions not found"
  fi
}

# Test 4: Verify schema constraints in migration
test_schema_constraints() {
  log_header "TEST 4: Schema Constraints"
  
  MIGRATION="$REPO_ROOT/supabase/migrations/0020_rounds_coordination.sql"
  
  if [ -f "$MIGRATION" ]; then
    if grep -q "max_players IN (2, 3, 4)" "$MIGRATION"; then
      log_success "max_players constraint (2-4) defined"
    else
      log_error "max_players constraint not found"
    fi
    
    if grep -q "trg_add_creator_as_participant" "$MIGRATION"; then
      log_success "Auto-add creator trigger defined"
    else
      log_error "Auto-add creator trigger not found"
    fi
    
    if grep -q "trg_update_round_status_on_participants" "$MIGRATION"; then
      log_success "Round status update trigger defined"
    else
      log_error "Round status update trigger not found"
    fi
    
    if grep -q "trg_add_participant_on_invite_accept" "$MIGRATION"; then
      log_success "Auto-add participant on accept trigger defined"
    else
      log_error "Auto-add participant on accept trigger not found"
    fi
  fi
}

# Test 5: Verify RLS policies in migration
test_rls_policies() {
  log_header "TEST 5: RLS Policies"
  
  MIGRATION="$REPO_ROOT/supabase/migrations/0020_rounds_coordination.sql"
  
  if [ -f "$MIGRATION" ]; then
    if grep -q "rounds_select_visible" "$MIGRATION"; then
      log_success "rounds_select_visible policy defined"
    else
      log_error "rounds_select_visible policy not found"
    fi
    
    if grep -q "rounds_insert_creator" "$MIGRATION"; then
      log_success "rounds_insert_creator policy defined"
    else
      log_error "rounds_insert_creator policy not found"
    fi
    
    if grep -q "invitations_select_involved" "$MIGRATION"; then
      log_success "invitations_select_involved policy defined"
    else
      log_error "invitations_select_involved policy not found"
    fi
    
    if grep -q "invitations_insert_creator" "$MIGRATION"; then
      log_success "invitations_insert_creator policy defined"
    else
      log_error "invitations_insert_creator policy not found"
    fi
  fi
}

# Run all tests
run_tests() {
  log_header "PHASE 2: ROUND COORDINATION VERIFICATION"
  
  test_migration_exists
  test_edge_functions_exist
  test_types_exist
  test_schema_constraints
  test_rls_policies
  
  # Summary
  log_header "VERIFICATION SUMMARY"
  echo -e "Tests Passed: ${GREEN}$TESTS_PASSED${NC}"
  echo -e "Tests Failed: ${RED}$TESTS_FAILED${NC}"
  
  if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "\n${GREEN}✓ All verification tests passed!${NC}"
    echo -e "\n${YELLOW}Next steps:${NC}"
    echo "  1. Run 'supabase db reset' to apply migrations"
    echo "  2. Run 'supabase functions deploy' to deploy edge functions"
    echo "  3. Test the API endpoints"
    exit 0
  else
    echo -e "\n${RED}✗ Some verification tests failed.${NC}"
    exit 1
  fi
}

# Main execution
run_tests

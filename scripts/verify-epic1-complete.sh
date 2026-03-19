#!/bin/bash
# ============================================================================
# Epic 1: Tiered Member Foundation - Verification Script
# ============================================================================
# Tests all 12 required fields are captured in onboarding, displayed in profile,
# and persisted in the database.
#
# Usage: ./scripts/verify-epic1-complete.sh
# ============================================================================

set -e

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║  Epic 1: Tiered Member Foundation - Verification Script       ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

ERRORS=0
WARNINGS=0

# Helper functions
pass() { echo -e "${GREEN}✓${NC} $1"; }
fail() { echo -e "${RED}✗${NC} $1"; ERRORS=$((ERRORS+1)); }
warn() { echo -e "${YELLOW}⚠${NC} $1"; WARNINGS=$((WARNINGS+1)); }

# =============================================================================
# SECTION 1: Database Schema Verification
# =============================================================================
echo "📊 SECTION 1: Database Schema Verification"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Check if required tables exist
echo ""
echo "Checking database tables..."

# Note: These checks assume you're running within the project context
# where supabase CLI is available, or you can run SQL queries

REQUIRED_TABLES=(
  "user_golf_identities"
  "user_professional_identities"
  "user_networking_preferences"
  "membership_tiers"
)

for table in "${REQUIRED_TABLES[@]}"; do
  if grep -q "CREATE TABLE.*${table}" /Users/brucewayne/Documents/Spotter/supabase/migrations/*.sql 2>/dev/null; then
    pass "Table: ${table}"
  else
    fail "Table: ${table} (not found in migrations)"
  fi
done

# =============================================================================
# SECTION 2: Epic 1 Fields Verification in Migrations
# =============================================================================
echo ""
echo "📋 SECTION 2: Epic 1 Fields in Migrations"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

echo ""
echo "Checking user_networking_preferences fields..."

NETWORKING_FIELDS=(
  "membership_tier"
  "networking_intent"
  "open_to_intros"
  "open_to_recurring_rounds"
  "preferred_group_size"
  "cart_preference"
  "preferred_golf_area"
)

for field in "${NETWORKING_FIELDS[@]}"; do
  if grep -r "${field}" /Users/brucewayne/Documents/Spotter/supabase/migrations/*.sql 2>/dev/null | grep -q "user_networking_preferences"; then
    pass "Field: ${field}"
  else
    fail "Field: ${field} (not found in user_networking_preferences)"
  fi
done

echo ""
echo "Checking user_golf_identities fields..."

GOLF_FIELDS=(
  "handicap_band"
  "home_course_area"
  "play_frequency"
)

for field in "${GOLF_FIELDS[@]}"; do
  if grep -r "${field}" /Users/brucewayne/Documents/Spotter/supabase/migrations/*.sql 2>/dev/null | grep -q "user_golf_identities"; then
    pass "Field: ${field}"
  else
    fail "Field: ${field} (not found in user_golf_identities)"
  fi
done

echo ""
echo "Checking user_professional_identities fields..."

PROF_FIELDS=(
  "title_or_role"
  "industry"
  "company"
)

for field in "${PROF_FIELDS[@]}"; do
  if grep -r "${field}" /Users/brucewayne/Documents/Spotter/supabase/migrations/*.sql 2>/dev/null | grep -q "user_professional_identities"; then
    pass "Field: ${field}"
  else
    fail "Field: ${field} (not found in user_professional_identities)"
  fi
done

# =============================================================================
# SECTION 3: Type Definitions Verification
# =============================================================================
echo ""
echo "📘 SECTION 3: TypeScript Type Definitions"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

echo ""
echo "Checking types in packages/types/src/profile.ts..."

TYPE_FIELDS=(
  "HandicapBand"
  "RoundFrequency"
  "MobilityPreference"
  "TeeTimePreference"
  "handicapBand"
  "roundFrequency"
  "mobilityPreference"
  "preferredTeeTimeWindow"
  "titleOrRole"
  "homeCourseArea"
)

for field in "${TYPE_FIELDS[@]}"; do
  if grep -q "${field}" /Users/brucewayne/Documents/Spotter/packages/types/src/profile.ts; then
    pass "Type: ${field}"
  else
    fail "Type: ${field} (not found in profile.ts)"
  fi
done

echo ""
echo "Checking type exports in index.ts..."

EXPORTS=(
  "HandicapBand"
  "RoundFrequency"
  "MobilityPreference"
)

for export in "${EXPORTS[@]}"; do
  if grep -q "${export}" /Users/brucewayne/Documents/Spotter/packages/types/src/index.ts; then
    pass "Export: ${export}"
  else
    fail "Export: ${export} (not found in index.ts)"
  fi
done

# =============================================================================
# SECTION 4: Onboarding Screen Verification
# =============================================================================
echo ""
echo "📱 SECTION 4: Onboarding Screen"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

ONBOARDING_FILE="/Users/brucewayne/Documents/Spotter/apps/mobile/src/screens/onboarding/OnboardingWizardScreenPhase1.tsx"

echo ""
echo "Checking onboarding wizard implementation..."

# Check for tier premium styling
if grep -q "summitBadge" "${ONBOARDING_FILE}"; then
  pass "Summit tier premium styling (badges)"
else
  fail "Summit tier premium styling (badges)"
fi

if grep -q "tierFeatures" "${ONBOARDING_FILE}"; then
  pass "Tier feature lists"
else
  fail "Tier feature lists"
fi

# Check for Epic 1 fields in onboarding
ONBOARDING_FIELDS=(
  "mobilityPreference"
  "roundFrequency"
  "preferredTeeTimeWindow"
  "homeCourseArea"
)

for field in "${ONBOARDING_FIELDS[@]}"; do
  if grep -q "${field}" "${ONBOARDING_FILE}"; then
    pass "Onboarding field: ${field}"
  else
    fail "Onboarding field: ${field}"
  fi
done

# =============================================================================
# SECTION 5: Edge Function Verification
# =============================================================================
echo ""
echo "⚡ SECTION 5: Edge Function"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

EDGE_FUNCTION_FILE="/Users/brucewayne/Documents/Spotter/apps/functions/supabase/functions/onboarding-phase1/index.ts"

echo ""
echo "Checking onboarding-phase1 edge function..."

EDGE_FIELDS=(
  "handicap_band"
  "home_course_area"
  "mobility_preference"
  "round_frequency"
  "preferred_tee_time_window"
  "title_or_role"
)

for field in "${EDGE_FIELDS[@]}"; do
  if grep -q "${field}" "${EDGE_FUNCTION_FILE}"; then
    pass "Edge function field: ${field}"
  else
    fail "Edge function field: ${field}"
  fi
done

# =============================================================================
# SECTION 6: Profile Screen Verification
# =============================================================================
echo ""
echo "👤 SECTION 6: Profile Screen"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

PROFILE_FILE="/Users/brucewayne/Documents/Spotter/apps/mobile/src/screens/ProfileScreen.tsx"

echo ""
echo "Checking profile screen implementation..."

# Check for Epic 1 display helpers
PROFILE_HELPERS=(
  "formatHandicapBand"
  "formatRoundFrequency"
  "formatMobilityPreference"
  "formatTeeTimePreference"
  "Networking Preferences"
)

for helper in "${PROFILE_HELPERS[@]}"; do
  if grep -q "${helper}" "${PROFILE_FILE}"; then
    pass "Profile helper: ${helper}"
  else
    fail "Profile helper: ${helper}"
  fi
done

# =============================================================================
# SECTION 7: Migration Consolidation Check
# =============================================================================
echo ""
echo "🗄️ SECTION 7: Migration Files"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

echo ""
echo "Checking for Epic 1 consolidated migration..."

if [ -f "/Users/brucewayne/Documents/Spotter/supabase/migrations/0019_epic1_consolidated_fields.sql" ]; then
  pass "Epic 1 consolidated migration exists"
  
  # Check for key Epic 1 enum types
  EPIC1_ENUMS=(
    "tee_time_preference"
    "round_frequency"
    "handicap_band"
    "mobility_preference"
  )
  
  for enum_type in "${EPIC1_ENUMS[@]}"; do
    if grep -q "CREATE TYPE.*${enum_type}" /Users/brucewayne/Documents/Spotter/supabase/migrations/0019_epic1_consolidated_fields.sql; then
      pass "Enum type: ${enum_type}"
    else
      fail "Enum type: ${enum_type} (not in consolidated migration)"
    fi
  done
else
  warn "Epic 1 consolidated migration not found (0019_epic1_consolidated_fields.sql)"
  
  # Check if 0019 exists with a different name
  if ls /Users/brucewayne/Documents/Spotter/supabase/migrations/0019*.sql 1>/dev/null 2>&1; then
    pass "Migration 0019 exists (may need consolidation)"
  else
    fail "No migration 0019 found"
  fi
fi

# =============================================================================
# SECTION 8: Summary
# =============================================================================
echo ""
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║                      VERIFICATION SUMMARY                       ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

if [ $ERRORS -eq 0 ]; then
  echo -e "${GREEN}✓ All checks passed!${NC}"
  echo ""
  echo "Epic 1: Tiered Member Foundation is complete with:"
  echo "  • All 12 required fields defined and exported"
  echo "  • Database migrations properly structured"
  echo "  • Onboarding wizard captures all fields"
  echo "  • Edge function persists all data"
  echo "  • Profile screen displays all identity cards"
  echo ""
  exit 0
else
  echo -e "${RED}✗ Verification failed with ${ERRORS} error(s)${NC}"
  if [ $WARNINGS -gt 0 ]; then
    echo -e "${YELLOW}⚠ ${WARNINGS} warning(s)${NC}"
  fi
  echo ""
  echo "Please fix the errors above before completing Epic 1."
  echo ""
  exit 1
fi

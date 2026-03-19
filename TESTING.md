# Spotter Phase 1-2 Testing Documentation

Comprehensive test suite for Phase 1 (Matching Engine + Discovery) and Phase 2 (Round Coordination) features.

## Table of Contents

- [Overview](#overview)
- [Test Structure](#test-structure)
- [Prerequisites](#prerequisites)
- [Running Tests](#running-tests)
- [Test Coverage](#test-coverage)
- [Verification Checklist](#verification-checklist)
- [Troubleshooting](#troubleshooting)

## Overview

This test suite validates:
- **Same-Tier Visibility**: Users only see content from members in their tier
- **Matching Algorithm**: Compatibility scores calculate correctly
- **Discovery Search**: Filtering and search work as expected
- **Round Coordination**: Creation, invitations, and lifecycle work correctly
- **Tier Limits**: FREE tier is limited to 3 rounds/month

## Test Structure

```
/Users/brucewayne/Documents/Spotter/
├── apps/e2e/tests/
│   ├── tier-visibility.spec.ts        # Same-tier visibility E2E
│   ├── discovery.spec.ts              # Discovery search E2E
│   ├── matching.spec.ts               # Matching algorithm E2E
│   ├── rounds.spec.ts                 # Round lifecycle E2E
│   └── onboarding-phase1.spec.ts        # Onboarding flow E2E
├── apps/api-tests/tests/
│   ├── discovery-api.test.ts          # Discovery API integration
│   ├── matching-api.test.ts           # Matching API integration
│   └── rounds-api.test.ts             # Rounds API integration
├── scripts/
│   ├── verify-same-tier-enforcement.sh # Same-tier verification
│   ├── verify-matching-accuracy.sh     # Matching algorithm verification
│   ├── verify-round-lifecycle.sh       # Round lifecycle verification
│   └── setup-test-data.ts              # Test data setup
└── TESTING.md                          # This file
```

## Prerequisites

### Local Development

1. **PostgreSQL**: Local database running on port 5432
2. **Supabase CLI**: For edge function testing
3. **Node.js**: v18+ for running test scripts

### Environment Variables

Create `.env.test` in `apps/e2e/`:

```env
TEST_BASE_URL=http://localhost:3000
SUPABASE_URL=http://localhost:54321
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

For API tests, set:

```bash
export SUPABASE_URL=http://localhost:54321
export SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

## Running Tests

### 1. Database Verification Scripts

These scripts test the PostgreSQL functions and database structure:

```bash
# Verify same-tier enforcement
cd /Users/brucewayne/Documents/Spotter
./scripts/verify-same-tier-enforcement.sh

# Verify matching algorithm accuracy
./scripts/verify-matching-accuracy.sh

# Verify round lifecycle
./scripts/verify-round-lifecycle.sh
```

### 2. E2E Tests

```bash
cd /Users/brucewayne/Documents/Spotter/apps/e2e

# Install dependencies
npm install

# Run all E2E tests
npx playwright test

# Run specific test file
npx playwright test discovery.spec.ts

# Run with headed browser (for debugging)
npx playwright test --headed

# Run with specific project
npx playwright test --project=chromium
```

### 3. API Integration Tests

```bash
cd /Users/brucewayne/Documents/Spotter/apps/api-tests

# Install dependencies
npm install

# Run all API tests
npm test

# Run specific test file
npm test discovery-api.test.ts
```

### 4. Setup Test Data

```bash
cd /Users/brucewayne/Documents/Spotter

# Run TypeScript setup script
npx ts-node scripts/setup-test-data.ts
```

This creates:
- 9 test users (3 per tier: FREE, SELECT, SUMMIT)
- Connections between same-tier users
- Test rounds with invitations

## Test Coverage

### E2E Tests

#### `tier-visibility.spec.ts`
- Member directory same-tier filtering
- Matching candidates same-tier filtering
- Event participants same-tier filtering
- Leaderboard same-tier filtering
- Activity feed same-tier filtering
- Search same-tier filtering
- Profile view same-tier filtering
- Connection requests same-tier filtering

#### `discovery.spec.ts`
- Basic search functionality
- Same-tier filtering
- Handicap band filtering
- Location filtering
- Networking intent filtering
- Combined filters
- Pagination
- Result details display
- Error handling

#### `matching.spec.ts`
- Basic matching suggestions
- Same-tier filtering
- Compatibility factors display
- Match details display
- Send/dismiss match actions
- Calculate specific match
- Privacy controls (open_to_intros)
- Filtering and sorting
- Error handling

#### `rounds.spec.ts`
- Round creation with tier limits
- Same-tier enforcement
- Invitations and responses
- Round list and discovery
- Round detail view
- Status transitions
- Error handling

#### `onboarding-phase1.spec.ts`
- Welcome and tier selection
- Golf identity setup
- Professional identity setup
- Networking preferences
- Location and timezone
- Completion flow
- Navigation and progress

### API Tests

#### `discovery-api.test.ts`
- Authentication requirements
- Same-tier filtering
- Handicap band filtering
- Location filtering
- Intent filtering
- Pagination
- Response structure validation

#### `matching-api.test.ts`
- Top matches retrieval
- Calculate specific match
- PostgreSQL function tests
- Match score structure validation
- Same-tier filtering
- Privacy controls

#### `rounds-api.test.ts`
- Round creation
- Tier limit enforcement
- Rounds listing
- Invitations
- Response handling
- Status management

## Verification Checklist

Run these checks to verify Phase 1-2 features:

### Same-Tier Enforcement ✓

- [ ] FREE users only see FREE users
- [ ] SELECT users only see SELECT users
- [ ] SUMMIT users only see SUMMIT users
- [ ] Discovery search filters by tier
- [ ] Matching algorithm filters by tier
- [ ] Rounds list filters by tier
- [ ] Invitations enforce same-tier matching

**Verification:**
```bash
./scripts/verify-same-tier-enforcement.sh
```

### Matching Algorithm ✓

- [ ] Handicap similarity calculates correctly
  - Same handicap = 100%
  - 5 strokes apart = 75%
  - 10 strokes apart = 50%
  - 20+ strokes apart = 25%
- [ ] Intent compatibility calculates correctly
  - Same intent = 100%
  - Business vs Social = 25%
  - Business vs Business_Social = 75%
- [ ] Location score calculates correctly
  - Same area (<15km) = 100%
  - Nearby (15-50km) = 75%
  - Different area (50km+) = 25%
- [ ] Group size compatibility calculates correctly
  - Same size = 100%
  - Different size = proportional
  - Any matches all = 100%
- [ ] Overall score is weighted average of factors
- [ ] Match tier labels are correct
  - Excellent: 80-100%
  - Good: 60-79%
  - Fair: 40-59%
  - Poor: 0-39%

**Verification:**
```bash
./scripts/verify-matching-accuracy.sh
```

### Discovery Search ✓

- [ ] Returns results only from same tier
- [ ] Filters by handicap band (low/mid/high)
- [ ] Filters by location (city/state)
- [ ] Filters by networking intent
- [ ] Supports combined filters
- [ ] Pagination works correctly
- [ ] Shows compatibility score
- [ ] Shows reputation score

**Verification:**
```bash
npx playwright test discovery.spec.ts
npm test discovery-api.test.ts
```

### Round Coordination ✓

- [ ] Rounds can be created with proper fields
- [ ] Creator is automatically added as participant
- [ ] Scheduled date must be in future
- [ ] Max players limited to 2, 3, or 4
- [ ] FREE tier limited to 3 rounds/month
- [ ] SELECT/SUMMIT tiers have unlimited rounds
- [ ] Invitations work within same tier
- [ ] Cannot invite self
- [ ] Cannot invite existing participants
- [ ] Cannot invite to full rounds
- [ ] Status transitions work (open -> full -> completed)
- [ ] Invitations can be accepted/declined

**Verification:**
```bash
./scripts/verify-round-lifecycle.sh
npx playwright test rounds.spec.ts
npm test rounds-api.test.ts
```

### Onboarding Flow ✓

- [ ] Tier selection works for all tiers
- [ ] Golf identity captures handicap band
- [ ] Professional identity is optional
- [ ] Networking preferences are captured
- [ ] Location and timezone are set
- [ ] Reputation record is created
- [ ] Progress is tracked across steps

**Verification:**
```bash
npx playwright test onboarding-phase1.spec.ts
```

## Troubleshooting

### Database Connection Issues

```bash
# Check if PostgreSQL is running
pg_isready -h localhost -p 5432

# Start Supabase local stack
supabase start

# Reset database (caution: deletes data)
supabase db reset
```

### Edge Function Not Found (404)

```bash
# Deploy edge functions
supabase functions deploy discovery-search
supabase functions deploy matching-suggestions
supabase functions deploy rounds-create
supabase functions deploy rounds-list
supabase functions deploy rounds-invite
```

### E2E Test Failures

```bash
# Run with headed browser to see what's happening
npx playwright test --headed

# Debug specific test
npx playwright test --debug

# View trace
npx playwright show-trace trace.zip
```

### Test Data Issues

```bash
# Reset and re-seed test data
npx ts-node scripts/setup-test-data.ts

# Check test users exist
psql -h localhost -U postgres -d spotter -c "
  SELECT u.email, mt.slug as tier, u.tier_status
  FROM users u
  JOIN membership_tiers mt ON mt.id = u.tier_id
  WHERE u.email LIKE 'test-%@spotter.local';
"
```

## Expected Results

### Same-Tier Filtering

| User Tier | Can See | Cannot See |
|-----------|---------|------------|
| FREE | FREE users | SELECT, SUMMIT |
| SELECT | SELECT users | FREE, SUMMIT |
| SUMMIT | SUMMIT users | FREE, SELECT |

### Matching Scores

| Factor | Same Value | Different Value |
|--------|------------|-----------------|
| Handicap | 100% | Decreases with difference |
| Intent | 100% | 25-75% depending on compatibility |
| Location | 100% (same area) | 25-75% based on distance |
| Group Size | 100% | 25-50% based on difference |

### Round Limits

| Tier | Monthly Limit |
|------|---------------|
| FREE | 3 rounds |
| SELECT | Unlimited |
| SUMMIT | Unlimited |

## Continuous Integration

For CI/CD pipelines, add these steps:

```yaml
# .github/workflows/test.yml
- name: Setup test data
  run: npx ts-node scripts/setup-test-data.ts

- name: Run database verification
  run: |
    ./scripts/verify-same-tier-enforcement.sh
    ./scripts/verify-matching-accuracy.sh
    ./scripts/verify-round-lifecycle.sh

- name: Run E2E tests
  run: npx playwright test

- name: Run API tests
  run: npm test
```

## Maintenance

When adding new features:

1. Add E2E tests in `apps/e2e/tests/`
2. Add API tests in `apps/api-tests/tests/`
3. Update verification scripts in `scripts/`
4. Update this documentation

## Support

For issues with tests:
1. Check test output for specific error messages
2. Verify database has required data
3. Ensure edge functions are deployed
4. Review logs in `test-results/` directory

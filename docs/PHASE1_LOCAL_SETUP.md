# Phase 1 Local Development Setup

## Prerequisites

- PostgreSQL 14+ running locally
- Node.js 18+ and npm
- Deno (for edge functions)

## Step 1: Database Migration

```bash
# Set your database URL
export DATABASE_URL=postgres://user:password@localhost:5432/spotter

# Run the migration
bash scripts/migrate-phase1-local.sh
```

## Step 2: Verify Migration

```bash
bash scripts/verify-phase1-local.sh
```

Expected output:
- `user_networking_preferences` table exists
- Tier prices: Free $0, Select $100000, Summit $1000000
- Enums created: networking_intent, preferred_group_size, cart_preference
- Indexes created

## Step 3: Run Edge Function Locally

```bash
# Set Supabase environment variables
export SUPABASE_URL=http://localhost:54321
export SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Run the function
bash scripts/run-edge-function-local.sh
```

## Step 4: Start Mobile App

```bash
cd apps/mobile
npm install
npm run ios  # or npm run android
```

The new Phase 1 onboarding wizard should now appear for new users.

## Testing Phase 1

1. Create a new account
2. Complete 4-step onboarding:
   - Select tier (Free/Select/Summit)
   - Enter golf identity (handicap, frequency, home course)
   - Enter professional info (optional)
   - Select networking preferences
3. Verify profile shows all new fields

## Same-Tier Enforcement

Database-level RLS policies are active. To test:

```sql
-- Create two users in different tiers
-- User A (Free tier)
-- User B (Select tier)

-- User A should NOT see User B in queries
-- User A should see other Free tier users
```

Application-level filtering should also be added in Phase 2.

## Troubleshooting

### Migration fails
- Check PostgreSQL is running: `pg_isready`
- Verify DATABASE_URL is correct
- Check user has CREATE privileges

### Edge function fails
- Ensure Deno is installed: `deno --version`
- Check SUPABASE_URL is reachable
- Verify service role key is correct

### Mobile app shows old onboarding
- Clear AsyncStorage: delete app and reinstall
- Check App.tsx imports `OnboardingWizardScreenPhase1`
- Verify no cached onboarding draft exists

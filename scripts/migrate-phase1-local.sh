#!/bin/bash
# ============================================================================
# Phase 1 PostgreSQL Migration Script (Local Development)
# ============================================================================
# Run this against your local PostgreSQL database
# Not for Supabase — this is for local dev only

set -e

echo "=========================================="
echo "Phase 1 Migration: Networking Preferences"
echo "=========================================="
echo ""

# Check if psql is available
if ! command -v psql &> /dev/null; then
    echo "Error: psql is not installed or not in PATH"
    exit 1
fi

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    echo "Error: DATABASE_URL environment variable is not set"
    echo "Set it like: export DATABASE_URL=postgres://user:pass@localhost:5432/spotter"
    exit 1
fi

echo "Connecting to PostgreSQL..."
echo ""

# Run the migration
psql "$DATABASE_URL" << 'EOF'
-- ============================================================================
-- Phase 1 Migration: Networking Preferences + Round Settings (Local PostgreSQL)
-- ============================================================================

BEGIN;

-- 1. Create enums for new preference fields (if not exists)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'networking_intent') THEN
        CREATE TYPE networking_intent AS ENUM (
            'business',
            'social', 
            'competitive',
            'business_social'
        );
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'preferred_group_size') THEN
        CREATE TYPE preferred_group_size AS ENUM (
            '2',
            '3',
            '4',
            'any'
        );
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'cart_preference') THEN
        CREATE TYPE cart_preference AS ENUM (
            'walking',
            'cart',
            'either'
        );
    END IF;
END $$;

-- 2. Create user_networking_preferences table (if not exists)
CREATE TABLE IF NOT EXISTS user_networking_preferences (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Networking intent (Phase 1 requirement)
    networking_intent networking_intent,
    
    -- Introduction preferences
    open_to_intros boolean NOT NULL DEFAULT true,
    open_to_sending_intros boolean NOT NULL DEFAULT true,
    open_to_recurring_rounds boolean NOT NULL DEFAULT false,
    
    -- Round preferences (Phase 1 requirement)
    preferred_group_size preferred_group_size DEFAULT 'any',
    cart_preference cart_preference DEFAULT 'either',
    
    -- Geographic preference (free text for flexibility)
    preferred_golf_area text,
    
    -- Additional notes
    networking_notes text,
    
    -- Timestamps
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    
    -- Constraints
    UNIQUE(user_id),
    CONSTRAINT chk_networking_notes_length CHECK (char_length(networking_notes) <= 500)
);

-- 3. Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_networking_prefs_user 
    ON user_networking_preferences(user_id);

CREATE INDEX IF NOT EXISTS idx_networking_prefs_intent 
    ON user_networking_preferences(networking_intent) 
    WHERE networking_intent IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_networking_prefs_open_intros 
    ON user_networking_preferences(open_to_intros) 
    WHERE open_to_intros = true;

-- 4. Create updated_at trigger function (if not exists)
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5. Add updated_at trigger
DROP TRIGGER IF EXISTS trg_user_networking_preferences_updated_at ON user_networking_preferences;
CREATE TRIGGER trg_user_networking_preferences_updated_at
    BEFORE UPDATE ON user_networking_preferences
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();

-- 6. Update membership_tiers with correct Phase 1 pricing
-- Free tier: $0
-- Select tier: $1,000/year  
-- Summit tier: $10,000 lifetime

UPDATE membership_tiers 
SET 
    price_cents = 0,
    billing_interval = 'annual',
    description = 'Basic access to connect with other golfers. Limited to same-tier connections.',
    short_description = 'Limited access for casual golfers'
WHERE slug = 'free';

UPDATE membership_tiers 
SET 
    price_cents = 100000,
    billing_interval = 'annual',
    description = 'Full access to unlimited connections within your tier. $1,000/year membership.',
    short_description = 'Full access for serious golfers'
WHERE slug = 'select';

UPDATE membership_tiers 
SET 
    price_cents = 1000000,
    billing_interval = 'lifetime',
    description = 'Lifetime unlimited access with priority boosts and exclusive features. $10,000 one-time.',
    short_description = 'Lifetime unlimited access with priority boosts'
WHERE slug = 'summit';

-- 7. Add comments documenting same-tier enforcement strategy
COMMENT ON TABLE users IS 
'User accounts with tier-based visibility. Same-tier visibility enforced via RLS policy users_select_same_tier.';

COMMENT ON TABLE user_networking_preferences IS 
'Networking and round preferences for Phase 1 tiered golf platform. Same-tier visibility enforced via users table RLS.';

-- 8. Verify the migration
DO $$
DECLARE
    free_tier_price integer;
    select_tier_price integer;
    summit_tier_price integer;
BEGIN
    SELECT price_cents INTO free_tier_price FROM membership_tiers WHERE slug = 'free';
    SELECT price_cents INTO select_tier_price FROM membership_tiers WHERE slug = 'select';
    SELECT price_cents INTO summit_tier_price FROM membership_tiers WHERE slug = 'summit';
    
    RAISE NOTICE 'Tier prices after migration:';
    RAISE NOTICE '  Free: % cents ($%)', free_tier_price, free_tier_price/100;
    RAISE NOTICE '  Select: % cents ($%)', select_tier_price, select_tier_price/100;
    RAISE NOTICE '  Summit: % cents ($%)', summit_tier_price, summit_tier_price/100;
END $$;

COMMIT;

echo '';
echo '==========================================';
echo 'Migration complete!';
echo '==========================================';
EOF

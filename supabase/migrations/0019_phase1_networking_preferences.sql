-- ============================================================================
-- Phase 1 Migration: Networking Preferences + Round Settings
-- Adds fields for tiered golf networking platform
-- ============================================================================

-- ============================================
-- UP MIGRATION
-- ============================================

-- 1. Create enums for new preference fields

-- Networking intent enum
CREATE TYPE public.networking_intent AS ENUM (
  'business',
  'social', 
  'competitive',
  'business_social'
);

-- Preferred group size enum
CREATE TYPE public.preferred_group_size AS ENUM (
  '2',
  '3',
  '4',
  'any'
);

-- Cart preference enum
CREATE TYPE public.cart_preference AS ENUM (
  'walking',
  'cart',
  'either'
);

-- 2. Create user_networking_preferences table
-- Separated from user_golf_identities to keep concerns clean
CREATE TABLE IF NOT EXISTS public.user_networking_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  
  -- Networking intent (Phase 1 requirement)
  networking_intent public.networking_intent,
  
  -- Introduction preferences
  open_to_intros boolean NOT NULL DEFAULT true,
  open_to_sending_intros boolean NOT NULL DEFAULT true,
  open_to_recurring_rounds boolean NOT NULL DEFAULT false,
  
  -- Round preferences (Phase 1 requirement)
  preferred_group_size public.preferred_group_size DEFAULT 'any',
  cart_preference public.cart_preference DEFAULT 'either',
  
  -- Geographic preference (free text for flexibility)
  preferred_golf_area text,
  
  -- Additional notes
  networking_notes text,
  
  -- Timestamps
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  
  -- Constraints
  UNIQUE(user_id),
  CHECK (char_length(networking_notes) <= 500)
);

-- 3. Add updated_at trigger
CREATE TRIGGER trg_user_networking_preferences_updated_at
  BEFORE UPDATE ON public.user_networking_preferences
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- 4. Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_networking_prefs_user 
  ON public.user_networking_preferences(user_id);

CREATE INDEX IF NOT EXISTS idx_networking_prefs_intent 
  ON public.user_networking_preferences(networking_intent) 
  WHERE networking_intent IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_networking_prefs_open_intros 
  ON public.user_networking_preferences(open_to_intros) 
  WHERE open_to_intros = true;

-- 5. Enable RLS
ALTER TABLE public.user_networking_preferences ENABLE ROW LEVEL SECURITY;

-- 6. RLS Policies
-- Users can see preferences of same-tier users (enforced via users table policy)
CREATE POLICY networking_prefs_select_visible ON public.user_networking_preferences
  FOR SELECT USING (
    -- User can see their own
    user_id = auth.uid()
    -- Same-tier visibility is enforced by the users table RLS policy
    -- which filters which users are visible to the current user
  );

CREATE POLICY networking_prefs_insert_own ON public.user_networking_preferences
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY networking_prefs_update_own ON public.user_networking_preferences
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY networking_prefs_delete_own ON public.user_networking_preferences
  FOR DELETE USING (auth.uid() = user_id);

-- 7. Add realtime publication
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.user_networking_preferences;
  END IF;
END $$;

-- 8. Update membership_tiers with correct Phase 1 pricing
-- Free tier: $0
-- Select tier: $1,000/year
-- Summit tier: $10,000 lifetime

UPDATE public.membership_tiers 
SET 
  price_cents = 0,
  billing_interval = 'annual',
  description = 'Basic access to connect with other golfers. Limited to same-tier connections.',
  short_description = 'Limited access for casual golfers'
WHERE slug = 'free';

UPDATE public.membership_tiers 
SET 
  price_cents = 100000,
  billing_interval = 'annual',
  description = 'Full access to unlimited connections within your tier. $1,000/year membership.',
  short_description = 'Full access for serious golfers'
WHERE slug = 'select';

UPDATE public.membership_tiers 
SET 
  price_cents = 1000000,
  billing_interval = 'lifetime',
  description = 'Lifetime unlimited access with priority boosts and exclusive features. $10,000 one-time.',
  short_description = 'Lifetime unlimited access with priority boosts'
WHERE slug = 'summit';

-- 9. Add comment documenting same-tier enforcement strategy
COMMENT ON TABLE public.users IS 
'User accounts with tier-based visibility. Same-tier visibility enforced via RLS policy users_select_same_tier.';

COMMENT ON TABLE public.user_networking_preferences IS 
'Networking and round preferences for Phase 1 tiered golf platform. Same-tier visibility enforced via users table RLS.';

-- ============================================
-- DOWN MIGRATION (for reference)
-- ============================================
/*
-- Remove triggers
DROP TRIGGER IF EXISTS trg_user_networking_preferences_updated_at ON public.user_networking_preferences;

-- Remove RLS policies
DROP POLICY IF EXISTS networking_prefs_select_visible ON public.user_networking_preferences;
DROP POLICY IF EXISTS networking_prefs_insert_own ON public.user_networking_preferences;
DROP POLICY IF EXISTS networking_prefs_update_own ON public.user_networking_preferences;
DROP POLICY IF EXISTS networking_prefs_delete_own ON public.user_networking_preferences;

-- Disable RLS
ALTER TABLE public.user_networking_preferences DISABLE ROW LEVEL SECURITY;

-- Remove indexes
DROP INDEX IF EXISTS idx_networking_prefs_user;
DROP INDEX IF EXISTS idx_networking_prefs_intent;
DROP INDEX IF EXISTS idx_networking_prefs_open_intros;

-- Drop table
DROP TABLE IF EXISTS public.user_networking_preferences;

-- Drop enums
DROP TYPE IF EXISTS public.networking_intent;
DROP TYPE IF EXISTS public.preferred_group_size;
DROP TYPE IF EXISTS public.cart_preference;

-- Note: Tier pricing rollback would require knowing previous values
-- This is intentionally left as manual rollback
*/

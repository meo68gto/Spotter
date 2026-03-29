-- EPIC 7: Premium Tier Differentiation - Visibility & Tier Controls
-- ================================================================
-- Adds columns for profile visibility, hunt mode, and search boost.
-- Sets SUMMIT/SELECT tier defaults based on EPIC 7 spec.

-- Profile visibility mode: who can see this user's profile in discovery
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS profile_visibility TEXT DEFAULT 'visible' 
CHECK (profile_visibility IN ('visible', 'select_only', 'summit_only'));

-- Hunt Mode: SELECT members can enable to see FREE-tier members (for coaches/instructors)
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS hunt_mode_enabled BOOLEAN DEFAULT FALSE;

-- Appear in lower-tier discovery: SUMMIT members can hide from SELECT/FREE
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS appear_in_lower_tier_search BOOLEAN DEFAULT TRUE;

-- Search boost: SUMMIT members get priority placement in discovery results
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS search_boosted BOOLEAN DEFAULT FALSE;

-- ================================================================
-- Migration: Set SUMMIT defaults
-- ================================================================
UPDATE public.users 
SET 
  appear_in_lower_tier_search = FALSE,
  search_boosted = TRUE,
  profile_visibility = 'summit_only'
WHERE tier_slug = 'summit';

-- ================================================================
-- Migration: Set SELECT Hunt Mode defaults (opt-in, not opt-out)
-- ================================================================
UPDATE public.users 
SET hunt_mode_enabled = FALSE
WHERE tier_slug = 'select';

-- ================================================================
-- RLS Policy: Summit Privacy Mode
-- Summit users with visibility=summit_only only show to other summit users
-- ================================================================
DROP POLICY IF EXISTS "summit_privacy" ON public.users;

CREATE POLICY "summit_privacy" ON public.users
  FOR SELECT
  USING (
    CASE 
      WHEN (auth.jwt() -> 'tier_slug')::text = '"summit"'::text 
        THEN tier_slug = 'summit' OR profile_visibility != 'summit_only'
      ELSE true
    END
  );

-- ================================================================
-- RLS Policy: Select-only visibility
-- Users with visibility=select_only only show to SELECT and above
-- ================================================================
DROP POLICY IF EXISTS "select_only_visibility" ON public.users;

CREATE POLICY "select_only_visibility" ON public.users
  FOR SELECT
  USING (
    CASE 
      WHEN profile_visibility = 'select_only' 
        THEN tier_slug IN ('select', 'summit') OR tier_slug = 'summit'
      ELSE true
    END
  );

-- ================================================================
-- Indexes for visibility queries
-- ================================================================
CREATE INDEX IF NOT EXISTS idx_users_profile_visibility ON public.users(profile_visibility);
CREATE INDEX IF NOT EXISTS idx_users_hunt_mode ON public.users(hunt_mode_enabled) 
  WHERE hunt_mode_enabled = TRUE;
CREATE INDEX IF NOT EXISTS idx_users_appear_lower_tier ON public.users(appear_in_lower_tier_search) 
  WHERE appear_in_lower_tier_search = FALSE;
CREATE INDEX IF NOT EXISTS idx_users_search_boosted ON public.users(search_boosted) 
  WHERE search_boosted = TRUE;

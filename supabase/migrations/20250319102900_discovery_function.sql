-- Discovery API Migration - Same-Tier Golfer Discovery
-- Creates PostgreSQL function for finding discoverable golfers

-- ============================================
-- UP MIGRATION
-- ============================================

-- 1. Create discovery result type (for function return)
-- Note: We use a function that returns a table structure rather than a custom type
-- to avoid type dependency issues

-- 2. Create the discover_golfers function
-- This function finds golfers in the same tier as the caller
-- with optional filtering by handicap band, location, and networking intent
CREATE OR REPLACE FUNCTION public.discover_golfers(
    p_user_id UUID,
    p_handicap_band TEXT DEFAULT NULL,  -- 'low' (<10), 'mid' (10-20), 'high' (>20), or NULL for any
    p_location TEXT DEFAULT NULL,       -- City/location filter (partial match)
    p_intent TEXT DEFAULT NULL,         -- 'business', 'social', 'competitive', 'business_social', or NULL for any
    p_limit INTEGER DEFAULT 50,
    p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
    user_id UUID,
    display_name TEXT,
    avatar_url TEXT,
    city TEXT,
    tier_id UUID,
    tier_slug TEXT,
    -- Professional identity
    company TEXT,
    title TEXT,
    industry TEXT,
    years_experience INTEGER,
    -- Golf identity
    handicap NUMERIC,
    home_course_id UUID,
    home_course_name TEXT,
    playing_frequency TEXT,
    years_playing INTEGER,
    -- Networking preferences
    networking_intent TEXT,
    open_to_intros BOOLEAN,
    open_to_recurring_rounds BOOLEAN,
    preferred_group_size TEXT,
    cart_preference TEXT,
    preferred_golf_area TEXT,
    -- Reputation
    reputation_score INTEGER,
    -- Compatibility (calculated)
    compatibility_score INTEGER,
    -- Metadata
    profile_completeness INTEGER,
    created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caller_tier_id UUID;
    v_caller_handicap NUMERIC;
    v_caller_city TEXT;
BEGIN
    -- Get caller's tier and profile info for compatibility calculation
    SELECT 
        u.tier_id,
        COALESCE(ugi.handicap, 999),
        u.city
    INTO v_caller_tier_id, v_caller_handicap, v_caller_city
    FROM users u
    LEFT JOIN user_golf_identities ugi ON ugi.user_id = u.id
    WHERE u.id = p_user_id;

    -- If caller has no tier, return empty (shouldn't happen with proper onboarding)
    IF v_caller_tier_id IS NULL THEN
        RETURN;
    END IF;

    RETURN QUERY
    SELECT 
        u.id AS user_id,
        u.display_name,
        u.avatar_url,
        u.city,
        u.tier_id,
        mt.slug AS tier_slug,
        -- Professional identity
        upi.company,
        upi.title,
        upi.industry,
        upi.years_experience,
        -- Golf identity
        ugi.handicap,
        ugi.home_course_id,
        gc.name AS home_course_name,
        ugi.playing_frequency,
        ugi.years_playing,
        -- Networking preferences
        np.networking_intent,
        np.open_to_intros,
        np.open_to_recurring_rounds,
        np.preferred_group_size,
        np.cart_preference,
        np.preferred_golf_area,
        -- Reputation
        COALESCE(ur.overall_score, 0)::INTEGER AS reputation_score,
        -- Compatibility score (0-100)
        -- Based on: handicap similarity (40%), location match (30%), intent match (20%), profile completeness (10%)
        (
            -- Handicap similarity (40 points max)
            CASE 
                WHEN ugi.handicap IS NULL OR v_caller_handicap IS NULL OR v_caller_handicap = 999 THEN 20
                WHEN ABS(ugi.handicap - v_caller_handicap) <= 3 THEN 40
                WHEN ABS(ugi.handicap - v_caller_handicap) <= 6 THEN 30
                WHEN ABS(ugi.handicap - v_caller_handicap) <= 10 THEN 20
                ELSE 10
            END +
            -- Location match (30 points max)
            CASE 
                WHEN u.city IS NULL OR v_caller_city IS NULL THEN 10
                WHEN LOWER(u.city) = LOWER(v_caller_city) THEN 30
                WHEN u.city ILIKE '%' || v_caller_city || '%' OR v_caller_city ILIKE '%' || u.city || '%' THEN 20
                ELSE 10
            END +
            -- Intent match (20 points max)
            CASE 
                WHEN p_intent IS NULL OR np.networking_intent IS NULL THEN 10
                WHEN np.networking_intent = p_intent THEN 20
                WHEN np.networking_intent = 'business_social' AND p_intent IN ('business', 'social') THEN 15
                ELSE 5
            END +
            -- Profile completeness (10 points max)
            LEAST(u.profile_completeness / 10, 10)
        )::INTEGER AS compatibility_score,
        -- Metadata
        u.profile_completeness,
        u.created_at
    FROM users u
    INNER JOIN membership_tiers mt ON mt.id = u.tier_id
    LEFT JOIN user_professional_identities upi ON upi.user_id = u.id
    LEFT JOIN user_golf_identities ugi ON ugi.user_id = u.id
    LEFT JOIN golf_courses gc ON gc.id = ugi.home_course_id
    LEFT JOIN user_reputation ur ON ur.user_id = u.id
    LEFT JOIN user_networking_preferences np ON np.user_id = u.id
    WHERE 
        -- Same tier enforcement (core requirement)
        u.tier_id = v_caller_tier_id
        -- Exclude self
        AND u.id != p_user_id
        -- Only active users
        AND u.tier_status = 'active'
        -- Only users open to connections
        AND u.allow_connections = true
        -- Optional handicap band filter
        AND (
            p_handicap_band IS NULL 
            OR ugi.handicap IS NULL
            OR (p_handicap_band = 'low' AND ugi.handicap < 10)
            OR (p_handicap_band = 'mid' AND ugi.handicap >= 10 AND ugi.handicap <= 20)
            OR (p_handicap_band = 'high' AND ugi.handicap > 20)
        )
        -- Optional location filter (partial match on city)
        AND (
            p_location IS NULL 
            OR u.city IS NULL
            OR u.city ILIKE '%' || p_location || '%'
        )
        -- Optional intent filter
        AND (
            p_intent IS NULL 
            OR np.networking_intent IS NULL
            OR np.networking_intent = p_intent
            OR np.networking_intent = 'business_social'  -- Business+Social matches both
        )
    ORDER BY 
        -- Sort by compatibility score (highest first)
        compatibility_score DESC,
        -- Then by reputation
        COALESCE(ur.overall_score, 0) DESC,
        -- Then by profile completeness
        u.profile_completeness DESC,
        -- Finally by join date (newest first)
        u.created_at DESC
    LIMIT p_limit
    OFFSET p_offset;
END;
$$;

-- 3. Add comment for documentation
COMMENT ON FUNCTION public.discover_golfers IS 
'Discovers golfers in the same tier as the caller.
Parameters:
  - p_user_id: UUID of the calling user (required)
  - p_handicap_band: Filter by handicap range (low <10, mid 10-20, high >20)
  - p_location: Filter by city/location (partial match)
  - p_intent: Filter by networking intent (business, social, competitive, business_social)
  - p_limit: Maximum results to return (default 50)
  - p_offset: Offset for pagination (default 0)
Returns: Table of discoverable golfers with profile, golf identity, and networking preferences.
Same-tier visibility is enforced at the database level.';

-- 4. Grant execute permission to authenticated users
-- The function uses SECURITY DEFINER and checks the caller's tier internally
GRANT EXECUTE ON FUNCTION public.discover_golfers TO authenticated;
GRANT EXECUTE ON FUNCTION public.discover_golfers TO anon;

-- 5. Create index to optimize discovery queries (if not exists)
-- These indexes support the filtering and sorting in discover_golfers
CREATE INDEX IF NOT EXISTS idx_users_tier_status_allow_connections 
    ON public.users(tier_id, tier_status, allow_connections) 
    WHERE allow_connections = true;

CREATE INDEX IF NOT EXISTS idx_golf_identities_handicap 
    ON public.user_golf_identities(user_id, handicap);

CREATE INDEX IF NOT EXISTS idx_networking_prefs_intent 
    ON public.user_networking_preferences(user_id, networking_intent);

-- ============================================
-- DOWN MIGRATION (rollback)
-- ============================================
-- Note: Uncomment to run rollback
/*
-- Drop function
DROP FUNCTION IF EXISTS public.discover_golfers(UUID, TEXT, TEXT, TEXT, INTEGER, INTEGER);

-- Drop indexes
DROP INDEX IF EXISTS idx_users_tier_status_allow_connections;
DROP INDEX IF EXISTS idx_golf_identities_handicap;
DROP INDEX IF EXISTS idx_networking_prefs_intent;
*/

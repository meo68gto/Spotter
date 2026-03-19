-- ============================================================================
-- Performance Optimization Migration
-- Adds indexes and query optimizations for production performance
-- Target metrics:
--   - Discovery query: < 100ms
--   - Matching calculation: < 50ms
--   - Round creation: < 200ms
--   - Profile load: < 100ms
-- ============================================================================

-- ============================================
-- UP MIGRATION
-- ============================================

-- ============================================================================
-- 1. COMPOSITE INDEXES FOR DISCOVERY QUERIES
-- ============================================================================

-- Primary discovery filter: tier + status + connections (used by discover_golfers)
-- This replaces idx_users_tier_status_allow_connections with a more efficient version
DROP INDEX IF EXISTS idx_users_tier_status_allow_connections;
CREATE INDEX IF NOT EXISTS idx_users_discovery_filter 
    ON public.users(tier_id, tier_status, allow_connections, profile_completeness DESC, created_at DESC)
    WHERE allow_connections = true AND tier_status = 'active';

-- Covering index for discovery query - includes all commonly fetched columns
CREATE INDEX IF NOT EXISTS idx_users_discovery_covering 
    ON public.users(tier_id, id, display_name, avatar_url, city, profile_completeness, created_at)
    WHERE allow_connections = true AND tier_status = 'active';

-- ============================================================================
-- 2. INDEXES FOR MATCHING ENGINE
-- ============================================================================

-- Optimized index for get_top_matches - filters by tier and excludes deleted
CREATE INDEX IF NOT EXISTS idx_users_matching_candidates 
    ON public.users(tier_id, id, display_name, avatar_url, city)
    WHERE deleted_at IS NULL;

-- Covering index for user golf identities in matching
CREATE INDEX IF NOT EXISTS idx_golf_identities_matching 
    ON public.user_golf_identities(user_id, handicap, home_course_id);

-- Covering index for networking preferences in matching  
CREATE INDEX IF NOT EXISTS idx_networking_prefs_matching 
    ON public.user_networking_preferences(user_id, networking_intent, preferred_group_size, open_to_intros);

-- Covering index for professional identities
CREATE INDEX IF NOT EXISTS idx_professional_identities_covering 
    ON public.user_professional_identities(user_id, company, title, industry);

-- ============================================================================
-- 3. INDEXES FOR ROUNDS OPERATIONS
-- ============================================================================

-- Optimized index for rounds list queries
CREATE INDEX IF NOT EXISTS idx_rounds_list_query 
    ON public.rounds(tier_id, status, scheduled_at DESC)
    INCLUDE (creator_id, course_id, max_players, cart_preference);

-- Index for user's rounds (creator + status)
CREATE INDEX IF NOT EXISTS idx_rounds_creator_status_scheduled 
    ON public.rounds(creator_id, status, scheduled_at DESC);

-- Index for participant lookups with covering columns
CREATE INDEX IF NOT EXISTS idx_participants_v2_covering 
    ON public.round_participants_v2(round_id, user_id, is_creator, joined_at);

-- Index for invitations with status filtering
CREATE INDEX IF NOT EXISTS idx_invitations_status_covering 
    ON public.round_invitations(invitee_id, status, round_id, invited_at)
    WHERE status = 'pending';

-- ============================================================================
-- 4. INDEXES FOR REPUTATION AND CONNECTIONS
-- ============================================================================

-- Covering index for reputation lookups
CREATE INDEX IF NOT EXISTS idx_reputation_covering 
    ON public.user_reputation(user_id, overall_score);

-- Optimized connection queries
CREATE INDEX IF NOT EXISTS idx_connections_mutual_lookup 
    ON public.user_connections(user_id, connected_user_id, status)
    WHERE status = 'accepted';

-- ============================================================================
-- 5. GIST INDEXES FOR GEOGRAPHIC QUERIES
-- ============================================================================

-- Ensure GIST index exists for course location queries
CREATE INDEX IF NOT EXISTS idx_courses_location_gist 
    ON public.golf_courses USING gist(location);

-- ============================================================================
-- 6. QUERY OPTIMIZATION: discover_golfers() function
-- ============================================================================

CREATE OR REPLACE FUNCTION public.discover_golfers(
    p_user_id UUID,
    p_handicap_band TEXT DEFAULT NULL,
    p_location TEXT DEFAULT NULL,
    p_intent TEXT DEFAULT NULL,
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
    company TEXT,
    title TEXT,
    industry TEXT,
    years_experience INTEGER,
    handicap NUMERIC,
    home_course_id UUID,
    home_course_name TEXT,
    playing_frequency TEXT,
    years_playing INTEGER,
    networking_intent TEXT,
    open_to_intros BOOLEAN,
    open_to_recurring_rounds BOOLEAN,
    preferred_group_size TEXT,
    cart_preference TEXT,
    preferred_golf_area TEXT,
    reputation_score INTEGER,
    compatibility_score INTEGER,
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
    v_query_start TIMESTAMPTZ;
BEGIN
    v_query_start := clock_timestamp();

    -- Get caller's tier and profile info for compatibility calculation
    SELECT 
        u.tier_id,
        COALESCE(ugi.handicap, 999),
        u.city
    INTO v_caller_tier_id, v_caller_handicap, v_caller_city
    FROM users u
    LEFT JOIN user_golf_identities ugi ON ugi.user_id = u.id
    WHERE u.id = p_user_id;

    -- If caller has no tier, return empty
    IF v_caller_tier_id IS NULL THEN
        RETURN;
    END IF;

    RETURN QUERY
    WITH filtered_users AS (
        -- First, filter users efficiently using the index
        SELECT 
            u.id,
            u.display_name,
            u.avatar_url,
            u.city,
            u.tier_id,
            u.profile_completeness,
            u.created_at
        FROM users u
        WHERE 
            u.tier_id = v_caller_tier_id
            AND u.id != p_user_id
            AND u.tier_status = 'active'
            AND u.allow_connections = true
    ),
    enriched_profiles AS (
        -- Join with related tables
        SELECT 
            fu.id,
            fu.display_name,
            fu.avatar_url,
            fu.city,
            fu.tier_id,
            mt.slug AS tier_slug,
            fu.profile_completeness,
            fu.created_at,
            -- Professional identity
            upi.company,
            upi.title,
            upi.industry,
            upi.years_experience,
            -- Golf identity
            ugi.handicap,
            ugi.home_course_id,
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
            -- Home course name
            gc.name AS home_course_name
        FROM filtered_users fu
        INNER JOIN membership_tiers mt ON mt.id = fu.tier_id
        LEFT JOIN user_professional_identities upi ON upi.user_id = fu.id
        LEFT JOIN user_golf_identities ugi ON ugi.user_id = fu.id
        LEFT JOIN golf_courses gc ON gc.id = ugi.home_course_id
        LEFT JOIN user_reputation ur ON ur.user_id = fu.id
        LEFT JOIN user_networking_preferences np ON np.user_id = fu.id
        WHERE 
            -- Optional handicap band filter
            (
                p_handicap_band IS NULL 
                OR ugi.handicap IS NULL
                OR (p_handicap_band = 'low' AND ugi.handicap < 10)
                OR (p_handicap_band = 'mid' AND ugi.handicap >= 10 AND ugi.handicap <= 20)
                OR (p_handicap_band = 'high' AND ugi.handicap > 20)
            )
            -- Optional location filter
            AND (
                p_location IS NULL 
                OR fu.city IS NULL
                OR fu.city ILIKE '%' || p_location || '%'
            )
            -- Optional intent filter
            AND (
                p_intent IS NULL 
                OR np.networking_intent IS NULL
                OR np.networking_intent = p_intent
                OR np.networking_intent = 'business_social'
            )
    )
    SELECT 
        ep.id AS user_id,
        ep.display_name,
        ep.avatar_url,
        ep.city,
        ep.tier_id,
        ep.tier_slug,
        ep.company,
        ep.title,
        ep.industry,
        ep.years_experience,
        ep.handicap,
        ep.home_course_id,
        ep.home_course_name,
        ep.playing_frequency,
        ep.years_playing,
        ep.networking_intent::TEXT,
        ep.open_to_intros,
        ep.open_to_recurring_rounds,
        ep.preferred_group_size::TEXT,
        ep.cart_preference::TEXT,
        ep.preferred_golf_area,
        ep.reputation_score,
        -- Compatibility score calculation
        (
            CASE 
                WHEN ep.handicap IS NULL OR v_caller_handicap IS NULL OR v_caller_handicap = 999 THEN 20
                WHEN ABS(ep.handicap - v_caller_handicap) <= 3 THEN 40
                WHEN ABS(ep.handicap - v_caller_handicap) <= 6 THEN 30
                WHEN ABS(ep.handicap - v_caller_handicap) <= 10 THEN 20
                ELSE 10
            END +
            CASE 
                WHEN ep.city IS NULL OR v_caller_city IS NULL THEN 10
                WHEN LOWER(ep.city) = LOWER(v_caller_city) THEN 30
                WHEN ep.city ILIKE '%' || v_caller_city || '%' OR v_caller_city ILIKE '%' || ep.city || '%' THEN 20
                ELSE 10
            END +
            CASE 
                WHEN p_intent IS NULL OR ep.networking_intent IS NULL THEN 10
                WHEN ep.networking_intent = p_intent THEN 20
                WHEN ep.networking_intent = 'business_social' AND p_intent IN ('business', 'social') THEN 15
                ELSE 5
            END +
            LEAST(ep.profile_completeness / 10, 10)
        )::INTEGER AS compatibility_score,
        ep.profile_completeness,
        ep.created_at
    FROM enriched_profiles ep
    ORDER BY 
        compatibility_score DESC,
        ep.reputation_score DESC,
        ep.profile_completeness DESC,
        ep.created_at DESC
    LIMIT p_limit
    OFFSET p_offset;
    
    -- Log slow queries (over 100ms)
    IF clock_timestamp() - v_query_start > interval '100ms' THEN
        RAISE WARNING 'Slow discover_golfers query for user %: %ms', 
            p_user_id, 
            EXTRACT(MILLISECOND FROM clock_timestamp() - v_query_start);
    END IF;
END;
$$;

-- ============================================================================
-- 7. QUERY OPTIMIZATION: get_top_matches() function
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_top_matches(
  p_user_id uuid,
  p_limit integer DEFAULT 10,
  p_min_score numeric DEFAULT 0
)
RETURNS TABLE (
  target_user_id uuid,
  target_display_name text,
  target_avatar_url text,
  target_city text,
  match_score numeric,
  handicap_score numeric,
  networking_intent_score numeric,
  location_score numeric,
  group_size_score numeric,
  distance_km numeric,
  target_handicap numeric,
  target_intent public.networking_intent,
  target_group_size public.preferred_group_size,
  target_professional_company text,
  target_professional_title text,
  target_professional_industry text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_tier_id uuid;
  v_query_start TIMESTAMPTZ;
BEGIN
  v_query_start := clock_timestamp();

  -- Get current user's tier
  SELECT tier_id INTO user_tier_id
  FROM public.users
  WHERE id = p_user_id;

  -- Early return if no tier
  IF user_tier_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH current_user_data AS (
    -- Get current user data once
    SELECT 
      COALESCE(ugi.handicap, 0) AS my_handicap,
      unp.networking_intent AS my_intent,
      unp.preferred_group_size AS my_group_size,
      u.city AS my_city,
      c.location AS my_location
    FROM public.users u
    LEFT JOIN public.user_golf_identities ugi ON ugi.user_id = u.id
    LEFT JOIN public.user_networking_preferences unp ON unp.user_id = u.id
    LEFT JOIN public.golf_courses c ON c.id = ugi.home_course_id
    WHERE u.id = p_user_id
  ),
  candidate_matches AS (
    -- Get candidates with pre-fetched data
    SELECT
      u.id AS target_id,
      u.display_name,
      u.avatar_url,
      u.city,
      ugi.handicap AS target_handicap,
      unp.networking_intent AS target_intent,
      unp.preferred_group_size AS target_group_size,
      upi.company AS prof_company,
      upi.title AS prof_title,
      upi.industry AS prof_industry,
      gc.location AS target_location
    FROM public.users u
    LEFT JOIN public.user_golf_identities ugi ON ugi.user_id = u.id
    LEFT JOIN public.user_networking_preferences unp ON unp.user_id = u.id
    LEFT JOIN public.user_professional_identities upi ON upi.user_id = u.id
    LEFT JOIN public.golf_courses gc ON gc.id = ugi.home_course_id
    WHERE u.id != p_user_id
      AND u.tier_id = user_tier_id
      AND u.deleted_at IS NULL
      AND COALESCE(unp.open_to_intros, true) = true
  ),
  scored_matches AS (
    SELECT
      cm.target_id,
      cm.display_name,
      cm.avatar_url,
      cm.city,
      cm.target_handicap,
      cm.target_intent,
      cm.target_group_size,
      cm.prof_company,
      cm.prof_title,
      cm.prof_industry,
      -- Calculate distance only if both locations exist
      CASE 
        WHEN (SELECT my_location FROM current_user_data) IS NOT NULL 
             AND cm.target_location IS NOT NULL 
        THEN ST_Distance(
          (SELECT my_location FROM current_user_data), 
          cm.target_location, 
          false
        ) / 1000
        ELSE NULL 
      END AS dist,
      -- Pre-calculate scores
      public.calculate_handicap_similarity(
        (SELECT my_handicap FROM current_user_data), 
        cm.target_handicap
      ) AS h_score,
      public.calculate_intent_compatibility(
        (SELECT my_intent FROM current_user_data), 
        cm.target_intent
      ) AS i_score,
      public.calculate_group_size_compatibility(
        (SELECT my_group_size FROM current_user_data), 
        cm.target_group_size
      ) AS g_score
    FROM candidate_matches cm
  )
  SELECT
    sm.target_id,
    sm.display_name,
    sm.avatar_url,
    sm.city,
    -- Calculate final weighted score
    (
      sm.h_score * 0.30 +
      sm.i_score * 0.25 +
      public.calculate_location_score(sm.dist) * 0.20 +
      50 * 0.15 +  -- Availability neutral
      sm.g_score * 0.10
    ) AS score,
    sm.h_score,
    sm.i_score,
    public.calculate_location_score(sm.dist) AS l_score,
    sm.g_score,
    sm.dist,
    sm.target_handicap,
    sm.target_intent,
    sm.target_group_size,
    sm.prof_company,
    sm.prof_title,
    sm.prof_industry
  FROM scored_matches sm
  WHERE (
    sm.h_score * 0.30 +
    sm.i_score * 0.25 +
    public.calculate_location_score(sm.dist) * 0.20 +
    50 * 0.15 +
    sm.g_score * 0.10
  ) >= p_min_score
  ORDER BY score DESC
  LIMIT p_limit;
  
  -- Log slow queries (over 50ms)
  IF clock_timestamp() - v_query_start > interval '50ms' THEN
    RAISE WARNING 'Slow get_top_matches query for user %: %ms', 
        p_user_id, 
        EXTRACT(MILLISECOND FROM clock_timestamp() - v_query_start);
  END IF;
END;
$$;

-- ============================================================================
-- 8. CREATE QUERY PERFORMANCE LOGGING TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.query_performance_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    function_name text NOT NULL,
    user_id uuid REFERENCES public.users(id),
    execution_time_ms numeric NOT NULL,
    parameters jsonb,
    row_count integer,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_query_perf_function_time 
    ON public.query_performance_logs(function_name, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_query_perf_slow_queries 
    ON public.query_performance_logs(execution_time_ms DESC, created_at DESC)
    WHERE execution_time_ms > 100;

-- ============================================================================
-- 9. ANALYZE TABLES FOR QUERY PLANNER
-- ============================================================================

ANALYZE public.users;
ANALYZE public.user_golf_identities;
ANALYZE public.user_networking_preferences;
ANALYZE public.user_professional_identities;
ANALYZE public.user_reputation;
ANALYZE public.rounds;
ANALYZE public.round_participants_v2;
ANALYZE public.round_invitations;
ANALYZE public.golf_courses;

-- ============================================================================
-- 10. ADD COMMENTS
-- ============================================================================

COMMENT ON INDEX idx_users_discovery_filter IS 'Optimized index for discover_golfers() function';
COMMENT ON INDEX idx_users_matching_candidates IS 'Optimized index for get_top_matches() function';
COMMENT ON INDEX idx_rounds_list_query IS 'Covering index for rounds list queries';
COMMENT ON TABLE public.query_performance_logs IS 'Logs slow query execution times for performance monitoring';

-- ============================================
-- DOWN MIGRATION
-- ============================================
/*
-- Drop performance logging table
DROP TABLE IF EXISTS public.query_performance_logs;

-- Drop new indexes
DROP INDEX IF EXISTS idx_users_discovery_filter;
DROP INDEX IF EXISTS idx_users_discovery_covering;
DROP INDEX IF EXISTS idx_users_matching_candidates;
DROP INDEX IF EXISTS idx_golf_identities_matching;
DROP INDEX IF EXISTS idx_networking_prefs_matching;
DROP INDEX IF EXISTS idx_professional_identities_covering;
DROP INDEX IF EXISTS idx_rounds_list_query;
DROP INDEX IF EXISTS idx_rounds_creator_status_scheduled;
DROP INDEX IF EXISTS idx_participants_v2_covering;
DROP INDEX IF EXISTS idx_invitations_status_covering;
DROP INDEX IF EXISTS idx_reputation_covering;
DROP INDEX IF EXISTS idx_connections_mutual_lookup;

-- Recreate original index
CREATE INDEX IF NOT EXISTS idx_users_tier_status_allow_connections 
    ON public.users(tier_id, tier_status, allow_connections) 
    WHERE allow_connections = true;

-- Restore original function versions (from 0021_discovery_function.sql and 0020_matching_engine.sql)
-- Note: Original function definitions should be restored from their respective migrations
*/

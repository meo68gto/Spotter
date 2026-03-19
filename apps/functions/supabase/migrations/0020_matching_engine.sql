-- ============================================================================
-- Phase 2: Golf Matching Engine
-- PostgreSQL functions for calculating match scores and finding compatible golfers
-- ============================================================================

-- ============================================
-- UP MIGRATION
-- ============================================

-- 1. Helper function: Calculate handicap similarity score (0-100)
CREATE OR REPLACE FUNCTION public.calculate_handicap_similarity(
  handicap1 numeric,
  handicap2 numeric
)
RETURNS numeric
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  diff numeric;
BEGIN
  -- If either handicap is null, return neutral score
  IF handicap1 IS NULL OR handicap2 IS NULL THEN
    RETURN 50;
  END IF;

  diff := ABS(handicap1 - handicap2);

  -- Within 5 strokes = 100%
  IF diff <= 5 THEN
    RETURN 100;
  -- Within 10 strokes = 75%
  ELSIF diff <= 10 THEN
    RETURN 75;
  -- Within 15 strokes = 50%
  ELSIF diff <= 15 THEN
    RETURN 50;
  -- Beyond 15 strokes = 25%
  ELSE
    RETURN 25;
  END IF;
END;
$$;

-- 2. Helper function: Calculate networking intent compatibility (0-100)
CREATE OR REPLACE FUNCTION public.calculate_intent_compatibility(
  intent1 public.networking_intent,
  intent2 public.networking_intent
)
RETURNS numeric
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Same intent = 100%
  IF intent1 = intent2 THEN
    RETURN 100;
  END IF;

  -- business + business_social = 75%
  IF (intent1 = 'business' AND intent2 = 'business_social') OR
     (intent1 = 'business_social' AND intent2 = 'business') THEN
    RETURN 75;
  END IF;

  -- social + business_social = 75%
  IF (intent1 = 'social' AND intent2 = 'business_social') OR
     (intent1 = 'business_social' AND intent2 = 'social') THEN
    RETURN 75;
  END IF;

  -- competitive + anything else = 50%
  IF intent1 = 'competitive' OR intent2 = 'competitive' THEN
    RETURN 50;
  END IF;

  -- business + social = 25%
  IF (intent1 = 'business' AND intent2 = 'social') OR
     (intent1 = 'social' AND intent2 = 'business') THEN
    RETURN 25;
  END IF;

  -- Default fallback
  RETURN 50;
END;
$$;

-- 3. Helper function: Calculate location proximity score (0-100)
CREATE OR REPLACE FUNCTION public.calculate_location_score(
  distance_km numeric
)
RETURNS numeric
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Unknown distance = neutral score
  IF distance_km IS NULL THEN
    RETURN 50;
  END IF;

  -- Same area (< 10km) = 100%
  IF distance_km <= 10 THEN
    RETURN 100;
  -- Nearby (10-50km) = 75%
  ELSIF distance_km <= 50 THEN
    RETURN 75;
  -- Different area (> 50km) = 25%
  ELSE
    RETURN 25;
  END IF;
END;
$$;

-- 4. Helper function: Calculate group size compatibility (0-100)
CREATE OR REPLACE FUNCTION public.calculate_group_size_compatibility(
  size1 public.preferred_group_size,
  size2 public.preferred_group_size
)
RETURNS numeric
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Handle NULL values
  IF size1 IS NULL OR size2 IS NULL THEN
    RETURN 50;
  END IF;

  -- "any" is compatible with everything at 100%
  IF size1 = 'any' OR size2 = 'any' THEN
    RETURN 100;
  END IF;

  -- Same size = 100%
  IF size1 = size2 THEN
    RETURN 100;
  END IF;

  -- 2 + 3 or 3 + 2 = 50%
  IF (size1 = '2' AND size2 = '3') OR (size1 = '3' AND size2 = '2') THEN
    RETURN 50;
  END IF;

  -- 3 + 4 or 4 + 3 = 50%
  IF (size1 = '3' AND size2 = '4') OR (size1 = '4' AND size2 = '3') THEN
    RETURN 50;
  END IF;

  -- 2 + 4 or 4 + 2 = 25%
  IF (size1 = '2' AND size2 = '4') OR (size1 = '4' AND size2 = '2') THEN
    RETURN 25;
  END IF;

  -- Default fallback
  RETURN 50;
END;
$$;

-- 5. Helper function: Calculate distance between two users
CREATE OR REPLACE FUNCTION public.calculate_user_distance(
  user1_id uuid,
  user2_id uuid
)
RETURNS numeric
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user1_location geography;
  user2_location geography;
  distance_km numeric;
BEGIN
  -- Get locations from user golf identities (home course location)
  SELECT c.location INTO user1_location
  FROM public.user_golf_identities ugi
  JOIN public.golf_courses c ON c.id = ugi.home_course_id
  WHERE ugi.user_id = user1_id;

  SELECT c.location INTO user2_location
  FROM public.user_golf_identities ugi
  JOIN public.golf_courses c ON c.id = ugi.home_course_id
  WHERE ugi.user_id = user2_id;

  -- If either location is missing, return NULL
  IF user1_location IS NULL OR user2_location IS NULL THEN
    RETURN NULL;
  END IF;

  -- Calculate distance in kilometers
  distance_km := ST_Distance(user1_location, user2_location, false) / 1000;

  RETURN distance_km;
END;
$$;

-- 6. Main function: Calculate match score between two users
CREATE OR REPLACE FUNCTION public.calculate_match_score(
  user_id_1 uuid,
  user_id_2 uuid
)
RETURNS TABLE (
  match_score numeric,
  handicap_score numeric,
  networking_intent_score numeric,
  location_score numeric,
  group_size_score numeric,
  distance_km numeric,
  user1_handicap numeric,
  user2_handicap numeric,
  user1_intent public.networking_intent,
  user2_intent public.networking_intent,
  user1_group_size public.preferred_group_size,
  user2_group_size public.preferred_group_size
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  u1_handicap numeric;
  u2_handicap numeric;
  u1_intent public.networking_intent;
  u2_intent public.networking_intent;
  u1_group_size public.preferred_group_size;
  u2_group_size public.preferred_group_size;
  u1_city text;
  u2_city text;
  dist_km numeric;
  h_score numeric;
  i_score numeric;
  l_score numeric;
  g_score numeric;
  final_score numeric;
BEGIN
  -- Get user 1 data
  SELECT
    ugi.handicap,
    unp.networking_intent,
    unp.preferred_group_size,
    u.city
  INTO u1_handicap, u1_intent, u1_group_size, u1_city
  FROM public.users u
  LEFT JOIN public.user_golf_identities ugi ON ugi.user_id = u.id
  LEFT JOIN public.user_networking_preferences unp ON unp.user_id = u.id
  WHERE u.id = user_id_1;

  -- Get user 2 data
  SELECT
    ugi.handicap,
    unp.networking_intent,
    unp.preferred_group_size,
    u.city
  INTO u2_handicap, u2_intent, u2_group_size, u2_city
  FROM public.users u
  LEFT JOIN public.user_golf_identities ugi ON ugi.user_id = u.id
  LEFT JOIN public.user_networking_preferences unp ON unp.user_id = u.id
  WHERE u.id = user_id_2;

  -- Calculate distance
  dist_km := public.calculate_user_distance(user_id_1, user_id_2);

  -- Calculate individual scores
  h_score := public.calculate_handicap_similarity(u1_handicap, u2_handicap);
  i_score := public.calculate_intent_compatibility(u1_intent, u2_intent);
  l_score := public.calculate_location_score(dist_km);
  g_score := public.calculate_group_size_compatibility(u1_group_size, u2_group_size);

  -- Calculate weighted final score
  -- Handicap: 30%, Intent: 25%, Location: 20%, Availability: 15% (neutral), Group Size: 10%
  final_score := (h_score * 0.30) + (i_score * 0.25) + (l_score * 0.20) + (50 * 0.15) + (g_score * 0.10);

  RETURN QUERY SELECT
    final_score,
    h_score,
    i_score,
    l_score,
    g_score,
    dist_km,
    u1_handicap,
    u2_handicap,
    u1_intent,
    u2_intent,
    u1_group_size,
    u2_group_size;
END;
$$;

-- 7. Main function: Get top matches for a user
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
BEGIN
  -- Get current user's tier
  SELECT tier_id INTO user_tier_id
  FROM public.users
  WHERE id = p_user_id;

  -- Return top matches from same tier
  RETURN QUERY
  WITH match_scores AS (
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
      -- Calculate distance
      public.calculate_user_distance(p_user_id, u.id) AS dist,
      -- Get current user data for calculations
      (SELECT handicap FROM public.user_golf_identities WHERE user_id = p_user_id) AS my_handicap,
      (SELECT networking_intent FROM public.user_networking_preferences WHERE user_id = p_user_id) AS my_intent,
      (SELECT preferred_group_size FROM public.user_networking_preferences WHERE user_id = p_user_id) AS my_group_size
    FROM public.users u
    LEFT JOIN public.user_golf_identities ugi ON ugi.user_id = u.id
    LEFT JOIN public.user_networking_preferences unp ON unp.user_id = u.id
    LEFT JOIN public.user_professional_identities upi ON upi.user_id = u.id
    WHERE u.id != p_user_id
      AND u.tier_id = user_tier_id  -- Same tier only
      AND u.deleted_at IS NULL
      -- Exclude users who have blocked connection requests
      AND COALESCE(unp.open_to_intros, true) = true
  ),
  scored_matches AS (
    SELECT
      ms.target_id,
      ms.display_name,
      ms.avatar_url,
      ms.city,
      ms.target_handicap,
      ms.target_intent,
      ms.target_group_size,
      ms.prof_company,
      ms.prof_title,
      ms.prof_industry,
      ms.dist,
      -- Calculate match score
      (
        public.calculate_handicap_similarity(ms.my_handicap, ms.target_handicap) * 0.30 +
        public.calculate_intent_compatibility(ms.my_intent, ms.target_intent) * 0.25 +
        public.calculate_location_score(ms.dist) * 0.20 +
        50 * 0.15 +  -- Availability neutral
        public.calculate_group_size_compatibility(ms.my_group_size, ms.target_group_size) * 0.10
      ) AS score,
      public.calculate_handicap_similarity(ms.my_handicap, ms.target_handicap) AS h_score,
      public.calculate_intent_compatibility(ms.my_intent, ms.target_intent) AS i_score,
      public.calculate_location_score(ms.dist) AS l_score,
      public.calculate_group_size_compatibility(ms.my_group_size, ms.target_group_size) AS g_score
    FROM match_scores ms
  )
  SELECT
    sm.target_id,
    sm.display_name,
    sm.avatar_url,
    sm.city,
    sm.score,
    sm.h_score,
    sm.i_score,
    sm.l_score,
    sm.g_score,
    sm.dist,
    sm.target_handicap,
    sm.target_intent,
    sm.target_group_size,
    sm.prof_company,
    sm.prof_title,
    sm.prof_industry
  FROM scored_matches sm
  WHERE sm.score >= p_min_score
  ORDER BY sm.score DESC
  LIMIT p_limit;
END;
$$;

-- 8. Add deleted_at column for soft deletes
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

-- 8b. Add city column for location-based matching
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS city text;

-- 9. Create index for faster match queries
CREATE INDEX IF NOT EXISTS idx_users_tier_active ON public.users(tier_id) WHERE deleted_at IS NULL;

-- 9. Create view for match candidates (same tier, open to intros)
CREATE OR REPLACE VIEW public.match_candidates AS
SELECT
  u.id AS user_id,
  u.display_name,
  u.avatar_url,
  u.city,
  u.tier_id,
  ugi.handicap,
  unp.networking_intent,
  unp.preferred_group_size,
  unp.open_to_intros,
  upi.company,
  upi.title,
  upi.industry
FROM public.users u
LEFT JOIN public.user_golf_identities ugi ON ugi.user_id = u.id
LEFT JOIN public.user_networking_preferences unp ON unp.user_id = u.id
LEFT JOIN public.user_professional_identities upi ON upi.user_id = u.id
WHERE u.deleted_at IS NULL
  AND COALESCE(unp.open_to_intros, true) = true;

-- 10. Add comment documentation
COMMENT ON FUNCTION public.calculate_match_score IS 'Calculates compatibility score (0-100) between two users based on handicap, networking intent, location, and group size preferences';
COMMENT ON FUNCTION public.get_top_matches IS 'Returns top N compatible golf partners for a user, filtered by same tier membership';
COMMENT ON FUNCTION public.calculate_handicap_similarity IS 'Returns score 0-100 based on handicap difference';
COMMENT ON FUNCTION public.calculate_intent_compatibility IS 'Returns score 0-100 based on networking intent alignment';
COMMENT ON FUNCTION public.calculate_location_score IS 'Returns score 0-100 based on distance between users';
COMMENT ON FUNCTION public.calculate_group_size_compatibility IS 'Returns score 0-100 based on group size preference alignment';

-- ============================================
-- DOWN MIGRATION
-- ============================================
/*
-- Drop view
DROP VIEW IF EXISTS public.match_candidates;

-- Drop index
DROP INDEX IF EXISTS idx_users_tier_active;

-- Drop functions
DROP FUNCTION IF EXISTS public.get_top_matches(uuid, integer, numeric);
DROP FUNCTION IF EXISTS public.calculate_match_score(uuid, uuid);
DROP FUNCTION IF EXISTS public.calculate_user_distance(uuid, uuid);
DROP FUNCTION IF EXISTS public.calculate_group_size_compatibility(preferred_group_size, preferred_group_size);
DROP FUNCTION IF EXISTS public.calculate_location_score(numeric);
DROP FUNCTION IF EXISTS public.calculate_intent_compatibility(networking_intent, networking_intent);
DROP FUNCTION IF EXISTS public.calculate_handicap_similarity(numeric, numeric);
*/

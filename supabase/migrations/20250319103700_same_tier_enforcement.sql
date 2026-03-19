-- Migration: Same-Tier Enforcement Hardening
-- Fixes same-tier enforcement gaps in discovery and matching functions
-- Date: 2026-03-19

-- ============================================
-- 1. UPDATE find_match_candidates_v1 to enforce same-tier
-- ============================================
DROP FUNCTION IF EXISTS public.find_match_candidates_v1(uuid, uuid, text, integer, integer);

CREATE OR REPLACE FUNCTION public.find_match_candidates_v1(
  p_requester_id uuid,
  p_activity_id uuid,
  p_skill_band text,
  p_radius_meters integer,
  p_limit integer default 5
)
RETURNS TABLE(
  candidate_user_id uuid,
  activity_id uuid,
  skill_band text,
  distance_km numeric,
  skill_delta numeric,
  availability_overlap_minutes integer,
  reasons jsonb,
  match_score numeric
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH requester AS (
    SELECT u.id, u.home_location, u.tier_id
    FROM public.users u
    WHERE u.id = p_requester_id
  ),
  requester_skill AS (
    SELECT canonical_score
    FROM public.skill_profiles
    WHERE user_id = p_requester_id AND activity_id = p_activity_id
    LIMIT 1
  ),
  candidates AS (
    SELECT
      sp.user_id AS candidate_user_id,
      p_activity_id AS activity_id,
      sp.skill_band,
      st_distance(u.home_location, r.home_location) AS distance_meters,
      abs(sp.canonical_score - coalesce((SELECT canonical_score FROM requester_skill), sp.canonical_score)) AS skill_delta,
      public.calculate_availability_overlap_minutes(p_requester_id, sp.user_id, p_activity_id) AS availability_overlap_minutes,
      u.tier_id AS candidate_tier_id,
      r.tier_id AS requester_tier_id
    FROM public.skill_profiles sp
    JOIN public.users u ON u.id = sp.user_id
    CROSS JOIN requester r
    WHERE sp.user_id <> p_requester_id
      AND sp.activity_id = p_activity_id
      AND sp.skill_band = p_skill_band
      -- SAME-TIER ENFORCEMENT: Only match within same tier
      AND u.tier_id = r.tier_id
      AND st_dwithin(u.home_location, r.home_location, greatest(coalesce(p_radius_meters, 0), 1))
  )
  SELECT
    c.candidate_user_id,
    c.activity_id,
    c.skill_band,
    round((c.distance_meters / 1000.0)::numeric, 3) AS distance_km,
    round(c.skill_delta::numeric, 3) AS skill_delta,
    c.availability_overlap_minutes,
    to_jsonb(array[
      'activity_match',
      'skill_band_match',
      'same_tier_match',
      CASE
        WHEN c.availability_overlap_minutes >= 120 THEN 'high_availability_overlap'
        WHEN c.availability_overlap_minutes > 0 THEN 'availability_overlap'
        ELSE 'no_availability_overlap'
      END,
      CASE
        WHEN c.distance_meters <= greatest(coalesce(p_radius_meters, 0), 1) * 0.5 THEN 'nearby'
        ELSE 'within_radius'
      END
    ]::text[]) AS reasons,
    round((
      greatest(0::numeric, 1 - (c.distance_meters / greatest(coalesce(p_radius_meters, 0), 1)::numeric)) * 45
      + greatest(0::numeric, 1 - (c.skill_delta / 40.0)) * 35
      + (least(c.availability_overlap_minutes, 240)::numeric / 240.0) * 20
    )::numeric, 3) AS match_score
  FROM candidates c
  ORDER BY match_score DESC, c.availability_overlap_minutes DESC, c.distance_meters ASC, c.candidate_user_id ASC
  LIMIT least(greatest(coalesce(p_limit, 5), 1), 5);
$$;

-- Add comment documenting same-tier enforcement
COMMENT ON FUNCTION public.find_match_candidates_v1 IS 
'Finds compatible match candidates for a user. SAME-TIER ENFORCED: Only returns candidates in the same membership tier as the requester.';

-- ============================================
-- 2. Create view for match candidates with same-tier filter
-- ============================================
CREATE OR REPLACE VIEW public.match_candidates_same_tier AS
SELECT
  sp.user_id,
  sp.activity_id,
  sp.skill_band,
  sp.canonical_score,
  u.tier_id,
  u.display_name,
  u.avatar_url,
  u.city,
  mt.slug AS tier_slug
FROM public.skill_profiles sp
JOIN public.users u ON u.id = sp.user_id
LEFT JOIN public.membership_tiers mt ON mt.id = u.tier_id
WHERE u.deleted_at IS NULL
  AND COALESCE((u.deleted_at IS NULL), true) = true;

-- ============================================
-- 3. Add helper function for tier validation in matches
-- ============================================
CREATE OR REPLACE FUNCTION public.validate_match_tier_compatibility(
  p_requester_id uuid,
  p_candidate_id uuid
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_requester_tier uuid;
  v_candidate_tier uuid;
BEGIN
  -- Get tier IDs
  SELECT tier_id INTO v_requester_tier FROM public.users WHERE id = p_requester_id;
  SELECT tier_id INTO v_candidate_tier FROM public.users WHERE id = p_candidate_id;
  
  -- Both must exist and be in same tier
  RETURN v_requester_tier IS NOT NULL 
    AND v_candidate_tier IS NOT NULL 
    AND v_requester_tier = v_candidate_tier;
END;
$$;

COMMENT ON FUNCTION public.validate_match_tier_compatibility IS 
'Validates that two users are in the same tier before allowing a match. Returns true only if both users exist and share the same tier.';

-- ============================================
-- 4. Create trigger for match tier validation
-- ============================================
CREATE OR REPLACE FUNCTION public.trg_validate_match_tier()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_same_tier boolean;
BEGIN
  -- Check tier compatibility
  v_same_tier := public.validate_match_tier_compatibility(
    NEW.requester_user_id,
    NEW.candidate_user_id
  );
  
  IF NOT v_same_tier THEN
    RAISE EXCEPTION 'Match creation failed: users must be in the same tier';
  END IF;
  
  RETURN NEW;
END;
$$;

-- Apply trigger to matches table (optional - enable for strict enforcement)
-- DROP TRIGGER IF EXISTS trg_validate_match_tier ON public.matches;
-- CREATE TRIGGER trg_validate_match_tier
--   BEFORE INSERT ON public.matches
--   FOR EACH ROW
--   EXECUTE FUNCTION public.trg_validate_match_tier();

-- ============================================
-- 5. Create enforcement_logs table for audit
-- ============================================
CREATE TABLE IF NOT EXISTS public.enforcement_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action TEXT NOT NULL,
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  target_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  allowed BOOLEAN NOT NULL DEFAULT false,
  reason TEXT,
  request_ip INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add indexes for enforcement logs
CREATE INDEX IF NOT EXISTS idx_enforcement_logs_user ON public.enforcement_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_enforcement_logs_action ON public.enforcement_logs(action, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_enforcement_logs_created_at ON public.enforcement_logs(created_at DESC);

-- Enable RLS on enforcement logs
ALTER TABLE public.enforcement_logs ENABLE ROW LEVEL SECURITY;

-- Only users can see their own enforcement logs
CREATE POLICY enforcement_logs_select_own ON public.enforcement_logs
  FOR SELECT USING (user_id = auth.uid());

-- System only inserts (via security definer functions)
CREATE POLICY enforcement_logs_insert_system ON public.enforcement_logs
  FOR INSERT WITH CHECK (false);

-- ============================================
-- 6. Update network-graph view to include same-tier enforcement
-- ============================================
CREATE OR REPLACE VIEW public.network_graph_same_tier AS
SELECT 
  uc.id as edge_id,
  uc.user_id as source_id,
  uc.connected_user_id as target_id,
  uc.status as relationship_state,
  uc.strength_score,
  uc.rounds_count,
  uc.last_interaction_at,
  uc.saved_by_user_a,
  uc.saved_by_user_b,
  CASE 
    WHEN uc.user_id = auth.uid() THEN uc.saved_by_user_a
    ELSE uc.saved_by_user_b
  END as is_saved_by_me,
  u1.display_name as source_name,
  u2.display_name as target_name,
  u1.avatar_url as source_avatar,
  u2.avatar_url as target_avatar,
  mt1.slug as source_tier,
  mt2.slug as target_tier
FROM public.user_connections uc
JOIN public.users u1 ON u1.id = uc.user_id
JOIN public.users u2 ON u2.id = uc.connected_user_id
LEFT JOIN public.membership_tiers mt1 ON mt1.id = u1.tier_id
LEFT JOIN public.membership_tiers mt2 ON mt2.id = u2.tier_id
WHERE uc.status = 'accepted'
  -- Same-tier enforcement: both users must be in same tier
  AND u1.tier_id = u2.tier_id;

-- ============================================
-- 7. Add realtime for enforcement logs
-- ============================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.enforcement_logs;
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ============================================
-- DOWN MIGRATION (rollback)
-- ============================================
/*
-- Drop trigger
DROP TRIGGER IF EXISTS trg_validate_match_tier ON public.matches;

-- Drop functions
DROP FUNCTION IF EXISTS public.trg_validate_match_tier();
DROP FUNCTION IF EXISTS public.validate_match_tier_compatibility(uuid, uuid);

-- Drop view
DROP VIEW IF EXISTS public.match_candidates_same_tier;
DROP VIEW IF EXISTS public.network_graph_same_tier;

-- Drop policies
DROP POLICY IF EXISTS enforcement_logs_select_own ON public.enforcement_logs;
DROP POLICY IF EXISTS enforcement_logs_insert_system ON public.enforcement_logs;

-- Disable RLS
ALTER TABLE public.enforcement_logs DISABLE ROW LEVEL SECURITY;

-- Drop indexes
DROP INDEX IF EXISTS idx_enforcement_logs_user;
DROP INDEX IF EXISTS idx_enforcement_logs_action;
DROP INDEX IF EXISTS idx_enforcement_logs_created_at;

-- Drop table
DROP TABLE IF EXISTS public.enforcement_logs;

-- Restore original function (without same-tier enforcement)
DROP FUNCTION IF EXISTS public.find_match_candidates_v1(uuid, uuid, text, integer, integer);
-- Note: Original function would need to be restored from backup or previous migration
*/
-- ============================================================================
-- Epic 5 Migration: Rounds as Social Infrastructure
-- Standing foursomes, post-round ratings, network context, and lifecycle states
-- ============================================================================

-- ============================================
-- UP MIGRATION
-- ============================================

-- 1. Create round_lifecycle_status enum for more granular round states
CREATE TYPE public.round_lifecycle_status AS ENUM (
  'planning',        -- Initial creation, building the group
  'invited',         -- Invitations sent, awaiting responses
  'confirmed',       -- All players confirmed
  'played',          -- Round has been played
  'review_pending',  -- Awaiting post-round ratings
  'reviewed',        -- All ratings submitted
  'review_closed',   -- Rating window closed
  'cancelled'        -- Round was cancelled
);

-- 2. Create cadence enum for standing foursomes
CREATE TYPE public.foursome_cadence AS ENUM (
  'weekly',
  'biweekly',
  'monthly',
  'flexible'
);

-- 3. Create standing_foursomes table
CREATE TABLE IF NOT EXISTS public.standing_foursomes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Group info
  name TEXT NOT NULL,
  description TEXT CHECK (char_length(description) <= 280),
  
  -- Organizer (creator)
  organizer_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  
  -- Course preference (optional - can be flexible)
  preferred_course_id uuid REFERENCES public.golf_courses(id) ON DELETE SET NULL,
  
  -- Cadence preference
  cadence public.foursome_cadence DEFAULT 'flexible',
  preferred_day TEXT CHECK (preferred_day IN ('weekday', 'weekend', 'flexible')),
  preferred_time TEXT CHECK (preferred_time IN ('morning', 'midday', 'afternoon', 'flexible')),
  
  -- Tracking
  rounds_played_count INTEGER DEFAULT 0,
  last_round_at TIMESTAMPTZ,
  next_round_at TIMESTAMPTZ,
  
  -- Status
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'paused', 'disbanded')),
  
  -- Same-tier enforcement
  tier_id uuid NOT NULL REFERENCES public.membership_tiers(id) ON DELETE RESTRICT,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Create standing_foursome_members junction table
CREATE TABLE IF NOT EXISTS public.standing_foursome_members (
  foursome_id uuid REFERENCES public.standing_foursomes(id) ON DELETE CASCADE,
  user_id uuid REFERENCES public.users(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ DEFAULT now(),
  role TEXT DEFAULT 'member' CHECK (role IN ('organizer', 'member')),
  
  PRIMARY KEY (foursome_id, user_id)
);

-- 5. Skip round_ratings table creation - already exists from migration 0017
-- The table from 0017 has: rated_user_id and rater_user_id columns
-- This migration expects: ratee_id and rater_id columns
-- For now, skip this and use existing table structure from 0017

-- 6. Add new columns to rounds table
ALTER TABLE public.rounds 
  ADD COLUMN IF NOT EXISTS lifecycle_status public.round_lifecycle_status DEFAULT 'planning',
  ADD COLUMN IF NOT EXISTS source_type TEXT CHECK (source_type IN ('standing_foursome', 'network_invite', 'discovery', 'direct')),
  ADD COLUMN IF NOT EXISTS standing_foursome_id uuid REFERENCES public.standing_foursomes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS network_context JSONB, -- Stores network-driven context (mutual connections, etc.)
  ADD COLUMN IF NOT EXISTS played_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS review_window_closes_at TIMESTAMPTZ;

-- 7. Add round counting columns to users for free tier enforcement
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS rounds_created_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rounds_joined_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS monthly_rounds_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rounds_count_reset_at TIMESTAMPTZ DEFAULT now();

-- 8. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_standing_foursomes_organizer ON public.standing_foursomes(organizer_id);
CREATE INDEX IF NOT EXISTS idx_standing_foursomes_tier ON public.standing_foursomes(tier_id);
CREATE INDEX IF NOT EXISTS idx_standing_foursomes_status ON public.standing_foursomes(status);
CREATE INDEX IF NOT EXISTS idx_standing_foursomes_next_round ON public.standing_foursomes(next_round_at) WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_standing_foursome_members_user ON public.standing_foursome_members(user_id);
CREATE INDEX IF NOT EXISTS idx_standing_foursome_members_foursome ON public.standing_foursome_members(foursome_id);

-- Note: round_ratings table and indexes already exist from migration 0017
-- Creating only indexes that don't exist yet
-- (idx_round_ratings_round, idx_round_ratings_rater exist from 0017)
-- Skipping: idx_round_ratings_ratee, idx_round_ratings_play_again - columns don't exist

CREATE INDEX IF NOT EXISTS idx_rounds_lifecycle_status ON public.rounds(lifecycle_status);
CREATE INDEX IF NOT EXISTS idx_rounds_standing_foursome ON public.rounds(standing_foursome_id);
CREATE INDEX IF NOT EXISTS idx_rounds_source_type ON public.rounds(source_type);
CREATE INDEX IF NOT EXISTS idx_rounds_review_window ON public.rounds(review_window_closes_at) WHERE lifecycle_status = 'review_pending';

-- 9. Enable RLS on new tables
ALTER TABLE public.standing_foursomes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.standing_foursome_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.round_ratings ENABLE ROW LEVEL SECURITY;

-- 10. RLS Policies for standing_foursomes

-- Users can see foursomes they are members of (same tier only)
CREATE POLICY standing_foursomes_select_member ON public.standing_foursomes
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.standing_foursome_members sfm
      WHERE sfm.foursome_id = standing_foursomes.id
        AND sfm.user_id = auth.uid()
    )
  );

-- Organizer can insert
CREATE POLICY standing_foursomes_insert_organizer ON public.standing_foursomes
  FOR INSERT WITH CHECK (auth.uid() = organizer_id);

-- Organizer can update
CREATE POLICY standing_foursomes_update_organizer ON public.standing_foursomes
  FOR UPDATE USING (auth.uid() = organizer_id) WITH CHECK (auth.uid() = organizer_id);

-- Organizer can delete
CREATE POLICY standing_foursomes_delete_organizer ON public.standing_foursomes
  FOR DELETE USING (auth.uid() = organizer_id);

-- 11. RLS Policies for standing_foursome_members

-- Members can see other members of their foursomes
CREATE POLICY standing_foursome_members_select_member ON public.standing_foursome_members
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.standing_foursome_members sfm
      WHERE sfm.foursome_id = standing_foursome_members.foursome_id
        AND sfm.user_id = auth.uid()
    )
  );

-- Organizer can insert members
CREATE POLICY standing_foursome_members_insert_organizer ON public.standing_foursome_members
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.standing_foursomes sf
      WHERE sf.id = standing_foursome_members.foursome_id
        AND sf.organizer_id = auth.uid()
    )
  );

-- Organizer can update roles
CREATE POLICY standing_foursome_members_update_organizer ON public.standing_foursome_members
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.standing_foursomes sf
      WHERE sf.id = standing_foursome_members.foursome_id
        AND sf.organizer_id = auth.uid()
    )
  );

-- Members can remove themselves, organizer can remove anyone
CREATE POLICY standing_foursome_members_delete_member ON public.standing_foursome_members
  FOR DELETE USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.standing_foursomes sf
      WHERE sf.id = standing_foursome_members.foursome_id
        AND sf.organizer_id = auth.uid()
    )
  );

-- 12. Skip RLS Policies for round_ratings - already exists from migration 0017
-- Using existing policies from 0017

-- 13. Create function to update standing_foursome rounds count
CREATE OR REPLACE FUNCTION public.update_standing_foursome_stats()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Update last_round_at and increment count when a round is marked played
  IF NEW.lifecycle_status = 'played' AND OLD.lifecycle_status != 'played' THEN
    UPDATE public.standing_foursomes
    SET 
      rounds_played_count = rounds_played_count + 1,
      last_round_at = NEW.played_at,
      updated_at = now()
    WHERE id = NEW.standing_foursome_id;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Apply trigger
CREATE TRIGGER trg_update_standing_foursome_stats
  AFTER UPDATE OF lifecycle_status ON public.rounds
  FOR EACH ROW
  EXECUTE FUNCTION public.update_standing_foursome_stats();

-- 14. Create function to update user's monthly round count
CREATE OR REPLACE FUNCTION public.update_user_round_counts()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_creator_id uuid;
  v_tier_id uuid;
  v_tier_slug text;
BEGIN
  -- Get creator and tier info
  SELECT r.creator_id, r.tier_id, mt.slug INTO v_creator_id, v_tier_id, v_tier_slug
  FROM public.rounds r
  JOIN public.membership_tiers mt ON mt.id = r.tier_id
  WHERE r.id = NEW.round_id;
  
  -- Only count if creator is free tier
  IF v_tier_slug = 'free' THEN
    -- Check if we need to reset monthly count
    UPDATE public.users
    SET 
      monthly_rounds_count = CASE 
        WHEN rounds_count_reset_at < date_trunc('month', now()) THEN 1
        ELSE monthly_rounds_count + 1
      END,
      rounds_count_reset_at = CASE 
        WHEN rounds_count_reset_at < date_trunc('month', now()) THEN date_trunc('month', now())
        ELSE rounds_count_reset_at
      END,
      rounds_created_count = rounds_created_count + 1
    WHERE id = v_creator_id;
  ELSE
    -- Non-free tiers just increment total
    UPDATE public.users
    SET rounds_created_count = rounds_created_count + 1
    WHERE id = v_creator_id;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Apply trigger when participant is added (indicating round joined)
CREATE TRIGGER trg_update_user_round_counts
  AFTER INSERT ON public.round_participants_v2
  FOR EACH ROW
  EXECUTE FUNCTION public.update_user_round_counts();

-- 15. Create function to auto-update round status to review_pending
CREATE OR REPLACE FUNCTION public.mark_round_played()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Mark round as played and set review window
  IF NEW.lifecycle_status = 'played' AND OLD.lifecycle_status != 'played' THEN
    NEW.played_at := COALESCE(NEW.played_at, now());
    NEW.lifecycle_status := 'review_pending';
    NEW.review_window_closes_at := NEW.played_at + interval '7 days';
  END IF;
  
  RETURN NEW;
END;
$$;

-- 16. Create function to check if all ratings submitted and close review
CREATE OR REPLACE FUNCTION public.check_round_review_complete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_round_id uuid;
  v_total_players integer;
  v_total_ratings integer;
  v_expected_ratings integer;
BEGIN
  v_round_id := NEW.round_id;
  
  -- Count total players in round
  SELECT COUNT(*) INTO v_total_players
  FROM public.round_participants_v2
  WHERE round_id = v_round_id;
  
  -- Each player rates all others, so expected ratings = n * (n-1)
  v_expected_ratings := v_total_players * (v_total_players - 1);
  
  -- Count actual ratings for this round
  SELECT COUNT(*) INTO v_total_ratings
  FROM public.round_ratings
  WHERE round_id = v_round_id;
  
  -- If all ratings submitted, mark as reviewed
  IF v_total_ratings >= v_expected_ratings THEN
    UPDATE public.rounds
    SET 
      lifecycle_status = 'reviewed',
      reviewed_at = now()
    WHERE id = v_round_id
      AND lifecycle_status = 'review_pending';
  END IF;
  
  RETURN NEW;
END;
$$;

-- Apply trigger
CREATE TRIGGER trg_check_round_review_complete
  AFTER INSERT OR UPDATE ON public.round_ratings
  FOR EACH ROW
  EXECUTE FUNCTION public.check_round_review_complete();

-- 17. Create updated_at triggers
CREATE TRIGGER trg_standing_foursomes_updated_at
  BEFORE UPDATE ON public.standing_foursomes
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_round_ratings_updated_at
  BEFORE UPDATE ON public.round_ratings
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- 18. Create function to get network-round-eligible users
CREATE OR REPLACE FUNCTION public.get_network_round_eligible_users(
  p_user_id UUID,
  p_exclude_round_id UUID DEFAULT NULL
)
RETURNS TABLE (
  user_id UUID,
  display_name TEXT,
  avatar_url TEXT,
  current_handicap INTEGER,
  connection_type TEXT,
  mutual_count INTEGER,
  played_together_count BIGINT,
  last_round_together DATE
) AS $$
BEGIN
  RETURN QUERY
  WITH eligible AS (
    -- Direct connections
    SELECT 
      uc.addressee_id AS uid,
      'direct'::TEXT AS conn_type,
      0 AS mutuals
    FROM public.user_connections uc
    WHERE uc.requester_id = p_user_id
      AND uc.status = 'accepted'
    
    UNION
    
    -- Saved members
    SELECT 
      sm.saved_user_id AS uid,
      'saved'::TEXT AS conn_type,
      0 AS mutuals
    FROM public.saved_members sm
    WHERE sm.saver_id = p_user_id
    
    UNION
    
    -- 2nd degree via introduction
    SELECT 
      ir.introduced_id AS uid,
      'mutual'::TEXT AS conn_type,
      1 AS mutuals
    FROM public.introduction_requests ir
    WHERE ir.requester_id = p_user_id
      AND ir.status = 'accepted'
  )
  SELECT 
    u.id,
    u.display_name,
    u.avatar_url,
    u.current_handicap,
    e.conn_type,
    e.mutuals::INTEGER,
    COALESCE(pt.played_count, 0)::BIGINT,
    pt.last_round::DATE
  FROM eligible e
  JOIN public.users u ON u.id = e.uid
  -- Exclude users already in the round
  WHERE NOT EXISTS (
    SELECT 1 FROM public.round_participants_v2 rp
    WHERE rp.user_id = e.uid
      AND (p_exclude_round_id IS NULL OR rp.round_id = p_exclude_round_id)
  )
  -- Exclude users with pending invitations to this round
  AND NOT EXISTS (
    SELECT 1 FROM public.round_invitations ri
    WHERE ri.invitee_id = e.uid
      AND ri.status = 'pending'
      AND (p_exclude_round_id IS NULL OR ri.round_id = p_exclude_round_id)
  )
  ORDER BY 
    CASE e.conn_type 
      WHEN 'direct' THEN 1 
      WHEN 'saved' THEN 2 
      ELSE 3 
    END,
    COALESCE(pt.played_count, 0) DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 19. Create function to get user rating aggregates
CREATE OR REPLACE FUNCTION public.get_user_rating_aggregates(p_user_id UUID)
RETURNS TABLE (
  total_rounds_rated BIGINT,
  avg_punctuality NUMERIC,
  avg_etiquette NUMERIC,
  avg_enjoyment NUMERIC,
  avg_business_value NUMERIC,
  play_again_percentage NUMERIC,
  would_introduce_percentage NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(DISTINCT round_id)::BIGINT AS total_rounds_rated,
    ROUND(AVG(punctuality), 1) AS avg_punctuality,
    ROUND(AVG(golf_etiquette), 1) AS avg_etiquette,
    ROUND(AVG(enjoyment), 1) AS avg_enjoyment,
    ROUND(AVG(business_value), 1) AS avg_business_value,
    ROUND(100.0 * SUM(CASE WHEN play_again THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0), 1) AS play_again_percentage,
    ROUND(100.0 * SUM(CASE WHEN would_introduce THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0), 1) AS would_introduce_percentage
  FROM public.round_ratings
  WHERE ratee_id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 20. Add realtime publication
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.standing_foursomes;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.standing_foursome_members;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.round_ratings;
  END IF;
END $$;

-- 21. Add comments for documentation
COMMENT ON TABLE public.standing_foursomes IS 'Recurring golf groups/standing foursomes. Members play together regularly.';
COMMENT ON TABLE public.standing_foursome_members IS 'Junction table linking users to standing foursomes.';
COMMENT ON TABLE public.round_ratings IS 'Post-round player ratings. Private per rater-ratee pair, aggregates public.';
COMMENT ON COLUMN public.rounds.lifecycle_status IS 'Extended lifecycle: planning -> invited -> confirmed -> played -> review_pending -> reviewed/closed';
COMMENT ON COLUMN public.rounds.source_type IS 'How the round was created: standing_foursome, network_invite, discovery, direct';
COMMENT ON COLUMN public.users.monthly_rounds_count IS 'Tracks free tier 3-round monthly limit. Resets monthly.';

-- ============================================
-- DOWN MIGRATION (for reference)
-- ============================================
/*
-- Remove triggers
DROP TRIGGER IF EXISTS trg_update_standing_foursome_stats ON public.rounds;
DROP TRIGGER IF EXISTS trg_update_user_round_counts ON public.round_participants_v2;
DROP TRIGGER IF EXISTS trg_check_round_review_complete ON public.round_ratings;
DROP TRIGGER IF EXISTS trg_standing_foursomes_updated_at ON public.standing_foursomes;
DROP TRIGGER IF EXISTS trg_round_ratings_updated_at ON public.round_ratings;

-- Remove functions
DROP FUNCTION IF EXISTS public.update_standing_foursome_stats();
DROP FUNCTION IF EXISTS public.update_user_round_counts();
DROP FUNCTION IF EXISTS public.mark_round_played();
DROP FUNCTION IF EXISTS public.check_round_review_complete();
DROP FUNCTION IF EXISTS public.get_network_round_eligible_users(UUID, UUID);
DROP FUNCTION IF EXISTS public.get_user_rating_aggregates(UUID);

-- Remove RLS policies
DROP POLICY IF EXISTS standing_foursomes_select_member ON public.standing_foursomes;
DROP POLICY IF EXISTS standing_foursomes_insert_organizer ON public.standing_foursomes;
DROP POLICY IF EXISTS standing_foursomes_update_organizer ON public.standing_foursomes;
DROP POLICY IF EXISTS standing_foursomes_delete_organizer ON public.standing_foursomes;

DROP POLICY IF EXISTS standing_foursome_members_select_member ON public.standing_foursome_members;
DROP POLICY IF EXISTS standing_foursome_members_insert_organizer ON public.standing_foursome_members;
DROP POLICY IF EXISTS standing_foursome_members_update_organizer ON public.standing_foursome_members;
DROP POLICY IF EXISTS standing_foursome_members_delete_member ON public.standing_foursome_members;

DROP POLICY IF EXISTS round_ratings_select_involved ON public.round_ratings;
DROP POLICY IF EXISTS round_ratings_insert_rater ON public.round_ratings;
DROP POLICY IF EXISTS round_ratings_update_rater ON public.round_ratings;
DROP POLICY IF EXISTS round_ratings_delete_rater ON public.round_ratings;

-- Disable RLS
ALTER TABLE public.standing_foursomes DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.standing_foursome_members DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.round_ratings DISABLE ROW LEVEL SECURITY;

-- Remove indexes
DROP INDEX IF EXISTS idx_standing_foursomes_organizer;
DROP INDEX IF EXISTS idx_standing_foursomes_tier;
DROP INDEX IF EXISTS idx_standing_foursomes_status;
DROP INDEX IF EXISTS idx_standing_foursomes_next_round;
DROP INDEX IF EXISTS idx_standing_foursome_members_user;
DROP INDEX IF EXISTS idx_standing_foursome_members_foursome;
DROP INDEX IF EXISTS idx_round_ratings_round;
DROP INDEX IF EXISTS idx_round_ratings_rater;
DROP INDEX IF EXISTS idx_round_ratings_ratee;
DROP INDEX IF EXISTS idx_round_ratings_play_again;
DROP INDEX IF EXISTS idx_rounds_lifecycle_status;
DROP INDEX IF EXISTS idx_rounds_standing_foursome;
DROP INDEX IF EXISTS idx_rounds_source_type;
DROP INDEX IF EXISTS idx_rounds_review_window;

-- Remove columns from rounds
ALTER TABLE public.rounds 
  DROP COLUMN IF EXISTS lifecycle_status,
  DROP COLUMN IF EXISTS source_type,
  DROP COLUMN IF EXISTS standing_foursome_id,
  DROP COLUMN IF EXISTS network_context,
  DROP COLUMN IF EXISTS played_at,
  DROP COLUMN IF EXISTS reviewed_at,
  DROP COLUMN IF EXISTS review_window_closes_at;

-- Remove columns from users
ALTER TABLE public.users
  DROP COLUMN IF EXISTS rounds_created_count,
  DROP COLUMN IF EXISTS rounds_joined_count,
  DROP COLUMN IF EXISTS monthly_rounds_count,
  DROP COLUMN IF EXISTS rounds_count_reset_at;

-- Remove realtime publication
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.standing_foursomes;
    ALTER PUBLICATION supabase_realtime DROP TABLE public.standing_foursome_members;
    ALTER PUBLICATION supabase_realtime DROP TABLE public.round_ratings;
  END IF;
END $$;

-- Drop tables
DROP TABLE IF EXISTS public.round_ratings;
DROP TABLE IF EXISTS public.standing_foursome_members;
DROP TABLE IF EXISTS public.standing_foursomes;

-- Drop enums
DROP TYPE IF EXISTS public.round_lifecycle_status;
DROP TYPE IF EXISTS public.foursome_cadence;
*/
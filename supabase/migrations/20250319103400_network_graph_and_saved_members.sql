-- Epic 4: Private Network Graph & Saved Members
-- Extends user_connections table and creates new saved_members and introductions tables
-- Same-tier enforcement with PostgreSQL only

-- ============================================
-- UP MIGRATION
-- ============================================

-- 1. Create relationship_state enum for connection evolution
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'relationship_state') THEN
    CREATE TYPE public.relationship_state AS ENUM (
      'matched',           -- Initial match via app
      'invited',           -- Round invitation extended
      'played_together',   -- Completed at least one round
      'regular_partner'    -- Played 3+ rounds together
    );
  END IF;
END $$;

-- 2. Extend user_connections table with network graph fields
ALTER TABLE public.user_connections
  ADD COLUMN IF NOT EXISTS relationship_state public.relationship_state DEFAULT 'matched',
  ADD COLUMN IF NOT EXISTS strength_score INTEGER DEFAULT 0 CHECK (strength_score >= 0 AND strength_score <= 100),
  ADD COLUMN IF NOT EXISTS saved_by_user_a BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS saved_by_user_b BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS rounds_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_interaction_at TIMESTAMPTZ;

-- 3. Create saved_members table for personal network management
CREATE TABLE IF NOT EXISTS public.saved_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  saver_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  saved_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  tier TEXT NOT NULL DEFAULT 'standard' CHECK (tier IN ('favorite', 'standard', 'archived')),
  notes TEXT,
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Prevent duplicate saves
  UNIQUE(saver_id, saved_id),
  -- Prevent self-save
  CHECK (saver_id <> saved_id)
);

-- 4. Create introductions table for request/response flow
-- Note: This replaces/enhances introduction_requests from Sprint 3
CREATE TABLE IF NOT EXISTS public.introductions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  target_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  connector_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'expired')),
  connector_message TEXT,
  target_message TEXT,
  decline_reason TEXT,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  responded_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Prevent self-introductions
  CHECK (requester_id <> target_id),
  CHECK (requester_id <> connector_id),
  CHECK (target_id <> connector_id)
);

-- 5. Create indexes for performance
-- Connection indexes
CREATE INDEX IF NOT EXISTS idx_connections_relationship_state ON public.user_connections(relationship_state);
CREATE INDEX IF NOT EXISTS idx_connections_strength ON public.user_connections(strength_score DESC);
CREATE INDEX IF NOT EXISTS idx_connections_saved_a ON public.user_connections(saved_by_user_a) WHERE saved_by_user_a = TRUE;
CREATE INDEX IF NOT EXISTS idx_connections_saved_b ON public.user_connections(saved_by_user_b) WHERE saved_by_user_b = TRUE;
CREATE INDEX IF NOT EXISTS idx_connections_rounds ON public.user_connections(rounds_count DESC);
CREATE INDEX IF NOT EXISTS idx_connections_last_interaction ON public.user_connections(last_interaction_at DESC);

-- Saved members indexes
CREATE INDEX IF NOT EXISTS idx_saved_members_saver ON public.saved_members(saver_id);
CREATE INDEX IF NOT EXISTS idx_saved_members_saved ON public.saved_members(saved_id);
CREATE INDEX IF NOT EXISTS idx_saved_members_tier ON public.saved_members(saver_id, tier);
CREATE INDEX IF NOT EXISTS idx_saved_members_tags ON public.saved_members USING GIN(tags);

-- Introductions indexes
CREATE INDEX IF NOT EXISTS idx_introductions_requester ON public.introductions(requester_id, status);
CREATE INDEX IF NOT EXISTS idx_introductions_target ON public.introductions(target_id, status);
CREATE INDEX IF NOT EXISTS idx_introductions_connector ON public.introductions(connector_id, status);
CREATE INDEX IF NOT EXISTS idx_introductions_status ON public.introductions(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_introductions_expires ON public.introductions(expires_at) WHERE status = 'pending';

-- 6. Enable RLS on new tables
ALTER TABLE public.saved_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.introductions ENABLE ROW LEVEL SECURITY;

-- 7. Create helper function for same-tier check
CREATE OR REPLACE FUNCTION public.check_same_tier(user_a_id UUID, user_b_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  tier_a UUID;
  tier_b UUID;
BEGIN
  SELECT tier_id INTO tier_a FROM public.users WHERE id = user_a_id;
  SELECT tier_id INTO tier_b FROM public.users WHERE id = user_b_id;
  
  -- Both must exist and be in same tier
  RETURN tier_a IS NOT NULL AND tier_b IS NOT NULL AND tier_a = tier_b;
END;
$$;

-- 8. Create RLS policies for saved_members (same-tier enforcement)
-- Users can only see saved members in their tier
CREATE POLICY saved_members_select_same_tier ON public.saved_members
  FOR SELECT USING (
    -- User can see their own saves
    saver_id = auth.uid()
    -- And target must be in same tier
    AND EXISTS (
      SELECT 1 FROM public.users u1
      JOIN public.users u2 ON u2.id = saved_members.saved_id
      WHERE u1.id = auth.uid()
        AND u1.tier_id = u2.tier_id
    )
  );

CREATE POLICY saved_members_insert_own ON public.saved_members
  FOR INSERT WITH CHECK (
    saver_id = auth.uid()
    -- And target must be in same tier
    AND EXISTS (
      SELECT 1 FROM public.users u1
      JOIN public.users u2 ON u2.id = saved_members.saved_id
      WHERE u1.id = auth.uid()
        AND u1.tier_id = u2.tier_id
    )
  );

CREATE POLICY saved_members_update_own ON public.saved_members
  FOR UPDATE USING (saver_id = auth.uid()) WITH CHECK (saver_id = auth.uid());

CREATE POLICY saved_members_delete_own ON public.saved_members
  FOR DELETE USING (saver_id = auth.uid());

-- 9. Create RLS policies for introductions (same-tier enforcement)
-- All involved parties must be in same tier
CREATE POLICY introductions_select_involved ON public.introductions
  FOR SELECT USING (
    auth.uid() IN (requester_id, target_id, connector_id)
    -- Enforce same-tier visibility
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND u.tier_id = (
          SELECT tier_id FROM public.users WHERE id = introductions.requester_id
        )
        AND u.tier_id = (
          SELECT tier_id FROM public.users WHERE id = introductions.target_id
        )
        AND u.tier_id = (
          SELECT tier_id FROM public.users WHERE id = introductions.connector_id
        )
    )
  );

CREATE POLICY introductions_insert_requester ON public.introductions
  FOR INSERT WITH CHECK (
    auth.uid() = requester_id
    -- Enforce same-tier - all parties must be same tier
    AND check_same_tier(requester_id, target_id)
    AND check_same_tier(requester_id, connector_id)
    AND check_same_tier(target_id, connector_id)
  );

CREATE POLICY introductions_update_connector ON public.introductions
  FOR UPDATE USING (
    auth.uid() = connector_id
    AND status = 'pending'
  ) WITH CHECK (
    auth.uid() = connector_id
  );

-- 10. Update user_connections RLS policies for enhanced security
-- Drop existing and recreate with same-tier enforcement
DROP POLICY IF EXISTS connections_select_involved ON public.user_connections;

CREATE POLICY connections_select_involved ON public.user_connections
  FOR SELECT USING (
    auth.uid() = user_id OR auth.uid() = connected_user_id
    -- Same-tier check
    AND EXISTS (
      SELECT 1 FROM public.users u1
      JOIN public.users u2 ON u2.id = CASE 
        WHEN auth.uid() = user_connections.user_id THEN user_connections.connected_user_id
        ELSE user_connections.user_id
      END
      WHERE u1.id = auth.uid()
        AND u1.tier_id = u2.tier_id
    )
  );

-- 11. Create function to update connection on round completion
CREATE OR REPLACE FUNCTION public.update_connection_on_round(
  p_user_a_id UUID,
  p_user_b_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_connection_id UUID;
  v_current_rounds INTEGER;
  v_new_state public.relationship_state;
BEGIN
  -- Find the connection
  SELECT id, rounds_count INTO v_connection_id, v_current_rounds
  FROM public.user_connections
  WHERE (user_id = p_user_a_id AND connected_user_id = p_user_b_id)
     OR (user_id = p_user_b_id AND connected_user_id = p_user_a_id)
     AND status = 'accepted';
  
  IF v_connection_id IS NULL THEN
    RETURN;
  END IF;
  
  -- Increment rounds count
  v_current_rounds := COALESCE(v_current_rounds, 0) + 1;
  
  -- Determine new relationship state
  IF v_current_rounds >= 3 THEN
    v_new_state := 'regular_partner';
  ELSIF v_current_rounds >= 1 THEN
    v_new_state := 'played_together';
  ELSE
    v_new_state := 'invited';
  END IF;
  
  -- Update connection
  UPDATE public.user_connections
  SET 
    rounds_count = v_current_rounds,
    relationship_state = v_new_state,
    strength_score = LEAST(100, (COALESCE(strength_score, 0) + 10)),
    last_interaction_at = NOW(),
    updated_at = NOW()
  WHERE id = v_connection_id;
END;
$$;

-- 12. Create function to calculate connection strength
CREATE OR REPLACE FUNCTION public.calculate_connection_strength(
  p_connection_id UUID
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rounds_count INTEGER;
  v_last_interaction TIMESTAMPTZ;
  v_days_since_interaction INTEGER;
  v_base_score INTEGER;
  v_time_decay INTEGER;
  v_final_score INTEGER;
BEGIN
  SELECT rounds_count, last_interaction_at
  INTO v_rounds_count, v_last_interaction
  FROM public.user_connections
  WHERE id = p_connection_id;
  
  IF v_rounds_count IS NULL THEN
    RETURN 0;
  END IF;
  
  -- Base score from rounds (max 60 points)
  v_base_score := LEAST(60, v_rounds_count * 15);
  
  -- Time decay - lose 5 points per month of inactivity
  v_days_since_interaction := EXTRACT(DAY FROM (NOW() - COALESCE(v_last_interaction, NOW())))::INTEGER;
  v_time_decay := LEAST(40, (v_days_since_interaction / 30) * 5);
  
  v_final_score := GREATEST(0, v_base_score - v_time_decay);
  
  RETURN v_final_score;
END;
$$;

-- 13. Create trigger to auto-update strength_score
CREATE OR REPLACE FUNCTION public.trg_update_connection_strength()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  NEW.strength_score := public.calculate_connection_strength(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_connection_strength ON public.user_connections;
CREATE TRIGGER trg_connection_strength
  BEFORE UPDATE ON public.user_connections
  FOR EACH ROW
  WHEN (NEW.rounds_count IS DISTINCT FROM OLD.rounds_count OR NEW.last_interaction_at IS DISTINCT FROM OLD.last_interaction_at)
  EXECUTE FUNCTION public.trg_update_connection_strength();

-- 14. Add realtime for new tables
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.saved_members;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.introductions;
  END IF;
END $$;

-- 15. Create updated_at trigger for new tables
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_saved_members_updated_at
  BEFORE UPDATE ON public.saved_members
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_introductions_updated_at
  BEFORE UPDATE ON public.introductions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 16. Create view for network graph data (nodes and edges)
CREATE OR REPLACE VIEW public.network_graph AS
SELECT 
  uc.id as edge_id,
  uc.user_id as source_id,
  uc.connected_user_id as target_id,
  uc.relationship_state,
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
WHERE uc.status = 'accepted';

-- 17. Create function to get network stats
CREATE OR REPLACE FUNCTION public.get_network_stats(p_user_id UUID)
RETURNS TABLE (
  total_connections BIGINT,
  saved_connections BIGINT,
  regular_partners BIGINT,
  avg_strength_score NUMERIC,
  pending_introductions BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    (SELECT COUNT(*)::BIGINT 
     FROM public.user_connections 
     WHERE (user_id = p_user_id OR connected_user_id = p_user_id) 
       AND status = 'accepted'),
    (SELECT COUNT(*)::BIGINT 
     FROM public.user_connections 
     WHERE (user_id = p_user_id AND saved_by_user_a = TRUE)
        OR (connected_user_id = p_user_id AND saved_by_user_b = TRUE)),
    (SELECT COUNT(*)::BIGINT 
     FROM public.user_connections 
     WHERE (user_id = p_user_id OR connected_user_id = p_user_id) 
       AND status = 'accepted' 
       AND relationship_state = 'regular_partner'),
    (SELECT COALESCE(AVG(strength_score), 0)::NUMERIC 
     FROM public.user_connections 
     WHERE (user_id = p_user_id OR connected_user_id = p_user_id) 
       AND status = 'accepted'),
    (SELECT COUNT(*)::BIGINT 
     FROM public.introductions 
     WHERE (requester_id = p_user_id OR target_id = p_user_id OR connector_id = p_user_id)
       AND status = 'pending');
END;
$$;

-- ============================================
-- DOWN MIGRATION (rollback)
-- ============================================
/*
-- Drop triggers
DROP TRIGGER IF EXISTS trg_connection_strength ON public.user_connections;
DROP TRIGGER IF EXISTS trg_saved_members_updated_at ON public.saved_members;
DROP TRIGGER IF EXISTS trg_introductions_updated_at ON public.introductions;

-- Drop functions
DROP FUNCTION IF EXISTS public.check_same_tier(UUID, UUID);
DROP FUNCTION IF EXISTS public.update_connection_on_round(UUID, UUID);
DROP FUNCTION IF EXISTS public.calculate_connection_strength(UUID);
DROP FUNCTION IF EXISTS public.trg_update_connection_strength();
DROP FUNCTION IF EXISTS public.get_network_stats(UUID);

-- Drop view
DROP VIEW IF EXISTS public.network_graph;

-- Drop RLS policies
DROP POLICY IF EXISTS saved_members_select_same_tier ON public.saved_members;
DROP POLICY IF EXISTS saved_members_insert_own ON public.saved_members;
DROP POLICY IF EXISTS saved_members_update_own ON public.saved_members;
DROP POLICY IF EXISTS saved_members_delete_own ON public.saved_members;

DROP POLICY IF EXISTS introductions_select_involved ON public.introductions;
DROP POLICY IF EXISTS introductions_insert_requester ON public.introductions;
DROP POLICY IF EXISTS introductions_update_connector ON public.introductions;

DROP POLICY IF EXISTS connections_select_involved ON public.user_connections;

-- Disable RLS
ALTER TABLE public.saved_members DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.introductions DISABLE ROW LEVEL SECURITY;

-- Drop indexes
DROP INDEX IF EXISTS idx_connections_relationship_state;
DROP INDEX IF EXISTS idx_connections_strength;
DROP INDEX IF EXISTS idx_connections_saved_a;
DROP INDEX IF EXISTS idx_connections_saved_b;
DROP INDEX IF EXISTS idx_connections_rounds;
DROP INDEX IF EXISTS idx_connections_last_interaction;
DROP INDEX IF EXISTS idx_saved_members_saver;
DROP INDEX IF EXISTS idx_saved_members_saved;
DROP INDEX IF EXISTS idx_saved_members_tier;
DROP INDEX IF EXISTS idx_saved_members_tags;
DROP INDEX IF EXISTS idx_introductions_requester;
DROP INDEX IF EXISTS idx_introductions_target;
DROP INDEX IF EXISTS idx_introductions_connector;
DROP INDEX IF EXISTS idx_introductions_status;
DROP INDEX IF EXISTS idx_introductions_expires;

-- Remove realtime
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.saved_members;
    ALTER PUBLICATION supabase_realtime DROP TABLE public.introductions;
  END IF;
END $$;

-- Drop tables
DROP TABLE IF EXISTS public.introductions;
DROP TABLE IF EXISTS public.saved_members;

-- Remove columns from user_connections
ALTER TABLE public.user_connections
  DROP COLUMN IF EXISTS relationship_state,
  DROP COLUMN IF EXISTS strength_score,
  DROP COLUMN IF EXISTS saved_by_user_a,
  DROP COLUMN IF EXISTS saved_by_user_b,
  DROP COLUMN IF EXISTS rounds_count,
  DROP COLUMN IF EXISTS last_interaction_at;

-- Drop enum
DROP TYPE IF EXISTS public.relationship_state;
*/
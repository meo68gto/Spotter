-- ============================================================================
-- Epic 4 Finalization: Network Connection State Machine Updates
-- Adds trigger to update connection states when rounds complete
-- ============================================================================

-- ============================================
-- UP MIGRATION
-- ============================================

-- 1. Create function to update network connections after round completion
CREATE OR REPLACE FUNCTION public.update_network_connection_on_round()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_round_id uuid;
  v_participants uuid[];
  v_user_a uuid;
  v_user_b uuid;
  v_connection_id uuid;
  v_current_state text;
  v_rounds_count integer;
  v_connection_exists boolean;
BEGIN
  v_round_id := NEW.round_id;
  
  -- Get all participants in this round
  SELECT ARRAY_AGG(user_id) INTO v_participants
  FROM public.round_participants_v2
  WHERE round_id = v_round_id;
  
  -- No participants or only one - nothing to update
  IF v_participants IS NULL OR array_length(v_participants, 1) < 2 THEN
    RETURN NEW;
  END IF;
  
  -- Check all pairs of participants
  FOR i IN 1..array_length(v_participants, 1) LOOP
    FOR j IN (i+1)..array_length(v_participants, 1) LOOP
      v_user_a := v_participants[i];
      v_user_b := v_participants[j];
      
      -- Check if connection exists
      SELECT id, relationship_state, rounds_count INTO v_connection_id, v_current_state, v_rounds_count
      FROM public.user_connections
      WHERE (requester_id = v_user_a AND addressee_id = v_user_b)
         OR (requester_id = v_user_b AND addressee_id = v_user_a);
      
      IF v_connection_id IS NOT NULL THEN
        -- Update connection based on current state and rounds count
        -- invited → played_together (after 1 round)
        -- played_together → regular_partner (after 3 rounds)
        
        IF v_current_state = 'invited' AND v_rounds_count IS NULL THEN
          -- First round together
          UPDATE public.user_connections
          SET 
            relationship_state = 'played_together',
            rounds_count = 1,
            last_interaction_at = now(),
            strength_score = LEAST(strength_score + 25, 100),
            updated_at = now()
          WHERE id = v_connection_id;
          
        ELSIF v_current_state IN ('invited', 'played_together') THEN
          -- Additional rounds - increment and check for promotion
          UPDATE public.user_connections
          SET 
            rounds_count = COALESCE(rounds_count, 0) + 1,
            relationship_state = CASE 
              WHEN COALESCE(rounds_count, 0) + 1 >= 3 THEN 'regular_partner'
              ELSE 'played_together'
            END,
            last_interaction_at = now(),
            strength_score = LEAST(strength_score + 15, 100),
            updated_at = now()
          WHERE id = v_connection_id;
          
        ELSIF v_current_state = 'regular_partner' THEN
          -- Already regular partners - just update stats
          UPDATE public.user_connections
          SET 
            rounds_count = COALESCE(rounds_count, 0) + 1,
            last_interaction_at = now(),
            strength_score = LEAST(strength_score + 10, 100),
            updated_at = now()
          WHERE id = v_connection_id;
        END IF;
        
        -- Log the update for debugging
        INSERT INTO public.connection_state_history (
          connection_id,
          from_state,
          to_state,
          triggered_by_event,
          metadata
        )
        SELECT 
          v_connection_id,
          v_current_state,
          relationship_state,
          'round_completed',
          jsonb_build_object('round_id', v_round_id, 'rater_id', NEW.rater_id)
        FROM public.user_connections
        WHERE id = v_connection_id;
      END IF;
    END LOOP;
  END LOOP;
  
  RETURN NEW;
END;
$$;

-- Apply trigger on round_ratings insert (indicates round is being rated = completed)
-- This ensures we update connections when participants rate each other
CREATE TRIGGER trg_update_network_connection_on_round
  AFTER INSERT ON public.round_ratings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_network_connection_on_round();

-- 2. Create connection_state_history table for audit trail
CREATE TABLE IF NOT EXISTS public.connection_state_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID REFERENCES public.user_connections(id) ON DELETE CASCADE,
  from_state TEXT,
  to_state TEXT,
  triggered_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  triggered_by_event TEXT, -- 'round_completed', 'manual', 'timeout', etc.
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.connection_state_history ENABLE ROW LEVEL SECURITY;

-- Only system/service roles can insert
CREATE POLICY connection_state_history_system_only ON public.connection_state_history
  FOR ALL USING (false);

-- 3. Create function to expire stale introduction requests (48h timeout)
CREATE OR REPLACE FUNCTION public.expire_stale_introductions()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  -- Update expired pending introductions
  UPDATE public.introduction_requests
  SET 
    status = 'expired',
    updated_at = now()
  WHERE status = 'pending'
    AND expires_at < now();
  
  GET DIAGNOSTICS v_count = ROW_COUNT;
  
  -- Log expired introductions
  INSERT INTO public.connection_state_history (
    connection_id,
    from_state,
    to_state,
    triggered_by_event,
    metadata
  )
  SELECT 
    NULL,
    'invited',
    'expired',
    'timeout',
    jsonb_build_object('intro_id', id, 'requester_id', requester_id)
  FROM public.introduction_requests
  WHERE status = 'expired'
    AND updated_at > now() - interval '1 minute';
  
  RETURN v_count;
END;
$$;

-- 4. Create index for connection state history
CREATE INDEX IF NOT EXISTS idx_connection_state_history_connection ON public.connection_state_history(connection_id);
CREATE INDEX IF NOT EXISTS idx_connection_state_history_created ON public.connection_state_history(created_at DESC);

-- 5. Add comments
COMMENT ON FUNCTION public.update_network_connection_on_round() IS 'Updates network connection state when rounds complete. Handles invited→played_together→regular_partner transitions.';
COMMENT ON TABLE public.connection_state_history IS 'Audit trail for connection state changes. System-managed.';
COMMENT ON FUNCTION public.expire_stale_introductions() IS 'Expires introduction requests older than 48h. Called by cron job.';

-- 6. Verify the state machine is correctly configured
DO $$
DECLARE
  v_valid_transitions jsonb;
BEGIN
  -- Build valid transitions JSON for documentation
  v_valid_transitions := jsonb_build_object(
    'matched', jsonb_build_array('invited'),
    'invited', jsonb_build_array('played_together', 'matched'),
    'played_together', jsonb_build_array('regular_partner', 'invited'),
    'regular_partner', jsonb_build_array('played_together')
  );
  
  -- Log to PostgreSQL log (no-op, just for verification)
  RAISE NOTICE 'Connection state machine configured with valid transitions: %', v_valid_transitions;
END $$;

-- ============================================
-- DOWN MIGRATION
-- ============================================
/*
-- Remove trigger
DROP TRIGGER IF EXISTS trg_update_network_connection_on_round ON public.round_ratings;

-- Remove functions
DROP FUNCTION IF EXISTS public.update_network_connection_on_round();
DROP FUNCTION IF EXISTS public.expire_stale_introductions();

-- Remove policies
DROP POLICY IF EXISTS connection_state_history_system_only ON public.connection_state_history;

-- Remove table
DROP TABLE IF EXISTS public.connection_state_history;
*/

-- ============================================================================
-- Phase 2 Migration: Round Coordination & Scheduling System
-- Creates tables for foursome coordination with same-tier enforcement
-- ============================================================================

-- ============================================
-- UP MIGRATION
-- ============================================

-- 1. Create cart_preference enum if not exists (from Phase 1)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'cart_preference') THEN
    CREATE TYPE public.cart_preference AS ENUM ('walking', 'cart', 'either');
  END IF;
END $$;

-- 2. Create round_status enum
CREATE TYPE public.round_status AS ENUM (
  'draft',           -- Round being created
  'open',            -- Accepting participants
  'full',            -- Max players reached
  'confirmed',       -- All spots filled, ready to play
  'in_progress',     -- Round is happening now
  'completed',       -- Round finished
  'cancelled'        -- Round cancelled by creator
);

-- 3. Create invitation_status enum
CREATE TYPE public.invitation_status AS ENUM (
  'pending',         -- Awaiting response
  'accepted',        -- User accepted invite
  'declined',        -- User declined invite
  'expired'          -- Invite expired
);

-- 4. Create rounds table (foursome coordination)
CREATE TABLE IF NOT EXISTS public.rounds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Creator/organizer reference
  creator_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  
  -- Course reference
  course_id uuid NOT NULL REFERENCES public.golf_courses(id) ON DELETE RESTRICT,
  
  -- Scheduling
  scheduled_at timestamptz NOT NULL,  -- Full datetime of the round
  
  -- Round configuration
  max_players integer NOT NULL DEFAULT 4 CHECK (max_players IN (2, 3, 4)),
  cart_preference public.cart_preference NOT NULL DEFAULT 'either',
  
  -- Same-tier enforcement
  tier_id uuid NOT NULL REFERENCES public.membership_tiers(id) ON DELETE RESTRICT,
  
  -- Status tracking
  status public.round_status NOT NULL DEFAULT 'draft',
  
  -- Optional fields
  notes text CHECK (char_length(notes) <= 500),
  
  -- Timestamps
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 5. Create round_invitations table
CREATE TABLE IF NOT EXISTS public.round_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Round reference
  round_id uuid NOT NULL REFERENCES public.rounds(id) ON DELETE CASCADE,
  
  -- Invitee reference
  invitee_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  
  -- Status tracking
  status public.invitation_status NOT NULL DEFAULT 'pending',
  
  -- Optional message from inviter
  message text CHECK (char_length(message) <= 280),
  
  -- Timestamps
  invited_at timestamptz NOT NULL DEFAULT now(),
  responded_at timestamptz,
  
  -- Constraints
  UNIQUE(round_id, invitee_id)
);

-- 6. Create round_participants table (for confirmed participants)
CREATE TABLE IF NOT EXISTS public.round_participants_v2 (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Round reference
  round_id uuid NOT NULL REFERENCES public.rounds(id) ON DELETE CASCADE,
  
  -- Participant reference
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  
  -- Role in the round
  is_creator boolean NOT NULL DEFAULT false,
  
  -- Join tracking
  joined_at timestamptz NOT NULL DEFAULT now(),
  
  -- Constraints
  UNIQUE(round_id, user_id)
);

-- 7. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_rounds_creator ON public.rounds(creator_id);
CREATE INDEX IF NOT EXISTS idx_rounds_course ON public.rounds(course_id);
CREATE INDEX IF NOT EXISTS idx_rounds_scheduled ON public.rounds(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_rounds_status ON public.rounds(status);
CREATE INDEX IF NOT EXISTS idx_rounds_tier ON public.rounds(tier_id);
CREATE INDEX IF NOT EXISTS idx_rounds_creator_status ON public.rounds(creator_id, status);

CREATE INDEX IF NOT EXISTS idx_invitations_round ON public.round_invitations(round_id);
CREATE INDEX IF NOT EXISTS idx_invitations_invitee ON public.round_invitations(invitee_id);
CREATE INDEX IF NOT EXISTS idx_invitations_status ON public.round_invitations(status);
CREATE INDEX IF NOT EXISTS idx_invitations_pending ON public.round_invitations(invitee_id, status) 
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_participants_v2_round ON public.round_participants_v2(round_id);
CREATE INDEX IF NOT EXISTS idx_participants_v2_user ON public.round_participants_v2(user_id);

-- 8. Enable RLS on all new tables
ALTER TABLE public.rounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.round_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.round_participants_v2 ENABLE ROW LEVEL SECURITY;

-- 9. RLS Policies for rounds table

-- Users can see rounds:
-- 1. They created
-- 2. They are invited to
-- 3. That are open and in their tier
CREATE POLICY rounds_select_visible ON public.rounds
  FOR SELECT USING (
    -- User is the creator
    auth.uid() = creator_id
    -- OR user has a pending/accepted invitation
    OR EXISTS (
      SELECT 1 FROM public.round_invitations ri
      WHERE ri.round_id = rounds.id
        AND ri.invitee_id = auth.uid()
        AND ri.status IN ('pending', 'accepted')
    )
    -- OR user is a confirmed participant
    OR EXISTS (
      SELECT 1 FROM public.round_participants_v2 rp
      WHERE rp.round_id = rounds.id
        AND rp.user_id = auth.uid()
    )
    -- OR round is open and in user's tier
    OR (
      status IN ('open', 'full', 'confirmed')
      AND tier_id = (
        SELECT tier_id FROM public.users WHERE id = auth.uid()
      )
    )
  );

-- Users can create rounds (tier check handled in application)
CREATE POLICY rounds_insert_creator ON public.rounds
  FOR INSERT WITH CHECK (auth.uid() = creator_id);

-- Only creator can update their rounds
CREATE POLICY rounds_update_creator ON public.rounds
  FOR UPDATE USING (auth.uid() = creator_id) WITH CHECK (auth.uid() = creator_id);

-- Only creator can delete rounds (if not in progress/completed)
CREATE POLICY rounds_delete_creator ON public.rounds
  FOR DELETE USING (
    auth.uid() = creator_id 
    AND status NOT IN ('in_progress', 'completed')
  );

-- 10. RLS Policies for round_invitations table

-- Users can see invitations they sent or received
CREATE POLICY invitations_select_involved ON public.round_invitations
  FOR SELECT USING (
    -- User is the invitee
    auth.uid() = invitee_id
    -- OR user is the round creator (can see all invites for their rounds)
    OR EXISTS (
      SELECT 1 FROM public.rounds r
      WHERE r.id = round_invitations.round_id
        AND r.creator_id = auth.uid()
    )
  );

-- Only round creator can send invitations
CREATE POLICY invitations_insert_creator ON public.round_invitations
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.rounds r
      WHERE r.id = round_invitations.round_id
        AND r.creator_id = auth.uid()
    )
  );

-- Invitee can update their own invitation (accept/decline)
-- Creator can update any invitation for their rounds
CREATE POLICY invitations_update_involved ON public.round_invitations
  FOR UPDATE USING (
    auth.uid() = invitee_id
    OR EXISTS (
      SELECT 1 FROM public.rounds r
      WHERE r.id = round_invitations.round_id
        AND r.creator_id = auth.uid()
    )
  ) WITH CHECK (
    auth.uid() = invitee_id
    OR EXISTS (
      SELECT 1 FROM public.rounds r
      WHERE r.id = round_invitations.round_id
        AND r.creator_id = auth.uid()
    )
  );

-- Only creator can delete invitations for their rounds
CREATE POLICY invitations_delete_creator ON public.round_invitations
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.rounds r
      WHERE r.id = round_invitations.round_id
        AND r.creator_id = auth.uid()
    )
  );

-- 11. RLS Policies for round_participants_v2 table

-- Users can see participants in rounds they are part of
CREATE POLICY participants_v2_select_visible ON public.round_participants_v2
  FOR SELECT USING (
    -- User is a participant
    auth.uid() = user_id
    -- OR user is in the same round
    OR EXISTS (
      SELECT 1 FROM public.round_participants_v2 rp
      WHERE rp.round_id = round_participants_v2.round_id
        AND rp.user_id = auth.uid()
    )
    -- OR user is the round creator
    OR EXISTS (
      SELECT 1 FROM public.rounds r
      WHERE r.id = round_participants_v2.round_id
        AND r.creator_id = auth.uid()
    )
  );

-- Insert handled by trigger/function
CREATE POLICY participants_v2_insert_system ON public.round_participants_v2
  FOR INSERT WITH CHECK (false);

-- Only creator can update participants
CREATE POLICY participants_v2_update_creator ON public.round_participants_v2
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.rounds r
      WHERE r.id = round_participants_v2.round_id
        AND r.creator_id = auth.uid()
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.rounds r
      WHERE r.id = round_participants_v2.round_id
        AND r.creator_id = auth.uid()
    )
  );

-- Only creator can remove participants
CREATE POLICY participants_v2_delete_creator ON public.round_participants_v2
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.rounds r
      WHERE r.id = round_participants_v2.round_id
        AND r.creator_id = auth.uid()
    )
  );

-- 12. Create function to auto-add creator as participant
CREATE OR REPLACE FUNCTION public.add_creator_as_participant()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Insert creator as participant
  INSERT INTO public.round_participants_v2 (round_id, user_id, is_creator, joined_at)
  VALUES (NEW.id, NEW.creator_id, true, now());
  
  RETURN NEW;
END;
$$;

-- Apply trigger to rounds
CREATE TRIGGER trg_add_creator_as_participant
  AFTER INSERT ON public.rounds
  FOR EACH ROW
  EXECUTE FUNCTION public.add_creator_as_participant();

-- 13. Create function to update round status based on participant count
CREATE OR REPLACE FUNCTION public.update_round_status_on_participants()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  participant_count integer;
  max_players integer;
  current_status public.round_status;
BEGIN
  -- Get current round info
  SELECT r.max_players, r.status INTO max_players, current_status
  FROM public.rounds r
  WHERE r.id = COALESCE(NEW.round_id, OLD.round_id);
  
  -- Count confirmed participants
  SELECT COUNT(*) INTO participant_count
  FROM public.round_participants_v2
  WHERE round_id = COALESCE(NEW.round_id, OLD.round_id);
  
  -- Update status based on participant count
  IF participant_count >= max_players AND current_status = 'open' THEN
    UPDATE public.rounds
    SET status = 'full'
    WHERE id = COALESCE(NEW.round_id, OLD.round_id);
  ELSIF participant_count < max_players AND current_status = 'full' THEN
    UPDATE public.rounds
    SET status = 'open'
    WHERE id = COALESCE(NEW.round_id, OLD.round_id);
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Apply trigger to round_participants_v2
CREATE TRIGGER trg_update_round_status_on_participants
  AFTER INSERT OR DELETE ON public.round_participants_v2
  FOR EACH ROW
  EXECUTE FUNCTION public.update_round_status_on_participants();

-- 14. Create function to add participant when invitation is accepted
CREATE OR REPLACE FUNCTION public.add_participant_on_invite_accept()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only proceed if status changed to accepted
  IF NEW.status = 'accepted' AND (OLD.status IS NULL OR OLD.status != 'accepted') THEN
    -- Check if participant already exists
    IF NOT EXISTS (
      SELECT 1 FROM public.round_participants_v2
      WHERE round_id = NEW.round_id AND user_id = NEW.invitee_id
    ) THEN
      -- Add as participant
      INSERT INTO public.round_participants_v2 (round_id, user_id, is_creator, joined_at)
      VALUES (NEW.round_id, NEW.invitee_id, false, now());
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Apply trigger to round_invitations
CREATE TRIGGER trg_add_participant_on_invite_accept
  AFTER UPDATE OF status ON public.round_invitations
  FOR EACH ROW
  WHEN (NEW.status = 'accepted')
  EXECUTE FUNCTION public.add_participant_on_invite_accept();

-- 15. Create updated_at triggers
CREATE TRIGGER trg_rounds_updated_at
  BEFORE UPDATE ON public.rounds
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_round_invitations_updated_at
  BEFORE UPDATE ON public.round_invitations
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- 16. Add realtime publication
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.rounds;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.round_invitations;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.round_participants_v2;
  END IF;
END $$;

-- 17. Create view for round details with participant counts
CREATE OR REPLACE VIEW public.round_details AS
SELECT 
  r.id,
  r.creator_id,
  r.course_id,
  gc.name as course_name,
  gc.city as course_city,
  gc.state as course_state,
  r.scheduled_at,
  r.max_players,
  r.cart_preference,
  r.tier_id,
  mt.slug as tier_slug,
  r.status,
  r.notes,
  r.created_at,
  r.updated_at,
  COUNT(rp.id) as confirmed_participants
FROM public.rounds r
JOIN public.golf_courses gc ON gc.id = r.course_id
JOIN public.membership_tiers mt ON mt.id = r.tier_id
LEFT JOIN public.round_participants_v2 rp ON rp.round_id = r.id
GROUP BY r.id, gc.name, gc.city, gc.state, mt.slug;

-- 18. Add comments for documentation
COMMENT ON TABLE public.rounds IS 'Golf rounds/foursomes with same-tier enforcement. Creator is auto-added as participant.';
COMMENT ON TABLE public.round_invitations IS 'Invitations to join rounds. Accepting adds user to round_participants_v2.';
COMMENT ON TABLE public.round_participants_v2 IS 'Confirmed participants in rounds. Separate from invitations for clear state management.';

-- ============================================
-- DOWN MIGRATION (for reference)
-- ============================================
/*
-- Remove triggers
DROP TRIGGER IF EXISTS trg_add_creator_as_participant ON public.rounds;
DROP TRIGGER IF EXISTS trg_update_round_status_on_participants ON public.round_participants_v2;
DROP TRIGGER IF EXISTS trg_add_participant_on_invite_accept ON public.round_invitations;
DROP TRIGGER IF EXISTS trg_rounds_updated_at ON public.rounds;
DROP TRIGGER IF EXISTS trg_round_invitations_updated_at ON public.round_invitations;

-- Remove functions
DROP FUNCTION IF EXISTS public.add_creator_as_participant();
DROP FUNCTION IF EXISTS public.update_round_status_on_participants();
DROP FUNCTION IF EXISTS public.add_participant_on_invite_accept();

-- Remove view
DROP VIEW IF EXISTS public.round_details;

-- Remove RLS policies
DROP POLICY IF EXISTS rounds_select_visible ON public.rounds;
DROP POLICY IF EXISTS rounds_insert_creator ON public.rounds;
DROP POLICY IF EXISTS rounds_update_creator ON public.rounds;
DROP POLICY IF EXISTS rounds_delete_creator ON public.rounds;

DROP POLICY IF EXISTS invitations_select_involved ON public.round_invitations;
DROP POLICY IF EXISTS invitations_insert_creator ON public.round_invitations;
DROP POLICY IF EXISTS invitations_update_involved ON public.round_invitations;
DROP POLICY IF EXISTS invitations_delete_creator ON public.round_invitations;

DROP POLICY IF EXISTS participants_v2_select_visible ON public.round_participants_v2;
DROP POLICY IF EXISTS participants_v2_insert_system ON public.round_participants_v2;
DROP POLICY IF EXISTS participants_v2_update_creator ON public.round_participants_v2;
DROP POLICY IF EXISTS participants_v2_delete_creator ON public.round_participants_v2;

-- Disable RLS
ALTER TABLE public.rounds DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.round_invitations DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.round_participants_v2 DISABLE ROW LEVEL SECURITY;

-- Remove indexes
DROP INDEX IF EXISTS idx_rounds_creator;
DROP INDEX IF EXISTS idx_rounds_course;
DROP INDEX IF EXISTS idx_rounds_scheduled;
DROP INDEX IF EXISTS idx_rounds_status;
DROP INDEX IF EXISTS idx_rounds_tier;
DROP INDEX IF EXISTS idx_rounds_creator_status;
DROP INDEX IF EXISTS idx_invitations_round;
DROP INDEX IF EXISTS idx_invitations_invitee;
DROP INDEX IF EXISTS idx_invitations_status;
DROP INDEX IF EXISTS idx_invitations_pending;
DROP INDEX IF EXISTS idx_participants_v2_round;
DROP INDEX IF EXISTS idx_participants_v2_user;

-- Remove realtime publication
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.rounds;
    ALTER PUBLICATION supabase_realtime DROP TABLE public.round_invitations;
    ALTER PUBLICATION supabase_realtime DROP TABLE public.round_participants_v2;
  END IF;
END $$;

-- Drop tables
DROP TABLE IF EXISTS public.round_participants_v2;
DROP TABLE IF EXISTS public.round_invitations;
DROP TABLE IF EXISTS public.rounds;

-- Drop enums
DROP TYPE IF EXISTS public.round_status;
DROP TYPE IF EXISTS public.invitation_status;
*/

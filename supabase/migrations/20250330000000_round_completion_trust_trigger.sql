-- Migration: Round Completion Trust Trigger
-- GAP 3: When a round transitions to 'played', recalculate reliability for all participants.
-- Also fires on review_pending / reviewed transitions so badges trigger promptly.

-- ============================================
-- UP MIGRATION
-- ============================================

-- Function: recalculate reliability for all participants when a round completes
CREATE OR REPLACE FUNCTION public.fn_recalculate_reliability_on_round_complete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Update rounds_completed and last_calc timestamp for all participants
  UPDATE public.user_reputation AS ur
  SET
    rounds_completed = rounds_completed + 1,
    last_reliability_calc_at = NOW(),
    updated_at = NOW()
  WHERE ur.user_id IN (
    SELECT rp.user_id
    FROM public.round_participants_v2 AS rp
    WHERE rp.round_id = NEW.id
      AND rp.status = 'checked_in'  -- only count those who actually showed
  );

  RETURN NEW;
END;
$$;

-- Drop existing trigger to allow CREATE OR REPLACE
DROP TRIGGER IF EXISTS trg_round_completion_reliability ON public.rounds;

-- Fire when lifecycle_status transitions to a terminal/review state
CREATE TRIGGER trg_round_completion_reliability
  AFTER UPDATE OF lifecycle_status ON public.rounds
  FOR EACH ROW
  WHEN (
    OLD.lifecycle_status IS DISTINCT FROM NEW.lifecycle_status
    AND NEW.lifecycle_status IN ('played', 'review_pending', 'reviewed')
  )
  EXECUTE FUNCTION public.fn_recalculate_reliability_on_round_complete();

-- ============================================
-- DOWN MIGRATION
-- ============================================
/*
DROP TRIGGER IF EXISTS trg_round_completion_reliability ON public.rounds;
DROP FUNCTION IF EXISTS public.fn_recalculate_reliability_on_round_complete();
*/

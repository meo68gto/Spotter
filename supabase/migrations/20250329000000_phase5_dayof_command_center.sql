-- ============================================================================
-- Fox Phase 5A: Day-of Command Center
-- Tables: broadcast_history
-- ============================================================================

-- ============================================
-- UP MIGRATION
-- ============================================

CREATE TABLE IF NOT EXISTS public.broadcast_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id uuid NOT NULL REFERENCES public.organizer_events(id) ON DELETE CASCADE,
  organizer_id uuid NOT NULL,
  subject text NOT NULL,
  body text NOT NULL,
  recipient_count integer NOT NULL DEFAULT 0,
  successful_count integer NOT NULL DEFAULT 0,
  failed_count integer NOT NULL DEFAULT 0,
  errors text,
  sent_at timestamptz NOT NULL DEFAULT now()
);

-- Index for fast lookups by tournament
CREATE INDEX IF NOT EXISTS idx_broadcast_history_tournament_id
  ON public.broadcast_history(tournament_id);

-- Index for organizer-level queries
CREATE INDEX IF NOT EXISTS idx_broadcast_history_organizer_id
  ON public.broadcast_history(organizer_id);

-- RLS
ALTER TABLE public.broadcast_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Operators can manage their own broadcast history"
  ON public.broadcast_history
  FOR ALL
  USING (organizer_id = current_setting('app.organizer_id', true)::uuid)
  WITH CHECK (organizer_id = current_setting('app.organizer_id', true)::uuid);

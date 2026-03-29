-- ============================================================================
-- Fox Phase 0: Tournament Round Format Support
-- Adds: format enum, team_size, is_tournament to rounds table
-- ============================================================================

-- ============================================
-- UP MIGRATION
-- ============================================

-- 1. Create round_format enum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'round_format') THEN
    CREATE TYPE public.round_format AS ENUM (
      'individual',
      'scramble',
      'modified_scramble',
      'best_ball',
      'stableford',
      'match_play'
    );
  END IF;
END $$;

-- 2. Add tournament fields to rounds table
ALTER TABLE public.rounds
  ADD COLUMN IF NOT EXISTS format public.round_format DEFAULT 'individual',
  ADD COLUMN IF NOT EXISTS team_size integer DEFAULT 4 CHECK (team_size IS NULL OR (team_size >= 1 AND team_size <= 4)),
  ADD COLUMN IF NOT EXISTS is_tournament boolean DEFAULT false;

-- ============================================
-- DOWN MIGRATION
-- ============================================

ALTER TABLE public.rounds
  DROP COLUMN IF EXISTS format,
  DROP COLUMN IF EXISTS team_size,
  DROP COLUMN IF EXISTS is_tournament;

DROP TYPE IF EXISTS public.round_format;

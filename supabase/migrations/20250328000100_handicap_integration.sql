-- ============================================================================
-- Fox Phase 0: Handicap Integration
-- Adds: handicap_index, ghin_number to user_golf_identities
-- Extends range: handicap_index range from -10 to 54 (one decimal)
-- ============================================================================

-- ============================================
-- UP MIGRATION
-- ============================================

-- 1. Add handicap_index (replacing narrow -5/+54 range with correct -10/+54)
-- First drop the old check constraint, then re-add with correct range
ALTER TABLE public.user_golf_identities
  DROP CONSTRAINT IF EXISTS user_golf_identities_handicap_check;

ALTER TABLE public.user_golf_identities
  ADD COLUMN IF NOT EXISTS handicap_index numeric(4, 1);

-- Copy existing handicap values to handicap_index
UPDATE public.user_golf_identities
SET handicap_index = handicap
WHERE handicap IS NOT NULL;

-- Apply correct constraint: range -10 to 54
ALTER TABLE public.user_golf_identities
  ADD CONSTRAINT user_golf_identities_handicap_index_check
  CHECK (handicap_index IS NULL OR (handicap_index >= -10 AND handicap_index <= 54));

-- Keep old handicap column for backwards compat but let it expire via deprecation
-- (already has its own check -5 to 54; we won't update it going forward)

-- 2. Add ghin_number column
ALTER TABLE public.user_golf_identities
  ADD COLUMN IF NOT EXISTS ghin_number text;

-- ============================================
-- DOWN MIGRATION
-- ============================================

ALTER TABLE public.user_golf_identities
  DROP COLUMN IF EXISTS handicap_index,
  DROP COLUMN IF EXISTS ghin_number;

ALTER TABLE public.user_golf_identities
  ADD CONSTRAINT user_golf_identities_handicap_check
  CHECK (handicap IS NULL OR (handicap >= -5 AND handicap <= 54));

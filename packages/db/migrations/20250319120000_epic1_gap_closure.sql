-- ============================================================================
-- Epic 1 Gap Closure: Add Missing Premium Member Identity Fields
-- ============================================================================
-- This migration adds the missing columns identified during Epic 1 audit
-- All 12 fields must be persisted for premium member onboarding
-- ============================================================================

-- ============================================
-- UP MIGRATION
-- ============================================

-- 1. Add missing columns to user_golf_identities table
ALTER TABLE public.user_golf_identities
  ADD COLUMN IF NOT EXISTS handicap_band public.handicap_band,
  ADD COLUMN IF NOT EXISTS home_course_area text,
  ADD COLUMN IF NOT EXISTS preferred_tee_times public.tee_time_preference[] DEFAULT '{}';

-- 2. Add missing columns to user_networking_preferences table
ALTER TABLE public.user_networking_preferences
  ADD COLUMN IF NOT EXISTS preferred_tee_time_window public.tee_time_preference,
  ADD COLUMN IF NOT EXISTS round_frequency public.round_frequency,
  ADD COLUMN IF NOT EXISTS mobility_preference public.mobility_preference DEFAULT 'either',
  ADD COLUMN IF NOT EXISTS industry text,
  ADD COLUMN IF NOT EXISTS company text,
  ADD COLUMN IF NOT EXISTS title_or_role text;

-- 3. Create indexes for new fields
CREATE INDEX IF NOT EXISTS idx_networking_prefs_tee_time 
  ON public.user_networking_preferences(preferred_tee_time_window) 
  WHERE preferred_tee_time_window IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_networking_prefs_round_freq 
  ON public.user_networking_preferences(round_frequency) 
  WHERE round_frequency IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_golf_identities_handicap_band 
  ON public.user_golf_identities(handicap_band) 
  WHERE handicap_band IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_golf_identities_home_course_area 
  ON public.user_golf_identities(home_course_area) 
  WHERE home_course_area IS NOT NULL;

-- 4. Create helper function to derive handicap_band from numeric handicap
CREATE OR REPLACE FUNCTION public.calculate_handicap_band(p_handicap numeric)
RETURNS public.handicap_band AS $$
BEGIN
  IF p_handicap IS NULL THEN
    RETURN NULL;
  END IF;
  IF p_handicap >= 25 THEN
    RETURN 'beginner';
  ELSIF p_handicap >= 10 THEN
    RETURN 'intermediate';
  ELSIF p_handicap >= 0 THEN
    RETURN 'advanced';
  ELSE
    RETURN 'expert';
  END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 5. Create trigger to auto-update handicap_band when handicap changes
CREATE OR REPLACE FUNCTION public.sync_handicap_band()
RETURNS TRIGGER AS $$
BEGIN
  NEW.handicap_band := public.calculate_handicap_band(NEW.handicap);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_handicap_band ON public.user_golf_identities;
CREATE TRIGGER trg_sync_handicap_band
  BEFORE INSERT OR UPDATE ON public.user_golf_identities
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_handicap_band();

-- 6. Backfill existing data
-- Set handicap_band for existing records
UPDATE public.user_golf_identities
SET handicap_band = public.calculate_handicap_band(handicap)
WHERE handicap_band IS NULL AND handicap IS NOT NULL;

-- Copy play_frequency to round_frequency where applicable
UPDATE public.user_networking_preferences np
SET round_frequency = CASE 
  WHEN ugi.play_frequency = 'weekly' THEN 'weekly'::public.round_frequency
  WHEN ugi.play_frequency = 'biweekly' THEN 'biweekly'::public.round_frequency  
  WHEN ugi.play_frequency = 'monthly' THEN 'monthly'::public.round_frequency
  WHEN ugi.play_frequency = 'occasionally' THEN 'occasionally'::public.round_frequency
  ELSE 'weekly'::public.round_frequency
END
FROM public.user_golf_identities ugi
WHERE np.user_id = ugi.user_id
  AND np.round_frequency IS NULL;

-- 7. Update comments for documentation
COMMENT ON TABLE public.user_networking_preferences IS 
'Epic 1: Networking and round preferences for tiered golf platform.
Required fields: networking_intent, open_to_intros, open_to_recurring_rounds, preferred_group_size, mobility_preference, round_frequency
Optional: preferred_tee_time_window, preferred_golf_area, networking_notes, industry, company, title_or_role';

COMMENT ON TABLE public.user_golf_identities IS 
'Epic 1: Golf identity and skill information.
Required fields: handicap_band
Optional: handicap (numeric), home_course_id, home_course_area, play_frequency, preferred_tee_times, years_playing';

-- ============================================
-- DOWN MIGRATION
-- ============================================
/*
-- Remove trigger
DROP TRIGGER IF EXISTS trg_sync_handicap_band ON public.user_golf_identities;
DROP FUNCTION IF EXISTS public.sync_handicap_band();
DROP FUNCTION IF EXISTS public.calculate_handicap_band();

-- Remove columns
ALTER TABLE public.user_networking_preferences
  DROP COLUMN IF EXISTS preferred_tee_time_window,
  DROP COLUMN IF EXISTS round_frequency,
  DROP COLUMN IF EXISTS mobility_preference,
  DROP COLUMN IF EXISTS industry,
  DROP COLUMN IF EXISTS company,
  DROP COLUMN IF EXISTS title_or_role;

ALTER TABLE public.user_golf_identities
  DROP COLUMN IF EXISTS handicap_band,
  DROP COLUMN IF EXISTS home_course_area,
  DROP COLUMN IF EXISTS preferred_tee_times;

-- Drop indexes
DROP INDEX IF EXISTS idx_networking_prefs_tee_time;
DROP INDEX IF EXISTS idx_networking_prefs_round_freq;
DROP INDEX IF EXISTS idx_golf_identities_handicap_band;
DROP INDEX IF EXISTS idx_golf_identities_home_course_area;
*/

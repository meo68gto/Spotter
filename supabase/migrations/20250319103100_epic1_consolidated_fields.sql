-- ============================================================================
-- Epic 1 Consolidated Migration: Missing Fields for Tiered Member Foundation
-- ============================================================================
-- Adds missing fields identified during Epic 1 quality review:
-- 1. preferred_tee_time_window (for networking preferences)
-- 2. round_frequency (for networking preferences)  
-- 3. handicap_band (for golf identity)
-- 4. home_course_area (alternative to home_course_id)
-- 5. title_or_role (standardized - aligns TS 'role' with DB 'title')
-- ============================================================================

-- ============================================
-- UP MIGRATION
-- ============================================

-- 1. Add preferred_tee_time enum type
CREATE TYPE public.tee_time_preference AS ENUM (
  'early_bird',    -- Before 9am
  'mid_morning',   -- 9am-12pm
  'afternoon',     -- 12pm-4pm
  'twilight',      -- After 4pm
  'weekends_only', -- Weekends only
  'flexible'       -- No preference
);

-- 2. Add round_frequency enum type
CREATE TYPE public.round_frequency AS ENUM (
  'multiple_per_week', -- 2+ times per week
  'weekly',            -- Once per week
  'biweekly',          -- Every 2 weeks
  'monthly',           -- Once per month
  'occasionally',      -- A few times per year
  'rarely'             -- Once or twice per year
);

-- 3. Add handicap_band enum type
CREATE TYPE public.handicap_band AS ENUM (
  'beginner',      -- 25+ handicap
  'intermediate',    -- 10-24 handicap
  'advanced',        -- 0-9 handicap
  'expert'           -- Pro/scratch (0 or negative)
);

-- 4. Add mobility_preference enum type (enhanced cart preference)
CREATE TYPE public.mobility_preference AS ENUM (
  'walking',         -- Strictly walking only
  'walking_preferred',-- Prefer walking but cart OK
  'cart',            -- Strictly cart only
  'cart_preferred',  -- Prefer cart but walking OK
  'either'           -- No preference
);

-- 5. Update user_networking_preferences table
ALTER TABLE public.user_networking_preferences
  -- Add preferred tee time window
  ADD COLUMN IF NOT EXISTS preferred_tee_time_window public.tee_time_preference,
  -- Add round frequency
  ADD COLUMN IF NOT EXISTS round_frequency public.round_frequency,
  -- Add mobility preference (more descriptive than cart_preference)
  ADD COLUMN IF NOT EXISTS mobility_preference public.mobility_preference DEFAULT 'either',
  -- Ensure networking_intent is NOT NULL for data integrity
  ALTER COLUMN networking_intent SET NOT NULL;

-- 6. Update user_golf_identities table  
-- Add columns first
ALTER TABLE public.user_golf_identities
  ADD COLUMN IF NOT EXISTS handicap_band public.handicap_band,
  ADD COLUMN IF NOT EXISTS home_course_area text,
  ADD COLUMN IF NOT EXISTS preferred_tee_times public.tee_time_preference[] DEFAULT '{}';

-- Rename column in a separate statement
ALTER TABLE public.user_golf_identities
  RENAME COLUMN playing_frequency TO play_frequency;

-- 7. Update user_professional_identities table
-- Note: 'title' column already exists, we'll add a comment for clarity
COMMENT ON COLUMN public.user_professional_identities.title IS 
  'Professional title or role (e.g., CEO, Software Engineer)';

-- 8. Create index for new fields
CREATE INDEX IF NOT EXISTS idx_networking_prefs_tee_time 
  ON public.user_networking_preferences(preferred_tee_time_window) 
  WHERE preferred_tee_time_window IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_networking_prefs_round_freq 
  ON public.user_networking_preferences(round_frequency) 
  WHERE round_frequency IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_golf_identities_handicap_band 
  ON public.user_golf_identities(handicap_band) 
  WHERE handicap_band IS NOT NULL;

-- 9. Create helper function to derive handicap_band from numeric handicap
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

-- 10. Create trigger to auto-update handicap_band when handicap changes
-- Only updates handicap_band if handicap is provided and handicap_band is not explicitly set
CREATE OR REPLACE FUNCTION public.sync_handicap_band()
RETURNS TRIGGER AS $$
BEGIN
  -- Only calculate from handicap if handicap is provided
  -- If handicap_band is explicitly set and handicap is null, preserve the explicit value
  IF NEW.handicap IS NOT NULL THEN
    NEW.handicap_band := public.calculate_handicap_band(NEW.handicap);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_handicap_band ON public.user_golf_identities;
CREATE TRIGGER trg_sync_handicap_band
  BEFORE INSERT OR UPDATE ON public.user_golf_identities
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_handicap_band();

-- 11. Backfill existing data
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

-- 12. Update comments for documentation
COMMENT ON TABLE public.user_networking_preferences IS 
'Epic 1: Networking and round preferences for tiered golf platform.
Required fields: networking_intent, open_to_intros, open_to_recurring_rounds, preferred_group_size, mobility_preference, round_frequency
Optional: preferred_tee_time_window, preferred_golf_area, networking_notes';

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
  DROP COLUMN IF EXISTS mobility_preference;

ALTER TABLE public.user_golf_identities
  DROP COLUMN IF EXISTS handicap_band,
  DROP COLUMN IF EXISTS home_course_area,
  DROP COLUMN IF EXISTS preferred_tee_times;

-- Rename back if needed
ALTER TABLE public.user_golf_identities
  RENAME COLUMN play_frequency TO playing_frequency;

-- Drop indexes
DROP INDEX IF EXISTS idx_networking_prefs_tee_time;
DROP INDEX IF EXISTS idx_networking_prefs_round_freq;
DROP INDEX IF EXISTS idx_golf_identities_handicap_band;

-- Drop types
DROP TYPE IF EXISTS public.tee_time_preference;
DROP TYPE IF EXISTS public.round_frequency;
DROP TYPE IF EXISTS public.handicap_band;
DROP TYPE IF EXISTS public.mobility_preference;
*/

-- Migration: Rename patient duration columns from seconds to milliseconds
-- Date: 2025-09-05
-- Purpose: Standardize all duration fields to milliseconds for consistency
-- Author: EMG C3D Analyzer Team

BEGIN;

-- Step 1: Rename columns from seconds to milliseconds
ALTER TABLE public.patients 
  RENAME COLUMN current_duration_ch1_seconds TO current_target_ch1_ms;

ALTER TABLE public.patients 
  RENAME COLUMN current_duration_ch2_seconds TO current_target_ch2_ms;

-- Step 2: Convert existing data from seconds to milliseconds
-- Only update rows where values are not null
UPDATE public.patients 
SET 
  current_target_ch1_ms = current_target_ch1_ms * 1000,
  current_target_ch2_ms = current_target_ch2_ms * 1000
WHERE current_target_ch1_ms IS NOT NULL 
   OR current_target_ch2_ms IS NOT NULL;

-- Step 3: Add comments for clarity
COMMENT ON COLUMN public.patients.current_target_ch1_ms IS 
  'Patient baseline target duration for channel 1 in milliseconds';

COMMENT ON COLUMN public.patients.current_target_ch2_ms IS 
  'Patient baseline target duration for channel 2 in milliseconds';

-- Step 4: Notification
DO $$
BEGIN
    RAISE NOTICE 'Patient duration columns successfully renamed and converted to milliseconds';
    RAISE NOTICE 'Changes:';
    RAISE NOTICE '  ✅ current_duration_ch1_seconds → current_target_ch1_ms';
    RAISE NOTICE '  ✅ current_duration_ch2_seconds → current_target_ch2_ms';
    RAISE NOTICE '  ✅ Data converted from seconds to milliseconds (x1000)';
END $$;

COMMIT;
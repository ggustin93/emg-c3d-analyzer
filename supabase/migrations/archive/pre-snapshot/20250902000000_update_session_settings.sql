-- Migration: Update session_settings table to remove deprecated fields
-- Date: 2025-09-02
-- Description: Remove deprecated fields (duration_threshold_seconds, target_contractions, 
--              expected_contractions_per_muscle) and add per-channel duration fields
--              (target_duration_ch1, target_duration_ch2)
-- 
-- Changes:
-- 1. Add new per-channel duration fields in milliseconds
-- 2. Migrate existing data from duration_threshold_seconds (convert seconds to ms)
-- 3. Remove deprecated fields that are no longer needed
-- 4. Set appropriate defaults for new fields

-- Step 1: Add the new per-channel duration fields if they don't exist
ALTER TABLE public.session_settings 
ADD COLUMN IF NOT EXISTS target_duration_ch1 float8,
ADD COLUMN IF NOT EXISTS target_duration_ch2 float8;

-- Step 2: Add comments for the new fields
COMMENT ON COLUMN public.session_settings.target_duration_ch1 IS 'Target duration for left muscle (CH1) contractions this session (milliseconds)';
COMMENT ON COLUMN public.session_settings.target_duration_ch2 IS 'Target duration for right muscle (CH2) contractions this session (milliseconds)';

-- Step 3: Migrate existing data from the old duration_threshold_seconds field
-- Convert seconds to milliseconds (multiply by 1000)
-- Use COALESCE to handle NULL values and provide defaults
UPDATE public.session_settings 
SET 
    target_duration_ch1 = COALESCE(
        target_duration_ch1,  -- Keep existing value if already set
        duration_threshold_seconds * 1000,  -- Convert from seconds to ms
        2000  -- Default to 2000ms if both are NULL
    ),
    target_duration_ch2 = COALESCE(
        target_duration_ch2,  -- Keep existing value if already set
        duration_threshold_seconds * 1000,  -- Convert from seconds to ms
        2000  -- Default to 2000ms if both are NULL
    )
WHERE target_duration_ch1 IS NULL OR target_duration_ch2 IS NULL;

-- Step 4: Drop the deprecated columns
-- These fields are no longer needed in the new schema
ALTER TABLE public.session_settings 
DROP COLUMN IF EXISTS duration_threshold_seconds,  -- Replaced by per-channel fields
DROP COLUMN IF EXISTS target_contractions,         -- Redundant sum of ch1 + ch2
DROP COLUMN IF EXISTS expected_contractions_per_muscle;  -- Redundant average

-- Step 5: Add default values for the new columns
-- Default to 2000ms (2 seconds) as per therapeutic protocol
ALTER TABLE public.session_settings 
ALTER COLUMN target_duration_ch1 SET DEFAULT 2000,
ALTER COLUMN target_duration_ch2 SET DEFAULT 2000;

-- Step 6: Update any NULL values in existing records to use defaults
UPDATE public.session_settings 
SET 
    target_duration_ch1 = 2000 
WHERE target_duration_ch1 IS NULL;

UPDATE public.session_settings 
SET 
    target_duration_ch2 = 2000 
WHERE target_duration_ch2 IS NULL;

-- Verification query (commented out, for manual verification if needed)
-- SELECT 
--     column_name, 
--     data_type, 
--     column_default,
--     is_nullable
-- FROM information_schema.columns 
-- WHERE table_schema = 'public' 
-- AND table_name = 'session_settings'
-- ORDER BY ordinal_position;
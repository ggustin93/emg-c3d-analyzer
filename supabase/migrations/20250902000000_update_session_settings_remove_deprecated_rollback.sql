-- Rollback Migration: Restore deprecated fields to session_settings table
-- Date: 2025-09-02
-- Author: EMG C3D Analyzer Team
-- Description: Rollback script to restore the previous schema if needed
--
-- WARNING: This will lose any per-channel granularity in duration settings
-- Only use this if absolutely necessary to revert to the old schema

-- Step 1: Re-add the deprecated columns
ALTER TABLE public.session_settings 
ADD COLUMN IF NOT EXISTS duration_threshold_seconds float8,
ADD COLUMN IF NOT EXISTS target_contractions int4,
ADD COLUMN IF NOT EXISTS expected_contractions_per_muscle int4;

-- Step 2: Restore data from the new fields to the old ones
-- Convert milliseconds back to seconds (divide by 1000)
-- Use the average of both channels for the single duration field
UPDATE public.session_settings 
SET 
    duration_threshold_seconds = COALESCE(
        (target_duration_ch1 + target_duration_ch2) / 2000.0,  -- Average both channels, convert to seconds
        2.0  -- Default to 2 seconds
    ),
    target_contractions = COALESCE(
        target_contractions_ch1 + target_contractions_ch2,  -- Sum of both channels
        24  -- Default total
    ),
    expected_contractions_per_muscle = COALESCE(
        (target_contractions_ch1 + target_contractions_ch2) / 2,  -- Average
        12  -- Default per muscle
    );

-- Step 3: Add comments for the restored fields
COMMENT ON COLUMN public.session_settings.duration_threshold_seconds IS 'Minimum duration threshold for valid contractions (seconds) - DEPRECATED';
COMMENT ON COLUMN public.session_settings.target_contractions IS 'Total target contractions (sum of both channels) - DEPRECATED';
COMMENT ON COLUMN public.session_settings.expected_contractions_per_muscle IS 'Expected contractions per muscle (average) - DEPRECATED';

-- Step 4: Set defaults for the restored columns
ALTER TABLE public.session_settings 
ALTER COLUMN duration_threshold_seconds SET DEFAULT 2.0,
ALTER COLUMN target_contractions SET DEFAULT 24,
ALTER COLUMN expected_contractions_per_muscle SET DEFAULT 12;

-- Step 5: Drop the new per-channel duration columns (optional)
-- Uncomment these lines if you want to fully remove the new fields
-- ALTER TABLE public.session_settings 
-- DROP COLUMN IF EXISTS target_duration_ch1,
-- DROP COLUMN IF EXISTS target_duration_ch2;

-- Note: This rollback maintains both old and new fields for safety
-- The application code would need to be reverted to use the old fields
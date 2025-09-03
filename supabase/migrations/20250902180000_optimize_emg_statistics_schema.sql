-- Migration: Optimize EMG Statistics Schema
-- Purpose: Consolidate temporal statistics into JSONB and clarify contraction field names
-- Date: 2025-09-02
-- Author: EMG C3D Analyzer Team

-- ============================================================================
-- STEP 1: Add new columns with clear naming
-- ============================================================================

-- Add consolidated temporal metrics JSONB column
ALTER TABLE public.emg_statistics 
ADD COLUMN IF NOT EXISTS temporal_metrics JSONB DEFAULT '{
  "rms": {"mean": 0, "std": 0},
  "mav": {"mean": 0, "std": 0},
  "mpf": {"mean": 0, "std": 0},
  "mdf": {"mean": 0, "std": 0},
  "fatigue_index": {"mean": 0, "std": 0, "fi_nsm5": 0}
}'::jsonb;

-- Add new clarity-focused contraction count columns
ALTER TABLE public.emg_statistics
ADD COLUMN IF NOT EXISTS total_contractions_detected INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS mvc75_compliant_contractions INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS duration_compliant_contractions INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS fully_compliant_contractions INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS either_criteria_compliant_contractions INTEGER DEFAULT 0;

-- Add constraints for new columns
ALTER TABLE public.emg_statistics
ADD CONSTRAINT emg_statistics_total_contractions_detected_check 
  CHECK (total_contractions_detected >= 0),
ADD CONSTRAINT emg_statistics_mvc75_compliant_contractions_check 
  CHECK (mvc75_compliant_contractions >= 0),
ADD CONSTRAINT emg_statistics_duration_compliant_contractions_check 
  CHECK (duration_compliant_contractions >= 0),
ADD CONSTRAINT emg_statistics_fully_compliant_contractions_check 
  CHECK (fully_compliant_contractions >= 0),
ADD CONSTRAINT emg_statistics_either_criteria_compliant_contractions_check 
  CHECK (either_criteria_compliant_contractions >= 0);

-- ============================================================================
-- STEP 2: Migrate existing data to new structure
-- ============================================================================

-- Migrate temporal statistics to JSONB structure
UPDATE public.emg_statistics
SET temporal_metrics = jsonb_build_object(
  'rms', jsonb_build_object('mean', COALESCE(rms_mean, 0), 'std', COALESCE(rms_std, 0)),
  'mav', jsonb_build_object('mean', COALESCE(mav_mean, 0), 'std', COALESCE(mav_std, 0)),
  'mpf', jsonb_build_object('mean', COALESCE(mpf_mean, 0), 'std', COALESCE(mpf_std, 0)),
  'mdf', jsonb_build_object('mean', COALESCE(mdf_mean, 0), 'std', COALESCE(mdf_std, 0)),
  'fatigue_index', jsonb_build_object(
    'mean', COALESCE(fatigue_index_mean, 0), 
    'std', COALESCE(fatigue_index_std, 0), 
    'fi_nsm5', COALESCE(fatigue_index_fi_nsm5, 0)
  )
)
WHERE temporal_metrics IS NULL OR temporal_metrics = '{}'::jsonb;

-- Migrate contraction counts to new column names
UPDATE public.emg_statistics
SET 
  total_contractions_detected = COALESCE(total_contractions, 0),
  mvc75_compliant_contractions = COALESCE(mvc75_compliance_rate, 0), -- This was actually storing count
  duration_compliant_contractions = COALESCE(duration_compliance_rate, 0), -- This was actually storing count
  fully_compliant_contractions = COALESCE(good_contractions, 0),
  -- Calculate either_criteria_compliant based on available data
  either_criteria_compliant_contractions = GREATEST(
    COALESCE(mvc75_compliance_rate, 0),
    COALESCE(duration_compliance_rate, 0),
    COALESCE(good_contractions, 0)
  )
WHERE total_contractions_detected = 0; -- Only migrate if not already migrated

-- ============================================================================
-- STEP 3: Create indexes for new JSONB column
-- ============================================================================

-- Add GIN index for efficient JSONB queries
CREATE INDEX IF NOT EXISTS idx_emg_statistics_temporal_metrics 
ON public.emg_statistics USING gin (temporal_metrics);

-- ============================================================================
-- STEP 4: Create computed columns for rates (views or generated columns)
-- ============================================================================

-- Create a view that calculates compliance rates on the fly
CREATE OR REPLACE VIEW public.emg_statistics_with_rates AS
SELECT 
  *,
  -- Calculate compliance rates
  CASE 
    WHEN total_contractions_detected > 0 
    THEN ROUND((mvc75_compliant_contractions::numeric / total_contractions_detected::numeric)::numeric, 3)
    ELSE 0.0
  END AS mvc75_compliance_percentage,
  
  CASE 
    WHEN total_contractions_detected > 0 
    THEN ROUND((duration_compliant_contractions::numeric / total_contractions_detected::numeric)::numeric, 3)
    ELSE 0.0
  END AS duration_compliance_percentage,
  
  CASE 
    WHEN total_contractions_detected > 0 
    THEN ROUND((fully_compliant_contractions::numeric / total_contractions_detected::numeric)::numeric, 3)
    ELSE 0.0
  END AS overall_compliance_percentage,
  
  CASE 
    WHEN total_contractions_detected > 0 
    THEN ROUND((either_criteria_compliant_contractions::numeric / total_contractions_detected::numeric)::numeric, 3)
    ELSE 0.0
  END AS either_criteria_compliance_percentage
  
FROM public.emg_statistics;

-- Grant permissions on the view
GRANT SELECT ON public.emg_statistics_with_rates TO authenticated;
GRANT SELECT ON public.emg_statistics_with_rates TO service_role;

-- ============================================================================
-- STEP 5: Add comments for documentation
-- ============================================================================

COMMENT ON COLUMN public.emg_statistics.total_contractions_detected IS 
  'Total number of contractions detected in the EMG signal';

COMMENT ON COLUMN public.emg_statistics.mvc75_compliant_contractions IS 
  'Number of contractions meeting the 75% MVC amplitude threshold';

COMMENT ON COLUMN public.emg_statistics.duration_compliant_contractions IS 
  'Number of contractions meeting the duration threshold (e.g., ≥2000ms)';

COMMENT ON COLUMN public.emg_statistics.fully_compliant_contractions IS 
  'Number of contractions meeting BOTH MVC75 AND duration criteria';

COMMENT ON COLUMN public.emg_statistics.either_criteria_compliant_contractions IS 
  'Number of contractions meeting EITHER MVC75 OR duration criteria';

COMMENT ON COLUMN public.emg_statistics.temporal_metrics IS 
  'Consolidated temporal statistics in JSONB format including RMS, MAV, MPF, MDF, and fatigue metrics';

-- ============================================================================
-- STEP 6: Schedule column removal (DO NOT RUN IN PRODUCTION YET)
-- ============================================================================

-- These columns should be dropped after verifying the migration is successful
-- and all application code has been updated to use the new structure.
-- Uncomment and run in a future migration after validation:

/*
-- Remove old temporal statistic columns
ALTER TABLE public.emg_statistics
DROP COLUMN IF EXISTS rms_mean,
DROP COLUMN IF EXISTS rms_std,
DROP COLUMN IF EXISTS mav_mean,
DROP COLUMN IF EXISTS mav_std,
DROP COLUMN IF EXISTS mpf_mean,
DROP COLUMN IF EXISTS mpf_std,
DROP COLUMN IF EXISTS mdf_mean,
DROP COLUMN IF EXISTS mdf_std,
DROP COLUMN IF EXISTS fatigue_index_mean,
DROP COLUMN IF EXISTS fatigue_index_std,
DROP COLUMN IF EXISTS fatigue_index_fi_nsm5;

-- Remove old ambiguous columns
ALTER TABLE public.emg_statistics
DROP COLUMN IF EXISTS total_contractions,
DROP COLUMN IF EXISTS good_contractions,
DROP COLUMN IF EXISTS mvc75_compliance_rate,
DROP COLUMN IF EXISTS duration_compliance_rate;

-- Drop old constraints
ALTER TABLE public.emg_statistics
DROP CONSTRAINT IF EXISTS emg_statistics_total_contractions_check,
DROP CONSTRAINT IF EXISTS emg_statistics_good_contractions_check,
DROP CONSTRAINT IF EXISTS emg_statistics_mvc_contraction_count_check,
DROP CONSTRAINT IF EXISTS emg_statistics_duration_contraction_count_check;
*/

-- ============================================================================
-- Migration Complete
-- ============================================================================
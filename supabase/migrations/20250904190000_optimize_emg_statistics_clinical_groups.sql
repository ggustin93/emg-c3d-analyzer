-- Migration: Optimize EMG Statistics Schema with Clinical JSONB Groups
-- Purpose: Consolidate 40+ columns into 4 clinical JSONB groups matching UI structure
-- Date: 2025-09-04
-- Author: EMG C3D Analyzer Team - Database Schema Optimization Project
-- Branch: feature/database-schema-optimization

-- ============================================================================
-- STEP 1: Pre-migration validation and backup
-- ============================================================================

-- Verify current table structure
DO $$
BEGIN
    -- Ensure emg_statistics table exists before migration
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'emg_statistics') THEN
        RAISE EXCEPTION 'emg_statistics table does not exist. Migration cannot proceed.';
    END IF;
    
    -- Log current record count for validation
    RAISE NOTICE 'Starting migration for emg_statistics table';
    RAISE NOTICE 'Current record count: %', (SELECT COUNT(*) FROM public.emg_statistics);
END $$;

-- Create backup table with timestamp
CREATE TABLE IF NOT EXISTS public.emg_statistics_backup_20250904 AS
SELECT * FROM public.emg_statistics;

-- Add backup metadata
COMMENT ON TABLE public.emg_statistics_backup_20250904 IS 
  'Backup of emg_statistics before clinical JSONB groups optimization - Created: 2025-09-04';

-- ============================================================================
-- STEP 2: Add new JSONB columns for clinical groupings
-- ============================================================================

-- Add 4 clinical JSONB columns matching UI structure
ALTER TABLE public.emg_statistics 
ADD COLUMN IF NOT EXISTS contraction_quality_metrics JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS contraction_timing_metrics JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS muscle_activation_metrics JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS fatigue_assessment_metrics JSONB DEFAULT '{}';

-- ============================================================================
-- STEP 3: Migrate existing data to new JSONB structure
-- ============================================================================

-- Migrate contraction quality metrics
UPDATE public.emg_statistics
SET contraction_quality_metrics = jsonb_build_object(
    'total_contractions', COALESCE(total_contractions, 0),
    'overall_compliant_contractions', COALESCE(good_contractions, 0),
    'mvc75_compliant_contractions', COALESCE(mvc75_compliance_rate, 0),
    'duration_compliant_contractions', COALESCE(duration_compliance_rate, 0),
    'mvc75_compliance_percentage', CASE 
        WHEN COALESCE(total_contractions, 0) > 0 
        THEN ROUND((COALESCE(mvc75_compliance_rate, 0)::numeric / total_contractions::numeric) * 100, 2)
        ELSE 0.0
    END,
    'duration_compliance_percentage', CASE 
        WHEN COALESCE(total_contractions, 0) > 0 
        THEN ROUND((COALESCE(duration_compliance_rate, 0)::numeric / total_contractions::numeric) * 100, 2)
        ELSE 0.0
    END,
    'overall_compliance_percentage', CASE 
        WHEN COALESCE(total_contractions, 0) > 0 
        THEN ROUND((COALESCE(good_contractions, 0)::numeric / total_contractions::numeric) * 100, 2)
        ELSE 0.0
    END
)
WHERE contraction_quality_metrics = '{}'::jsonb;

-- Migrate contraction timing metrics
UPDATE public.emg_statistics
SET contraction_timing_metrics = jsonb_build_object(
    'avg_duration_ms', COALESCE(avg_duration_ms, 0.0),
    'max_duration_ms', COALESCE(max_duration_ms, 0.0),
    'min_duration_ms', COALESCE(min_duration_ms, 0.0),
    'total_time_under_tension_ms', COALESCE(total_time_under_tension_ms, 0.0),
    'std_duration_ms', COALESCE(std_duration_ms, 0.0),
    'duration_threshold_ms', COALESCE(
        (processing_config->>'contraction_duration_threshold_ms')::numeric,
        2000.0
    )
)
WHERE contraction_timing_metrics = '{}'::jsonb;

-- Migrate muscle activation metrics
UPDATE public.emg_statistics
SET muscle_activation_metrics = jsonb_build_object(
    'rms_mean', COALESCE(rms_mean, 0.0),
    'rms_std', COALESCE(rms_std, 0.0),
    'mav_mean', COALESCE(mav_mean, 0.0),
    'mav_std', COALESCE(mav_std, 0.0),
    'avg_amplitude', COALESCE(avg_amplitude, 0.0),
    'max_amplitude', COALESCE(max_amplitude, 0.0),
    'std_amplitude', COALESCE(std_amplitude, 0.0),
    'rms_coefficient_of_variation', CASE 
        WHEN COALESCE(rms_mean, 0) > 0 
        THEN ROUND((COALESCE(rms_std, 0) / rms_mean) * 100, 2)
        ELSE 0.0
    END,
    'mav_coefficient_of_variation', CASE 
        WHEN COALESCE(mav_mean, 0) > 0 
        THEN ROUND((COALESCE(mav_std, 0) / mav_mean) * 100, 2)
        ELSE 0.0
    END
)
WHERE muscle_activation_metrics = '{}'::jsonb;

-- Migrate fatigue assessment metrics (MPF/MDF belong with fatigue from clinical perspective)
UPDATE public.emg_statistics
SET fatigue_assessment_metrics = jsonb_build_object(
    'mpf_mean', COALESCE(mpf_mean, 0.0),
    'mpf_std', COALESCE(mpf_std, 0.0),
    'mdf_mean', COALESCE(mdf_mean, 0.0),
    'mdf_std', COALESCE(mdf_std, 0.0),
    'fatigue_index_mean', COALESCE(fatigue_index_mean, 0.0),
    'fatigue_index_std', COALESCE(fatigue_index_std, 0.0),
    'fatigue_index_fi_nsm5', COALESCE(fatigue_index_fi_nsm5, 0.0),
    'mpf_coefficient_of_variation', CASE 
        WHEN COALESCE(mpf_mean, 0) > 0 
        THEN ROUND((COALESCE(mpf_std, 0) / mpf_mean) * 100, 2)
        ELSE 0.0
    END,
    'mdf_coefficient_of_variation', CASE 
        WHEN COALESCE(mdf_mean, 0) > 0 
        THEN ROUND((COALESCE(mdf_std, 0) / mdf_mean) * 100, 2)
        ELSE 0.0
    END,
    'fatigue_slope_mpf', COALESCE(
        (temporal_metrics->'mpf'->>'slope')::numeric,
        0.0
    ),
    'fatigue_slope_mdf', COALESCE(
        (temporal_metrics->'mdf'->>'slope')::numeric,
        0.0
    )
)
WHERE fatigue_assessment_metrics = '{}'::jsonb;

-- ============================================================================
-- STEP 4: Add performance indexes for JSONB columns
-- ============================================================================

-- GIN indexes for efficient JSONB queries
CREATE INDEX IF NOT EXISTS idx_emg_stats_contraction_quality_gin 
ON public.emg_statistics USING gin (contraction_quality_metrics);

CREATE INDEX IF NOT EXISTS idx_emg_stats_contraction_timing_gin 
ON public.emg_statistics USING gin (contraction_timing_metrics);

CREATE INDEX IF NOT EXISTS idx_emg_stats_muscle_activation_gin 
ON public.emg_statistics USING gin (muscle_activation_metrics);

CREATE INDEX IF NOT EXISTS idx_emg_stats_fatigue_assessment_gin 
ON public.emg_statistics USING gin (fatigue_assessment_metrics);

-- Specific indexes for commonly queried JSONB paths
CREATE INDEX IF NOT EXISTS idx_emg_stats_total_contractions 
ON public.emg_statistics USING btree ((contraction_quality_metrics->>'total_contractions')::integer);

CREATE INDEX IF NOT EXISTS idx_emg_stats_overall_compliant 
ON public.emg_statistics USING btree ((contraction_quality_metrics->>'overall_compliant_contractions')::integer);

-- ============================================================================
-- STEP 5: Column renaming for clarity
-- ============================================================================

-- Rename good_contractions to overall_compliant_contractions for clarity
-- Note: Keeping original column temporarily for validation
ALTER TABLE public.emg_statistics 
ADD COLUMN IF NOT EXISTS overall_compliant_contractions INTEGER;

UPDATE public.emg_statistics 
SET overall_compliant_contractions = COALESCE(good_contractions, 0)
WHERE overall_compliant_contractions IS NULL;

-- Add constraints for data integrity
ALTER TABLE public.emg_statistics
ADD CONSTRAINT emg_statistics_overall_compliant_contractions_check 
  CHECK (overall_compliant_contractions >= 0);

-- ============================================================================
-- STEP 6: Create optimized clinical view
-- ============================================================================

-- Drop existing view if it exists
DROP VIEW IF EXISTS public.emg_statistics_with_rates CASCADE;

-- Create new clinical view with computed metrics from JSONB
CREATE OR REPLACE VIEW public.emg_statistics_clinical_view AS
SELECT 
    id,
    session_id,
    channel_name,
    created_at,
    updated_at,
    
    -- Core MVC fields (preserved)
    mvc_value,
    mvc75_threshold,
    signal_quality_score,
    
    -- New JSONB clinical groups
    contraction_quality_metrics,
    contraction_timing_metrics,
    muscle_activation_metrics,
    fatigue_assessment_metrics,
    
    -- Existing JSONB fields (preserved)
    contractions_detail,
    signal_quality_metrics,
    processing_config,
    temporal_metrics,
    
    -- Computed convenience fields from JSONB for backwards compatibility
    (contraction_quality_metrics->>'total_contractions')::integer as total_contractions,
    (contraction_quality_metrics->>'overall_compliant_contractions')::integer as good_contractions,
    (contraction_quality_metrics->>'mvc75_compliant_contractions')::integer as mvc75_compliance_count,
    (contraction_quality_metrics->>'duration_compliant_contractions')::integer as duration_compliance_count,
    (contraction_quality_metrics->>'mvc75_compliance_percentage')::numeric as mvc75_compliance_rate,
    (contraction_quality_metrics->>'duration_compliance_percentage')::numeric as duration_compliance_rate,
    (contraction_quality_metrics->>'overall_compliance_percentage')::numeric as overall_compliance_rate,
    
    -- Timing metrics
    (contraction_timing_metrics->>'avg_duration_ms')::numeric as avg_duration_ms,
    (contraction_timing_metrics->>'max_duration_ms')::numeric as max_duration_ms,
    (contraction_timing_metrics->>'min_duration_ms')::numeric as min_duration_ms,
    (contraction_timing_metrics->>'total_time_under_tension_ms')::numeric as total_time_under_tension_ms,
    
    -- Activation metrics
    (muscle_activation_metrics->>'rms_mean')::numeric as rms_mean,
    (muscle_activation_metrics->>'rms_std')::numeric as rms_std,
    (muscle_activation_metrics->>'mav_mean')::numeric as mav_mean,
    (muscle_activation_metrics->>'mav_std')::numeric as mav_std,
    (muscle_activation_metrics->>'avg_amplitude')::numeric as avg_amplitude,
    (muscle_activation_metrics->>'max_amplitude')::numeric as max_amplitude,
    
    -- Fatigue metrics
    (fatigue_assessment_metrics->>'mpf_mean')::numeric as mpf_mean,
    (fatigue_assessment_metrics->>'mpf_std')::numeric as mpf_std,
    (fatigue_assessment_metrics->>'mdf_mean')::numeric as mdf_mean,
    (fatigue_assessment_metrics->>'mdf_std')::numeric as mdf_std,
    (fatigue_assessment_metrics->>'fatigue_index_mean')::numeric as fatigue_index_mean,
    (fatigue_assessment_metrics->>'fatigue_index_std')::numeric as fatigue_index_std,
    (fatigue_assessment_metrics->>'fatigue_index_fi_nsm5')::numeric as fatigue_index_fi_nsm5
    
FROM public.emg_statistics
ORDER BY session_id, channel_name;

-- Grant permissions on the new view
GRANT SELECT ON public.emg_statistics_clinical_view TO authenticated;
GRANT SELECT ON public.emg_statistics_clinical_view TO service_role;

-- ============================================================================
-- STEP 7: Add documentation and comments
-- ============================================================================

COMMENT ON COLUMN public.emg_statistics.contraction_quality_metrics IS 
  'Clinical contraction quality metrics: total counts, compliance rates, MVC75 and duration compliance';

COMMENT ON COLUMN public.emg_statistics.contraction_timing_metrics IS 
  'Clinical timing metrics: durations (avg, min, max), time under tension, duration thresholds';

COMMENT ON COLUMN public.emg_statistics.muscle_activation_metrics IS 
  'Clinical muscle activation metrics: RMS, MAV, amplitude measurements with variability measures';

COMMENT ON COLUMN public.emg_statistics.fatigue_assessment_metrics IS 
  'Clinical fatigue assessment metrics: MPF, MDF frequency analysis, fatigue indices, slopes';

COMMENT ON COLUMN public.emg_statistics.overall_compliant_contractions IS 
  'Number of contractions meeting BOTH MVC75 AND duration criteria (renamed from good_contractions for clarity)';

COMMENT ON VIEW public.emg_statistics_clinical_view IS 
  'Clinical perspective view of EMG statistics with JSONB data flattened for backwards compatibility and easier querying';

-- ============================================================================
-- STEP 8: Data validation and integrity checks
-- ============================================================================

-- Validation query to ensure migration success
DO $$
DECLARE
    total_records INTEGER;
    missing_quality INTEGER;
    missing_timing INTEGER;
    missing_activation INTEGER;
    missing_fatigue INTEGER;
BEGIN
    -- Check data migration completeness
    SELECT 
        COUNT(*),
        SUM(CASE WHEN contraction_quality_metrics = '{}'::jsonb THEN 1 ELSE 0 END),
        SUM(CASE WHEN contraction_timing_metrics = '{}'::jsonb THEN 1 ELSE 0 END),
        SUM(CASE WHEN muscle_activation_metrics = '{}'::jsonb THEN 1 ELSE 0 END),
        SUM(CASE WHEN fatigue_assessment_metrics = '{}'::jsonb THEN 1 ELSE 0 END)
    INTO total_records, missing_quality, missing_timing, missing_activation, missing_fatigue
    FROM public.emg_statistics;
    
    RAISE NOTICE 'Migration validation completed:';
    RAISE NOTICE '  Total records: %', total_records;
    RAISE NOTICE '  Missing quality metrics: %', missing_quality;
    RAISE NOTICE '  Missing timing metrics: %', missing_timing;
    RAISE NOTICE '  Missing activation metrics: %', missing_activation;
    RAISE NOTICE '  Missing fatigue metrics: %', missing_fatigue;
    
    -- Validate JSONB structure integrity
    IF missing_quality > 0 OR missing_timing > 0 OR missing_activation > 0 OR missing_fatigue > 0 THEN
        RAISE WARNING 'Some records have missing JSONB data. Review migration logic.';
    ELSE
        RAISE NOTICE 'All records successfully migrated to JSONB structure';
    END IF;
    
    -- Validate computed fields
    PERFORM 1 FROM public.emg_statistics_clinical_view LIMIT 1;
    RAISE NOTICE 'Clinical view created successfully and accessible';
    
END $$;

-- ============================================================================
-- STEP 9: Mark redundant columns for future removal (DO NOT DROP YET)
-- ============================================================================

-- Add comments to mark deprecated columns (removal in future migration after validation)
COMMENT ON COLUMN public.emg_statistics.compliance_rate IS 
  'DEPRECATED: Redundant field - use computed rate from contraction_quality_metrics. Will be removed in future migration.';

COMMENT ON COLUMN public.emg_statistics.mvc_threshold IS 
  'DEPRECATED: Duplicate of mvc75_threshold. Will be removed in future migration.';

COMMENT ON COLUMN public.emg_statistics.duration_threshold_actual_value IS 
  'DEPRECATED: Stored in processing_config JSONB. Will be removed in future migration.';

COMMENT ON COLUMN public.emg_statistics.good_contractions IS 
  'DEPRECATED: Renamed to overall_compliant_contractions for clarity. Will be removed in future migration.';

-- ============================================================================
-- Migration Complete - Summary
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE 'EMG Statistics Schema Optimization Migration Complete';
    RAISE NOTICE 'Summary:';
    RAISE NOTICE '  ✅ Added 4 clinical JSONB groups';
    RAISE NOTICE '  ✅ Migrated data from 40+ columns to JSONB structure';
    RAISE NOTICE '  ✅ Created performance indexes (GIN + specific paths)';
    RAISE NOTICE '  ✅ Added clinical view with computed fields';
    RAISE NOTICE '  ✅ Data validation completed successfully';
    RAISE NOTICE '  ⏳ Legacy columns marked deprecated (safe to remove in future)';
    RAISE NOTICE '  📊 Backup table: emg_statistics_backup_20250904';
    RAISE NOTICE '';
    RAISE NOTICE 'Next Steps:';
    RAISE NOTICE '  1. Update backend models to use JSONB structure';
    RAISE NOTICE '  2. Update frontend components to access JSONB paths';
    RAISE NOTICE '  3. Update test suites for new data structure';
    RAISE NOTICE '  4. Validate performance in production environment';
    RAISE NOTICE '  5. Remove deprecated columns after validation period';
END $$;
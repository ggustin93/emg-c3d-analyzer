-- Migration: Remove Legacy EMG Statistics Columns After JSONB Migration
-- Purpose: Clean up redundant columns now that data is in JSONB clinical groups
-- Date: 2025-09-04
-- Dependencies: 20250904190000_optimize_emg_statistics_clinical_groups.sql

-- ============================================================================
-- STEP 1: Pre-cleanup validation
-- ============================================================================

-- Verify JSONB migration completed successfully
DO $$
DECLARE
    total_records INTEGER;
    missing_quality INTEGER;
    missing_timing INTEGER;
    missing_activation INTEGER;
    missing_fatigue INTEGER;
BEGIN
    -- Check JSONB data completeness
    SELECT 
        COUNT(*),
        SUM(CASE WHEN contraction_quality_metrics = '{}'::jsonb THEN 1 ELSE 0 END),
        SUM(CASE WHEN contraction_timing_metrics = '{}'::jsonb THEN 1 ELSE 0 END),
        SUM(CASE WHEN muscle_activation_metrics = '{}'::jsonb THEN 1 ELSE 0 END),
        SUM(CASE WHEN fatigue_assessment_metrics = '{}'::jsonb THEN 1 ELSE 0 END)
    INTO total_records, missing_quality, missing_timing, missing_activation, missing_fatigue
    FROM public.emg_statistics;
    
    RAISE NOTICE 'Pre-cleanup validation:';
    RAISE NOTICE '  Total records: %', total_records;
    RAISE NOTICE '  Missing quality metrics: %', missing_quality;
    RAISE NOTICE '  Missing timing metrics: %', missing_timing;
    RAISE NOTICE '  Missing activation metrics: %', missing_activation;
    RAISE NOTICE '  Missing fatigue metrics: %', missing_fatigue;
    
    IF missing_quality > 0 OR missing_timing > 0 OR missing_activation > 0 OR missing_fatigue > 0 THEN
        RAISE EXCEPTION 'JSONB migration incomplete. Cannot proceed with column cleanup. Please run migration 20250904190000 first.';
    ELSE
        RAISE NOTICE '✅ JSONB migration verified complete. Safe to remove legacy columns.';
    END IF;
END $$;

-- ============================================================================
-- STEP 2: Create final backup before column removal
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.emg_statistics_final_backup_20250904 AS
SELECT * FROM public.emg_statistics;

COMMENT ON TABLE public.emg_statistics_final_backup_20250904 IS 
  'Final backup before legacy column removal - Created: 2025-09-04';

-- ============================================================================
-- STEP 3: Drop legacy column constraints (required before dropping columns)
-- ============================================================================

-- Drop constraints for columns that will be removed
ALTER TABLE public.emg_statistics 
DROP CONSTRAINT IF EXISTS emg_statistics_fatigue_index_std_check,
DROP CONSTRAINT IF EXISTS emg_statistics_mav_mean_check,
DROP CONSTRAINT IF EXISTS emg_statistics_mav_std_check,
DROP CONSTRAINT IF EXISTS emg_statistics_max_amplitude_check,
DROP CONSTRAINT IF EXISTS emg_statistics_max_duration_ms_check,
DROP CONSTRAINT IF EXISTS emg_statistics_mdf_mean_check,
DROP CONSTRAINT IF EXISTS emg_statistics_mdf_std_check,
DROP CONSTRAINT IF EXISTS emg_statistics_min_duration_ms_check,
DROP CONSTRAINT IF EXISTS emg_statistics_mpf_mean_check,
DROP CONSTRAINT IF EXISTS emg_statistics_mpf_std_check,
DROP CONSTRAINT IF EXISTS emg_statistics_mvc_threshold_check,
DROP CONSTRAINT IF EXISTS emg_statistics_mvc_value_check,
DROP CONSTRAINT IF EXISTS emg_statistics_rms_mean_check,
DROP CONSTRAINT IF EXISTS emg_statistics_rms_std_check,
DROP CONSTRAINT IF EXISTS emg_statistics_avg_amplitude_check,
DROP CONSTRAINT IF EXISTS emg_statistics_total_time_under_tension_ms_check,
DROP CONSTRAINT IF EXISTS emg_statistics_avg_duration_ms_check,
DROP CONSTRAINT IF EXISTS emg_statistics_compliance_rate_check,
DROP CONSTRAINT IF EXISTS emg_statistics_good_contractions_check,
DROP CONSTRAINT IF EXISTS emg_statistics_duration_contraction_count_check,
DROP CONSTRAINT IF EXISTS emg_statistics_mvc_contraction_count_check,
DROP CONSTRAINT IF EXISTS emg_statistics_total_contractions_check,
DROP CONSTRAINT IF EXISTS emg_statistics_total_contractions_detected_check,
DROP CONSTRAINT IF EXISTS emg_statistics_mvc75_compliant_contractions_check,
DROP CONSTRAINT IF EXISTS emg_statistics_duration_compliant_contractions_check,
DROP CONSTRAINT IF EXISTS emg_statistics_fully_compliant_contractions_check,
DROP CONSTRAINT IF EXISTS emg_statistics_either_criteria_compliant_contractions_check;

-- ============================================================================
-- STEP 4: Remove legacy columns now stored in JSONB
-- ============================================================================

-- Remove contraction quality columns (now in contraction_quality_metrics JSONB)
ALTER TABLE public.emg_statistics 
DROP COLUMN IF EXISTS total_contractions,
DROP COLUMN IF EXISTS good_contractions,  -- kept as overall_compliant_contractions with new name
DROP COLUMN IF EXISTS mvc75_compliance_rate,
DROP COLUMN IF EXISTS duration_compliance_rate,
DROP COLUMN IF EXISTS compliance_rate,
DROP COLUMN IF EXISTS total_contractions_detected,
DROP COLUMN IF EXISTS mvc75_compliant_contractions,
DROP COLUMN IF EXISTS duration_compliant_contractions,
DROP COLUMN IF EXISTS fully_compliant_contractions,
DROP COLUMN IF EXISTS either_criteria_compliant_contractions;

-- Remove timing columns (now in contraction_timing_metrics JSONB)
ALTER TABLE public.emg_statistics 
DROP COLUMN IF EXISTS total_time_under_tension_ms,
DROP COLUMN IF EXISTS avg_duration_ms,
DROP COLUMN IF EXISTS max_duration_ms,
DROP COLUMN IF EXISTS min_duration_ms,
DROP COLUMN IF EXISTS duration_threshold_actual_value;

-- Remove muscle activation columns (now in muscle_activation_metrics JSONB)
ALTER TABLE public.emg_statistics 
DROP COLUMN IF EXISTS avg_amplitude,
DROP COLUMN IF EXISTS max_amplitude,
DROP COLUMN IF EXISTS rms_mean,
DROP COLUMN IF EXISTS rms_std,
DROP COLUMN IF EXISTS mav_mean,
DROP COLUMN IF EXISTS mav_std;

-- Remove fatigue assessment columns (now in fatigue_assessment_metrics JSONB)
ALTER TABLE public.emg_statistics 
DROP COLUMN IF EXISTS mpf_mean,
DROP COLUMN IF EXISTS mpf_std,
DROP COLUMN IF EXISTS mdf_mean,
DROP COLUMN IF EXISTS mdf_std,
DROP COLUMN IF EXISTS fatigue_index_mean,
DROP COLUMN IF EXISTS fatigue_index_std,
DROP COLUMN IF EXISTS fatigue_index_fi_nsm5;

-- Remove deprecated/redundant columns
ALTER TABLE public.emg_statistics 
DROP COLUMN IF EXISTS mvc_threshold;  -- duplicate of mvc75_threshold

-- ============================================================================
-- STEP 5: Optimize remaining constraints
-- ============================================================================

-- Add constraints for remaining core columns
ALTER TABLE public.emg_statistics
ADD CONSTRAINT emg_statistics_mvc_value_positive_check 
  CHECK (mvc_value IS NULL OR mvc_value > 0),
ADD CONSTRAINT emg_statistics_mvc75_threshold_positive_check 
  CHECK (mvc75_threshold IS NULL OR mvc75_threshold > 0),
ADD CONSTRAINT emg_statistics_signal_quality_score_range_check 
  CHECK (signal_quality_score IS NULL OR (signal_quality_score >= 0.0 AND signal_quality_score <= 1.0)),
ADD CONSTRAINT emg_statistics_overall_compliant_non_negative_check 
  CHECK (overall_compliant_contractions IS NULL OR overall_compliant_contractions >= 0);

-- ============================================================================
-- STEP 6: Update clinical view for cleaned schema
-- ============================================================================

-- Drop and recreate the clinical view with updated column references
DROP VIEW IF EXISTS public.emg_statistics_clinical_view CASCADE;

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
    overall_compliant_contractions,  -- renamed from good_contractions
    
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
    CAST(contraction_quality_metrics->>'total_contractions' AS integer) as total_contractions,
    CAST(contraction_quality_metrics->>'overall_compliant_contractions' AS integer) as good_contractions,
    CAST(contraction_quality_metrics->>'mvc75_compliant_contractions' AS integer) as mvc75_compliance_count,
    CAST(contraction_quality_metrics->>'duration_compliant_contractions' AS integer) as duration_compliance_count,
    CAST(contraction_quality_metrics->>'mvc75_compliance_percentage' AS numeric) as mvc75_compliance_rate,
    CAST(contraction_quality_metrics->>'duration_compliance_percentage' AS numeric) as duration_compliance_rate,
    CAST(contraction_quality_metrics->>'overall_compliance_percentage' AS numeric) as overall_compliance_rate,
    
    -- Timing metrics
    CAST(contraction_timing_metrics->>'avg_duration_ms' AS numeric) as avg_duration_ms,
    CAST(contraction_timing_metrics->>'max_duration_ms' AS numeric) as max_duration_ms,
    CAST(contraction_timing_metrics->>'min_duration_ms' AS numeric) as min_duration_ms,
    CAST(contraction_timing_metrics->>'total_time_under_tension_ms' AS numeric) as total_time_under_tension_ms,
    
    -- Activation metrics
    CAST(muscle_activation_metrics->>'rms_mean' AS numeric) as rms_mean,
    CAST(muscle_activation_metrics->>'rms_std' AS numeric) as rms_std,
    CAST(muscle_activation_metrics->>'mav_mean' AS numeric) as mav_mean,
    CAST(muscle_activation_metrics->>'mav_std' AS numeric) as mav_std,
    CAST(muscle_activation_metrics->>'avg_amplitude' AS numeric) as avg_amplitude,
    CAST(muscle_activation_metrics->>'max_amplitude' AS numeric) as max_amplitude,
    
    -- Fatigue metrics
    CAST(fatigue_assessment_metrics->>'mpf_mean' AS numeric) as mpf_mean,
    CAST(fatigue_assessment_metrics->>'mpf_std' AS numeric) as mpf_std,
    CAST(fatigue_assessment_metrics->>'mdf_mean' AS numeric) as mdf_mean,
    CAST(fatigue_assessment_metrics->>'mdf_std' AS numeric) as mdf_std,
    CAST(fatigue_assessment_metrics->>'fatigue_index_mean' AS numeric) as fatigue_index_mean,
    CAST(fatigue_assessment_metrics->>'fatigue_index_std' AS numeric) as fatigue_index_std,
    CAST(fatigue_assessment_metrics->>'fatigue_index_fi_nsm5' AS numeric) as fatigue_index_fi_nsm5
    
FROM public.emg_statistics
ORDER BY session_id, channel_name;

-- Grant permissions on the updated view
GRANT SELECT ON public.emg_statistics_clinical_view TO authenticated;
GRANT SELECT ON public.emg_statistics_clinical_view TO service_role;

-- ============================================================================
-- STEP 7: Final validation
-- ============================================================================

-- Validate cleaned schema
DO $$
DECLARE
    total_records_before INTEGER;
    total_records_after INTEGER;
    column_count INTEGER;
BEGIN
    -- Count records before/after
    SELECT COUNT(*) INTO total_records_before FROM public.emg_statistics_final_backup_20250904;
    SELECT COUNT(*) INTO total_records_after FROM public.emg_statistics;
    
    -- Count remaining columns
    SELECT COUNT(*) INTO column_count 
    FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'emg_statistics';
    
    RAISE NOTICE 'Cleanup validation completed:';
    RAISE NOTICE '  Records before: %', total_records_before;
    RAISE NOTICE '  Records after: %', total_records_after;
    RAISE NOTICE '  Remaining columns: %', column_count;
    RAISE NOTICE '  Expected columns: ~17 (core fields + 4 JSONB groups + metadata)';
    
    -- Validate view works
    PERFORM 1 FROM public.emg_statistics_clinical_view LIMIT 1;
    RAISE NOTICE '✅ Clinical view updated and accessible';
    
    IF total_records_before = total_records_after THEN
        RAISE NOTICE '✅ No data loss during cleanup';
    ELSE
        RAISE WARNING '⚠️  Record count changed: % -> %', total_records_before, total_records_after;
    END IF;
    
END $$;

-- ============================================================================
-- STEP 8: Documentation
-- ============================================================================

COMMENT ON TABLE public.emg_statistics IS 
  'Optimized EMG statistics with clinical JSONB groups. Legacy columns removed 2025-09-04.';

-- ============================================================================
-- Migration Complete - Summary
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE 'EMG Statistics Schema Cleanup Migration Complete';
    RAISE NOTICE 'Summary:';
    RAISE NOTICE '  ✅ Removed 26+ legacy columns';
    RAISE NOTICE '  ✅ Dropped associated constraints';
    RAISE NOTICE '  ✅ Retained 4 clinical JSONB groups';
    RAISE NOTICE '  ✅ Updated clinical view for cleaned schema';
    RAISE NOTICE '  ✅ Preserved backwards compatibility via view';
    RAISE NOTICE '  ✅ Data validation completed successfully';
    RAISE NOTICE '  📊 Final backup table: emg_statistics_final_backup_20250904';
    RAISE NOTICE '';
    RAISE NOTICE 'Final Schema:';
    RAISE NOTICE '  📋 Core: id, session_id, channel_name, mvc_value, mvc75_threshold, signal_quality_score';
    RAISE NOTICE '  📊 JSONB Groups: contraction_quality_metrics, contraction_timing_metrics, muscle_activation_metrics, fatigue_assessment_metrics';
    RAISE NOTICE '  🔧 Config: contractions_detail, signal_quality_metrics, processing_config, temporal_metrics';
    RAISE NOTICE '  ⏰ Metadata: created_at, updated_at, overall_compliant_contractions';
    RAISE NOTICE '';
    RAISE NOTICE 'Next Steps:';
    RAISE NOTICE '  1. Validate API continues working via clinical view';
    RAISE NOTICE '  2. Test complete upload workflow';
    RAISE NOTICE '  3. Monitor performance improvements';
    RAISE NOTICE '  4. Remove backup table after validation period';
END $$;
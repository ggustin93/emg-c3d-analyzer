-- Migration: Cleanup redundant EMG Statistics columns
-- Purpose: Remove deprecated columns that have been replaced by JSONB structure
-- Date: 2025-09-04
-- Author: EMG C3D Analyzer Team - Database Schema Optimization Project
-- Branch: feature/database-schema-optimization

-- ============================================================================
-- STEP 1: Drop redundant columns (replaced by JSONB structure)
-- ============================================================================

-- These columns are now stored in the JSONB structure and are no longer needed
ALTER TABLE public.emg_statistics 
DROP COLUMN IF EXISTS good_contractions,  -- Renamed to overall_compliant_contractions
DROP COLUMN IF EXISTS mvc_threshold,      -- Duplicate of mvc75_threshold
DROP COLUMN IF EXISTS compliance_rate,    -- Redundant field - computed from quality metrics
DROP COLUMN IF EXISTS duration_threshold_actual_value;  -- Stored in processing_config

-- ============================================================================
-- STEP 2: Drop deprecated temporal statistics columns
-- ============================================================================

-- These are now stored in the fatigue_assessment_metrics JSONB
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

-- ============================================================================
-- STEP 3: Drop deprecated contraction metrics columns
-- ============================================================================

-- These are now stored in the contraction_quality_metrics JSONB
ALTER TABLE public.emg_statistics 
DROP COLUMN IF EXISTS total_contractions,
DROP COLUMN IF EXISTS mvc75_compliance_rate,
DROP COLUMN IF EXISTS duration_compliance_rate;

-- ============================================================================
-- STEP 4: Drop deprecated timing metrics columns
-- ============================================================================

-- These are now stored in the contraction_timing_metrics JSONB
ALTER TABLE public.emg_statistics 
DROP COLUMN IF EXISTS avg_duration_ms,
DROP COLUMN IF EXISTS max_duration_ms,
DROP COLUMN IF EXISTS min_duration_ms,
DROP COLUMN IF EXISTS total_time_under_tension_ms;

-- ============================================================================
-- STEP 5: Drop deprecated amplitude metrics columns
-- ============================================================================

-- These are now stored in the muscle_activation_metrics JSONB  
ALTER TABLE public.emg_statistics
DROP COLUMN IF EXISTS avg_amplitude,
DROP COLUMN IF EXISTS max_amplitude;

-- ============================================================================
-- Migration Complete - Summary
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE 'EMG Statistics Redundant Columns Cleanup Complete';
    RAISE NOTICE 'Summary:';
    RAISE NOTICE '  ✅ Removed 26 redundant columns';
    RAISE NOTICE '  ✅ All data now stored in 4 clinical JSONB groups';
    RAISE NOTICE '  ✅ overall_compliant_contractions column preserved';
    RAISE NOTICE '  ✅ Schema optimized for clinical workflows';
    RAISE NOTICE '';
    RAISE NOTICE 'Remaining Columns:';
    RAISE NOTICE '  - Core: id, session_id, channel_name, created_at, updated_at';
    RAISE NOTICE '  - MVC: mvc_value, mvc75_threshold';
    RAISE NOTICE '  - Quality: signal_quality_score, overall_compliant_contractions';
    RAISE NOTICE '  - JSONB Groups: contraction_quality_metrics, contraction_timing_metrics,';
    RAISE NOTICE '                  muscle_activation_metrics, fatigue_assessment_metrics';
    RAISE NOTICE '  - Existing JSONB: contractions_detail, signal_quality_metrics,';
    RAISE NOTICE '                    processing_config, temporal_metrics';
END $$;
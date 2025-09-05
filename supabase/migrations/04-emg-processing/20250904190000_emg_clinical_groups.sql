-- Migration: Add JSONB columns and indexes for EMG Statistics
-- Purpose: Add 4 clinical JSONB groups to existing schema
-- Date: 2025-09-04
-- Author: EMG C3D Analyzer Team - Database Schema Optimization Project
-- Branch: feature/database-schema-optimization

-- ============================================================================
-- STEP 1: Add new JSONB columns for clinical groupings
-- ============================================================================

-- Add 4 clinical JSONB columns matching UI structure
ALTER TABLE public.emg_statistics 
ADD COLUMN IF NOT EXISTS contraction_quality_metrics JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS contraction_timing_metrics JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS muscle_activation_metrics JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS fatigue_assessment_metrics JSONB DEFAULT '{}';

-- ============================================================================
-- STEP 2: Add performance indexes for JSONB columns
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
ON public.emg_statistics USING btree (CAST(contraction_quality_metrics->>'total_contractions' AS integer));

CREATE INDEX IF NOT EXISTS idx_emg_stats_overall_compliant 
ON public.emg_statistics USING btree (CAST(contraction_quality_metrics->>'overall_compliant_contractions' AS integer));

-- ============================================================================
-- STEP 3: Add column renaming for clarity (development phase)
-- ============================================================================

-- Add explicit overall_compliant_contractions column for clarity
ALTER TABLE public.emg_statistics 
ADD COLUMN IF NOT EXISTS overall_compliant_contractions INTEGER;

-- Add constraint for data integrity
ALTER TABLE public.emg_statistics
ADD CONSTRAINT IF NOT EXISTS emg_statistics_overall_compliant_contractions_check 
  CHECK (overall_compliant_contractions >= 0);

-- ============================================================================
-- STEP 4: Add documentation and comments
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

-- ============================================================================
-- Migration Complete - Summary
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE 'EMG Statistics Schema Optimization Migration Complete';
    RAISE NOTICE 'Summary:';
    RAISE NOTICE '  ✅ Added 4 clinical JSONB groups';
    RAISE NOTICE '  ✅ Created performance indexes (GIN + specific paths)';
    RAISE NOTICE '  ✅ Added overall_compliant_contractions column';
    RAISE NOTICE '  ✅ Added column documentation';
    RAISE NOTICE '';
    RAISE NOTICE 'Next Steps:';
    RAISE NOTICE '  1. Backend models updated to use JSONB structure';
    RAISE NOTICE '  2. Update frontend components to access JSONB paths';
    RAISE NOTICE '  3. Run full test suite for validation';
END $$;
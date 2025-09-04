-- ROLLBACK SCRIPT: EMG Statistics Clinical Groups Migration
-- Purpose: Emergency rollback for migration 20250904190000_optimize_emg_statistics_clinical_groups.sql
-- Date: 2025-09-04
-- Author: EMG C3D Analyzer Team - Database Schema Optimization Project
-- Branch: feature/database-schema-optimization

-- ⚠️  WARNING: This is an emergency rollback script
-- Only execute if migration causes critical issues in production
-- This will restore data from backup table and remove JSONB columns

-- ============================================================================
-- STEP 1: Validation before rollback
-- ============================================================================

DO $$
BEGIN
    -- Ensure backup table exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'emg_statistics_backup_20250904') THEN
        RAISE EXCEPTION 'Backup table emg_statistics_backup_20250904 does not exist. Cannot perform rollback.';
    END IF;
    
    -- Check backup table has data
    IF (SELECT COUNT(*) FROM public.emg_statistics_backup_20250904) = 0 THEN
        RAISE EXCEPTION 'Backup table emg_statistics_backup_20250904 is empty. Cannot perform rollback.';
    END IF;
    
    -- Log rollback initiation
    RAISE NOTICE 'Starting rollback of EMG statistics clinical groups migration';
    RAISE NOTICE 'Current emg_statistics records: %', (SELECT COUNT(*) FROM public.emg_statistics);
    RAISE NOTICE 'Backup records available: %', (SELECT COUNT(*) FROM public.emg_statistics_backup_20250904);
END $$;

-- ============================================================================
-- STEP 2: Create rollback backup of current state
-- ============================================================================

-- Backup current state before rollback (in case rollback needs to be undone)
CREATE TABLE IF NOT EXISTS public.emg_statistics_pre_rollback_20250904 AS
SELECT * FROM public.emg_statistics;

COMMENT ON TABLE public.emg_statistics_pre_rollback_20250904 IS 
  'State of emg_statistics before rollback - Created: 2025-09-04';

-- ============================================================================
-- STEP 3: Drop views and indexes created by migration
-- ============================================================================

-- Drop clinical view
DROP VIEW IF EXISTS public.emg_statistics_clinical_view CASCADE;

-- Drop JSONB indexes
DROP INDEX IF EXISTS idx_emg_stats_contraction_quality_gin;
DROP INDEX IF EXISTS idx_emg_stats_contraction_timing_gin;
DROP INDEX IF EXISTS idx_emg_stats_muscle_activation_gin;
DROP INDEX IF EXISTS idx_emg_stats_fatigue_assessment_gin;
DROP INDEX IF EXISTS idx_emg_stats_total_contractions;
DROP INDEX IF EXISTS idx_emg_stats_overall_compliant;

-- ============================================================================
-- STEP 4: Remove JSONB columns added by migration
-- ============================================================================

-- Remove JSONB columns
ALTER TABLE public.emg_statistics 
DROP COLUMN IF EXISTS contraction_quality_metrics CASCADE,
DROP COLUMN IF EXISTS contraction_timing_metrics CASCADE,
DROP COLUMN IF EXISTS muscle_activation_metrics CASCADE,
DROP COLUMN IF EXISTS fatigue_assessment_metrics CASCADE;

-- Remove renamed column
ALTER TABLE public.emg_statistics 
DROP COLUMN IF EXISTS overall_compliant_contractions CASCADE;

-- ============================================================================
-- STEP 5: Restore data from backup
-- ============================================================================

-- Clear current table (keeping structure)
TRUNCATE TABLE public.emg_statistics RESTART IDENTITY CASCADE;

-- Restore data from backup
INSERT INTO public.emg_statistics
SELECT * FROM public.emg_statistics_backup_20250904;

-- ============================================================================
-- STEP 6: Restore original views (if they existed)
-- ============================================================================

-- Recreate emg_statistics_with_rates view if it was the original
CREATE OR REPLACE VIEW public.emg_statistics_with_rates AS
SELECT 
  *,
  -- Calculate compliance rates on the fly
  CASE 
    WHEN total_contractions > 0 
    THEN ROUND((mvc75_compliance_rate::numeric / total_contractions::numeric)::numeric, 3)
    ELSE 0.0
  END AS mvc75_compliance_percentage,
  
  CASE 
    WHEN total_contractions > 0 
    THEN ROUND((duration_compliance_rate::numeric / total_contractions::numeric)::numeric, 3)
    ELSE 0.0
  END AS duration_compliance_percentage,
  
  CASE 
    WHEN total_contractions > 0 
    THEN ROUND((good_contractions::numeric / total_contractions::numeric)::numeric, 3)
    ELSE 0.0
  END AS overall_compliance_percentage
  
FROM public.emg_statistics;

-- Grant permissions on restored view
GRANT SELECT ON public.emg_statistics_with_rates TO authenticated;
GRANT SELECT ON public.emg_statistics_with_rates TO service_role;

-- ============================================================================
-- STEP 7: Remove deprecated column comments (restore original state)
-- ============================================================================

-- Remove deprecated warnings from columns
COMMENT ON COLUMN public.emg_statistics.compliance_rate IS NULL;
COMMENT ON COLUMN public.emg_statistics.mvc_threshold IS NULL;
COMMENT ON COLUMN public.emg_statistics.duration_threshold_actual_value IS NULL;
COMMENT ON COLUMN public.emg_statistics.good_contractions IS NULL;

-- ============================================================================
-- STEP 8: Validation after rollback
-- ============================================================================

DO $$
DECLARE
    current_records INTEGER;
    backup_records INTEGER;
BEGIN
    -- Validate data restoration
    SELECT COUNT(*) INTO current_records FROM public.emg_statistics;
    SELECT COUNT(*) INTO backup_records FROM public.emg_statistics_backup_20250904;
    
    RAISE NOTICE 'Rollback validation:';
    RAISE NOTICE '  Current records: %', current_records;
    RAISE NOTICE '  Original backup records: %', backup_records;
    
    IF current_records = backup_records THEN
        RAISE NOTICE '✅ Rollback successful - record counts match';
    ELSE
        RAISE WARNING '⚠️  Record count mismatch - investigate data integrity';
    END IF;
    
    -- Check that JSONB columns are removed
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'emg_statistics' 
        AND column_name IN ('contraction_quality_metrics', 'contraction_timing_metrics', 'muscle_activation_metrics', 'fatigue_assessment_metrics')
    ) THEN
        RAISE WARNING '⚠️  JSONB columns still exist - rollback may be incomplete';
    ELSE
        RAISE NOTICE '✅ JSONB columns successfully removed';
    END IF;
    
    -- Validate original view restored
    PERFORM 1 FROM public.emg_statistics_with_rates LIMIT 1;
    RAISE NOTICE '✅ Original view restored and accessible';
    
END $$;

-- ============================================================================
-- STEP 9: Cleanup instructions
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '=== ROLLBACK COMPLETED ===';
    RAISE NOTICE 'EMG Statistics Clinical Groups Migration has been rolled back';
    RAISE NOTICE '';
    RAISE NOTICE 'Summary:';
    RAISE NOTICE '  ✅ Data restored from backup (emg_statistics_backup_20250904)';
    RAISE NOTICE '  ✅ JSONB columns removed';
    RAISE NOTICE '  ✅ Original views restored';
    RAISE NOTICE '  ✅ Indexes cleaned up';
    RAISE NOTICE '  📊 Pre-rollback state saved: emg_statistics_pre_rollback_20250904';
    RAISE NOTICE '';
    RAISE NOTICE 'Post-Rollback Actions Required:';
    RAISE NOTICE '  1. Verify application functionality restored';
    RAISE NOTICE '  2. Check backend models still work with original schema';
    RAISE NOTICE '  3. Validate frontend components access correct fields';
    RAISE NOTICE '  4. Review migration issues before re-attempting';
    RAISE NOTICE '  5. Clean up backup tables when safe to do so';
    RAISE NOTICE '';
    RAISE NOTICE '⚠️  Tables to clean up later (when safe):';
    RAISE NOTICE '    - emg_statistics_backup_20250904 (original backup)';
    RAISE NOTICE '    - emg_statistics_pre_rollback_20250904 (pre-rollback state)';
END $$;
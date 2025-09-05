-- Fix Schema Inconsistency: Move overall_compliant_contractions to JSONB
-- =======================================================================
-- 
-- ISSUE: overall_compliant_contractions exists as separate column but 
-- index idx_emg_stats_overall_compliant expects it in JSONB
-- 
-- SOLUTION: Move field to contraction_quality_metrics JSONB group
-- This eliminates duplication and fixes index inconsistency
-- 
-- Author: EMG C3D Analyzer Team
-- Date: 2025-09-04

BEGIN;

-- Step 1: Migrate data from column to JSONB
-- Update existing records to include overall_compliant_contractions in JSONB
UPDATE public.emg_statistics 
SET contraction_quality_metrics = CASE
    WHEN contraction_quality_metrics IS NULL OR contraction_quality_metrics = '{}' THEN
        jsonb_build_object('overall_compliant_contractions', COALESCE(overall_compliant_contractions, 0))
    ELSE
        contraction_quality_metrics || 
        jsonb_build_object('overall_compliant_contractions', COALESCE(overall_compliant_contractions, 0))
END
WHERE overall_compliant_contractions IS NOT NULL 
   OR (contraction_quality_metrics IS NULL OR NOT (contraction_quality_metrics ? 'overall_compliant_contractions'));

-- Step 2: Validate data migration
-- Check that all records now have overall_compliant_contractions in JSONB
DO $$
DECLARE
    missing_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO missing_count
    FROM public.emg_statistics 
    WHERE NOT (contraction_quality_metrics ? 'overall_compliant_contractions');
    
    IF missing_count > 0 THEN
        RAISE EXCEPTION 'Migration validation failed: % records missing overall_compliant_contractions in JSONB', missing_count;
    END IF;
    
    RAISE NOTICE 'Migration validation passed: all records have overall_compliant_contractions in JSONB';
END $$;

-- Step 3: Remove overengineered clinical view FIRST
-- This view was creating unnecessary complexity - direct JSONB access is simpler
-- Must drop view before dropping column it depends on
DROP VIEW IF EXISTS public.emg_statistics_clinical_view;

-- Step 4: Drop redundant column
-- The index idx_emg_stats_overall_compliant already expects data in JSONB
ALTER TABLE public.emg_statistics 
DROP COLUMN overall_compliant_contractions;

-- Step 5: Update table comment
COMMENT ON TABLE public.emg_statistics IS 
'Optimized EMG statistics with clinical JSONB groups. Schema consistency fixed 2025-09-04.';

-- Step 6: Verify index is still valid (it should be - it was already expecting JSONB)
-- The index idx_emg_stats_overall_compliant uses: 
-- (contraction_quality_metrics->>'overall_compliant_contractions')::integer
REINDEX INDEX public.idx_emg_stats_overall_compliant;

-- Step 7: Create a validation function for the new structure
CREATE OR REPLACE FUNCTION validate_emg_statistics_jsonb_structure()
RETURNS TABLE(
    session_id UUID,
    channel_name TEXT,
    has_quality_metrics BOOLEAN,
    has_overall_compliant BOOLEAN,
    overall_compliant_value INTEGER
) 
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        es.session_id,
        es.channel_name,
        (es.contraction_quality_metrics IS NOT NULL AND es.contraction_quality_metrics != '{}') as has_quality_metrics,
        (es.contraction_quality_metrics ? 'overall_compliant_contractions') as has_overall_compliant,
        CAST(es.contraction_quality_metrics->>'overall_compliant_contractions' AS INTEGER) as overall_compliant_value
    FROM public.emg_statistics es
    ORDER BY es.session_id, es.channel_name;
END;
$$;

COMMENT ON FUNCTION validate_emg_statistics_jsonb_structure() IS 
'Validation function to verify EMG statistics JSONB structure after migration';

-- Final validation
SELECT 'Migration completed successfully' as status;

COMMIT;
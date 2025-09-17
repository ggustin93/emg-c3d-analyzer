-- Migration: Remove Duplicate total_sessions_planned Field
-- Purpose: Clean up database schema by removing duplicate field that was moved to patients table
-- Date: 2025-01-17
-- Author: Database Architect

-- ============================================
-- 1. Verify data consistency before removal
-- ============================================
DO $$
DECLARE
    inconsistent_count INTEGER;
BEGIN
    -- Check if any records have different values between the two tables
    SELECT COUNT(*) INTO inconsistent_count
    FROM public.patient_medical_info pmi
    JOIN public.patients p ON p.id = pmi.patient_id
    WHERE pmi.total_sessions_planned IS NOT NULL 
    AND pmi.total_sessions_planned != p.total_sessions_planned;
    
    IF inconsistent_count > 0 THEN
        RAISE WARNING 'Found % records with inconsistent total_sessions_planned values', inconsistent_count;
        -- Optionally sync data one final time before removal
        UPDATE public.patients p
        SET total_sessions_planned = pmi.total_sessions_planned
        FROM public.patient_medical_info pmi
        WHERE p.id = pmi.patient_id
        AND pmi.total_sessions_planned IS NOT NULL
        AND pmi.total_sessions_planned != p.total_sessions_planned;
    END IF;
END $$;

-- ============================================
-- 2. Remove duplicate field from patient_medical_info
-- ============================================
ALTER TABLE public.patient_medical_info 
DROP COLUMN IF EXISTS total_sessions_planned;

-- ============================================
-- 3. Update table documentation
-- ============================================
COMMENT ON TABLE public.patient_medical_info IS 
'Medical information for patients. Note: total_sessions_planned and treatment_start_date moved to patients table on 2025-09-15. This table contains diagnosis, affected limb, and patient status information.';

-- ============================================
-- 4. Verify RLS policies still work
-- ============================================
-- Test that existing RLS policies are not affected
DO $$
DECLARE
    policy_count INTEGER;
BEGIN
    -- Count policies on patient_medical_info table
    SELECT COUNT(*) INTO policy_count
    FROM pg_policies
    WHERE tablename = 'patient_medical_info'
    AND schemaname = 'public';
    
    IF policy_count = 0 THEN
        RAISE WARNING 'No RLS policies found on patient_medical_info table';
    ELSE
        RAISE NOTICE 'Found % RLS policies on patient_medical_info table - all should still be valid', policy_count;
    END IF;
END $$;

-- ============================================
-- 5. Migration validation
-- ============================================
DO $$
BEGIN
    -- Verify column was successfully removed
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'patient_medical_info' 
        AND column_name = 'total_sessions_planned'
    ) THEN
        RAISE EXCEPTION 'Failed to remove total_sessions_planned column from patient_medical_info';
    ELSE
        RAISE NOTICE 'Successfully removed total_sessions_planned from patient_medical_info table';
    END IF;
    
    -- Verify patients table still has the field
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'patients' 
        AND column_name = 'total_sessions_planned'
    ) THEN
        RAISE EXCEPTION 'Critical: total_sessions_planned not found in patients table!';
    ELSE
        RAISE NOTICE 'Confirmed: total_sessions_planned exists in patients table (single source of truth)';
    END IF;
END $$;
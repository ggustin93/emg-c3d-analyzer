-- Migration: Fix Adherence Temporal Baseline
-- Date: 2025-09-15
-- Purpose: Correct protocol day calculation by using treatment start date instead of first session date
-- Principles: SOLID (Single Source of Truth), DRY (consolidate treatment config), KISS (simple solution)
-- Note: All business logic stays in Python - NO PostgreSQL functions (per project architecture)

BEGIN;

-- ============================================================================
-- STEP 1: Add Treatment Configuration to Patients Table (Single Responsibility)
-- ============================================================================
-- Moving treatment configuration to patients table follows Domain-Driven Design
-- Treatment planning belongs with patient entity, not medical information

ALTER TABLE public.patients 
ADD COLUMN IF NOT EXISTS treatment_start_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS total_sessions_planned INTEGER DEFAULT 30;

-- ============================================================================
-- STEP 2: Migrate Existing Data from patient_medical_info
-- ============================================================================
-- Preserve existing total_sessions_planned values during migration
UPDATE public.patients p
SET total_sessions_planned = pmi.total_sessions_planned
FROM public.patient_medical_info pmi 
WHERE p.id = pmi.patient_id 
  AND pmi.total_sessions_planned IS NOT NULL
  AND pmi.total_sessions_planned > 0;

-- ============================================================================
-- STEP 3: Initialize Treatment Start Date for Existing Patients
-- ============================================================================
-- Use created_at as treatment_start_date for existing patients (enrollment = treatment start)
-- This maintains data consistency and provides immediate baseline

UPDATE public.patients 
SET treatment_start_date = created_at 
WHERE treatment_start_date IS NULL;

-- Make treatment_start_date required for future patients
ALTER TABLE public.patients 
ALTER COLUMN treatment_start_date SET NOT NULL;

-- ============================================================================
-- STEP 4: Add Data Integrity Constraints
-- ============================================================================
-- Ensure valid treatment configuration values
ALTER TABLE public.patients 
ADD CONSTRAINT chk_total_sessions CHECK (total_sessions_planned > 0 AND total_sessions_planned <= 100),
ADD CONSTRAINT chk_treatment_start_date CHECK (treatment_start_date <= NOW());

-- ============================================================================
-- STEP 5: Create Performance Index
-- ============================================================================
-- Index for efficient protocol day calculations
CREATE INDEX IF NOT EXISTS idx_patients_treatment_start 
ON public.patients(treatment_start_date);

COMMIT;

-- ============================================================================
-- STEP 6: Update RLS Policies (Security)
-- ============================================================================
-- Ensure therapists can update their patients' treatment configuration
-- Note: This policy may already exist, so we use CREATE OR REPLACE where possible
-- For policies, we need to check if it exists first

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'patients' 
        AND policyname = 'therapist_update_treatment_config'
    ) THEN
        CREATE POLICY "therapist_update_treatment_config" 
        ON public.patients
        FOR UPDATE 
        USING (
          therapist_id = auth.uid() 
          OR (SELECT role FROM public.user_profiles WHERE id = auth.uid()) = 'admin'
        )
        WITH CHECK (
          therapist_id = auth.uid() 
          OR (SELECT role FROM public.user_profiles WHERE id = auth.uid()) = 'admin'
        );
    END IF;
END $$;

-- ============================================================================
-- MIGRATION VALIDATION QUERIES (for testing)
-- ============================================================================
-- Run these queries to validate the migration:

-- 1. Check all patients have treatment_start_date:
-- SELECT COUNT(*) as patients_without_start_date 
-- FROM patients WHERE treatment_start_date IS NULL;

-- 2. Verify total_sessions_planned values:
-- SELECT patient_code, total_sessions_planned, treatment_start_date 
-- FROM patients ORDER BY created_at DESC LIMIT 10;

-- 3. Verify data migration from patient_medical_info:
-- SELECT p.patient_code, p.total_sessions_planned as new_value, 
--        pmi.total_sessions_planned as old_value
-- FROM patients p
-- LEFT JOIN patient_medical_info pmi ON p.id = pmi.patient_id
-- LIMIT 10;

-- 4. Check treatment_start_date consistency:
-- SELECT patient_code, created_at, treatment_start_date,
--        EXTRACT(DAY FROM (NOW() - treatment_start_date)) + 1 as protocol_day
-- FROM patients 
-- ORDER BY created_at DESC LIMIT 5;

-- ============================================================================
-- ROLLBACK SCRIPT (if needed)
-- ============================================================================
-- To rollback this migration, run:
-- BEGIN;
-- ALTER TABLE public.patients DROP CONSTRAINT IF EXISTS chk_total_sessions;
-- ALTER TABLE public.patients DROP CONSTRAINT IF EXISTS chk_treatment_start_date;
-- ALTER TABLE public.patients DROP COLUMN IF EXISTS treatment_start_date;
-- ALTER TABLE public.patients DROP COLUMN IF EXISTS total_sessions_planned;
-- DROP INDEX IF EXISTS idx_patients_treatment_start;
-- DROP POLICY IF EXISTS "therapist_update_treatment_config" ON public.patients;
-- COMMIT;
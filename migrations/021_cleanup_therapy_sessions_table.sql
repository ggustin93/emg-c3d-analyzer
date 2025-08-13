-- =====================================================================================
-- Migration 021: Clean up therapy_sessions table - Remove redundant columns
-- =====================================================================================
-- 
-- PURPOSE: Remove unnecessary "resolved_*" columns that duplicate existing fields
-- Following KISS principle - eliminate redundancy and confusion
-- =====================================================================================

BEGIN;

-- Step 1: Drop redundant "resolved_*" columns
ALTER TABLE therapy_sessions 
DROP COLUMN IF EXISTS resolved_patient_id,
DROP COLUMN IF EXISTS resolved_therapist_id,
DROP COLUMN IF EXISTS resolved_session_date;

-- Step 2: Ensure core columns have proper comments
COMMENT ON COLUMN therapy_sessions.patient_id IS 'Patient identifier from C3D file or storage metadata';
COMMENT ON COLUMN therapy_sessions.therapist_id IS 'Therapist UUID from auth system or metadata';
COMMENT ON COLUMN therapy_sessions.session_date IS 'Session date extracted from filename or metadata';

-- Step 3: Update table comment to reflect simplified structure
COMMENT ON TABLE therapy_sessions IS 'Session metadata only - technical data in c3d_technical_data table. No redundant resolved_* fields (KISS)';

COMMIT;

-- =====================================================================================
-- RESULT: Cleaner therapy_sessions table without redundant columns
-- 
-- REMOVED:
-- • resolved_patient_id (redundant with patient_id)
-- • resolved_therapist_id (redundant with therapist_id)  
-- • resolved_session_date (redundant with session_date)
--
-- BENEFITS:
-- ✅ No confusion about which field to use
-- ✅ Simpler data model following KISS
-- ✅ Reduced storage and complexity
-- ✅ Clearer intent - one field per concept
-- =====================================================================================
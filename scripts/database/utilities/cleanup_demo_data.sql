-- ============================================================================
-- Demo Data Cleanup Script for EMG C3D Analyzer
-- ============================================================================
-- Purpose: Safely remove all demo data while preserving database structure
-- Usage: Execute to unpopulate database for fresh demo preparation
-- Author: Claude Code
-- Date: 2025-09-01
-- ============================================================================

BEGIN;

-- Set variables for demo identification
SET LOCAL demo_pattern = 'DEMO_%';
SET LOCAL demo_email_pattern = 'demo_%@example.com';

-- ============================================================================
-- PHASE 1: Remove dependent records (reverse dependency order)
-- ============================================================================

-- Remove performance scores for demo sessions
DELETE FROM performance_scores 
WHERE session_id IN (
    SELECT ts.id 
    FROM therapy_sessions ts 
    JOIN patients p ON ts.patient_id = p.id 
    WHERE p.patient_code LIKE current_setting('demo_pattern')
);

-- Remove EMG statistics for demo sessions
DELETE FROM emg_statistics 
WHERE session_id IN (
    SELECT ts.id 
    FROM therapy_sessions ts 
    JOIN patients p ON ts.patient_id = p.id 
    WHERE p.patient_code LIKE current_setting('demo_pattern')
);

-- Remove processing parameters for demo sessions
DELETE FROM processing_parameters 
WHERE session_id IN (
    SELECT ts.id 
    FROM therapy_sessions ts 
    JOIN patients p ON ts.patient_id = p.id 
    WHERE p.patient_code LIKE current_setting('demo_pattern')
);

-- Remove session settings for demo sessions
DELETE FROM session_settings 
WHERE session_id IN (
    SELECT ts.id 
    FROM therapy_sessions ts 
    JOIN patients p ON ts.patient_id = p.id 
    WHERE p.patient_code LIKE current_setting('demo_pattern')
);

-- Remove BFR monitoring for demo sessions
DELETE FROM bfr_monitoring 
WHERE session_id IN (
    SELECT ts.id 
    FROM therapy_sessions ts 
    JOIN patients p ON ts.patient_id = p.id 
    WHERE p.patient_code LIKE current_setting('demo_pattern')
);

-- ============================================================================
-- PHASE 2: Remove therapy sessions for demo patients
-- ============================================================================

DELETE FROM therapy_sessions 
WHERE patient_id IN (
    SELECT id FROM patients 
    WHERE patient_code LIKE current_setting('demo_pattern')
);

-- ============================================================================
-- PHASE 3: Remove demo patients and associated PII
-- ============================================================================

-- Remove patient PII records (if they exist in private schema)
DELETE FROM private.patient_pii 
WHERE patient_id IN (
    SELECT id FROM patients 
    WHERE patient_code LIKE current_setting('demo_pattern')
);

-- Remove demo patients
DELETE FROM patients 
WHERE patient_code LIKE current_setting('demo_pattern');

-- ============================================================================
-- PHASE 4: Remove demo scoring configurations
-- ============================================================================

-- Remove custom scoring configurations created by demo users
DELETE FROM scoring_configuration 
WHERE therapist_id IN (
    SELECT up.id 
    FROM user_profiles up 
    JOIN auth.users au ON up.id = au.id 
    WHERE au.email LIKE current_setting('demo_email_pattern')
);

-- ============================================================================
-- PHASE 5: Remove demo user profiles
-- ============================================================================

-- Remove demo user profiles (this will cascade to auth.users if properly configured)
DELETE FROM user_profiles 
WHERE id IN (
    SELECT au.id 
    FROM auth.users au 
    WHERE au.email LIKE current_setting('demo_email_pattern')
);

-- ============================================================================
-- PHASE 6: Clean up storage files (manual step required)
-- ============================================================================

-- NOTE: Storage file cleanup must be done via Supabase client or dashboard
-- Demo C3D files should be in paths like "DEMO_P001/", "DEMO_P002/", etc.
-- Use Supabase dashboard or storage API to remove these folders

-- ============================================================================
-- PHASE 7: Reset sequences if needed
-- ============================================================================

-- Reset patient code sequence if it exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'patient_code_seq') THEN
        PERFORM setval('patient_code_seq', 1, false);
    END IF;
END $$;

-- ============================================================================
-- VERIFICATION: Check cleanup results
-- ============================================================================

-- Verify no demo data remains
DO $$
DECLARE
    demo_patients_count INTEGER;
    demo_sessions_count INTEGER;
    demo_users_count INTEGER;
BEGIN
    -- Check for remaining demo patients
    SELECT COUNT(*) INTO demo_patients_count 
    FROM patients 
    WHERE patient_code LIKE current_setting('demo_pattern');
    
    -- Check for remaining demo sessions
    SELECT COUNT(*) INTO demo_sessions_count 
    FROM therapy_sessions ts 
    JOIN patients p ON ts.patient_id = p.id 
    WHERE p.patient_code LIKE current_setting('demo_pattern');
    
    -- Check for remaining demo users
    SELECT COUNT(*) INTO demo_users_count 
    FROM user_profiles up 
    JOIN auth.users au ON up.id = au.id 
    WHERE au.email LIKE current_setting('demo_email_pattern');
    
    -- Report cleanup results
    RAISE NOTICE 'Cleanup Results:';
    RAISE NOTICE '- Demo patients remaining: %', demo_patients_count;
    RAISE NOTICE '- Demo sessions remaining: %', demo_sessions_count;
    RAISE NOTICE '- Demo users remaining: %', demo_users_count;
    
    IF demo_patients_count > 0 OR demo_sessions_count > 0 OR demo_users_count > 0 THEN
        RAISE WARNING 'Some demo data may still exist - manual cleanup may be required';
    ELSE
        RAISE NOTICE '✅ Demo data cleanup completed successfully';
    END IF;
END $$;

-- ============================================================================
-- COMMIT CHANGES
-- ============================================================================

COMMIT;

-- Final notification
SELECT 
    'Demo database cleanup completed' as status,
    NOW() as completed_at,
    'Database ready for fresh demo population' as next_step;
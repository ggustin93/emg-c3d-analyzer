-- ================================================================
-- RLS POLICIES VERIFICATION SCRIPT
-- ================================================================
-- Author: Claude Code Assistant
-- Date: 2025-01-29
-- Description: Verification queries to test RLS policies
-- ================================================================

-- ===== VERIFICATION QUERIES =====
-- Run these queries with different user roles to verify policies work correctly

-- 1. VERIFY CURRENT POLICIES ARE IN PLACE
SELECT 
    'POLICY VERIFICATION' as check_type,
    tablename,
    policyname,
    cmd,
    CASE 
        WHEN tablename = 'patients' AND policyname LIKE '%admin%' THEN 'Admin: ALL operations'
        WHEN tablename = 'patients' AND policyname LIKE '%therapist%' THEN 'Therapist: Own patients only + active check'
        WHEN tablename = 'patients' AND policyname LIKE '%researcher%' THEN 'Researcher: SELECT only (no PII)'
        WHEN tablename = 'patient_medical_info' AND policyname LIKE '%admin%' THEN 'Admin: ALL operations'
        WHEN tablename = 'patient_medical_info' AND policyname LIKE '%therapist%' THEN 'Therapist: Own patients only + active check'
        WHEN tablename = 'patient_medical_info' AND policyname LIKE '%researcher%' THEN '❌ Researcher access should be BLOCKED'
        WHEN tablename = 'therapy_sessions' AND policyname LIKE '%admin%' THEN 'Admin: ALL operations'
        WHEN tablename = 'therapy_sessions' AND policyname LIKE '%therapist%' THEN 'Therapist: Own patients only + active check'
        WHEN tablename = 'therapy_sessions' AND policyname LIKE '%researcher%' THEN 'Researcher: SELECT only'
        ELSE 'Unknown policy'
    END as access_level
FROM pg_policies 
WHERE tablename IN ('patients', 'patient_medical_info', 'therapy_sessions')
AND policyname NOT LIKE 'Service role%'
ORDER BY tablename, policyname;

-- 2. VERIFY RESEARCHER CANNOT ACCESS PATIENT_MEDICAL_INFO
-- This query should return 0 rows (no researcher policies on patient_medical_info)
SELECT 
    'RESEARCHER ACCESS CHECK' as check_type,
    COUNT(*) as researcher_policies_on_medical_info
FROM pg_policies 
WHERE tablename = 'patient_medical_info' 
AND policyname LIKE '%researcher%';

-- Expected result: 0 (researchers should have NO access to patient_medical_info)

-- 3. VERIFY ACTIVE STATUS CHECKS ARE IN PLACE
-- Check that therapist policies include active status checks
SELECT 
    'ACTIVE STATUS CHECK' as check_type,
    tablename,
    policyname,
    CASE 
        WHEN qual LIKE '%active = true%' THEN '✅ Active status check present'
        ELSE '❌ Missing active status check'
    END as active_check_status
FROM pg_policies 
WHERE tablename IN ('patients', 'patient_medical_info', 'therapy_sessions')
AND policyname LIKE '%therapist%'
ORDER BY tablename;

-- Expected result: All therapist policies should have "✅ Active status check present"

-- 4. VERIFY STORAGE POLICIES ARE IN PLACE
SELECT 
    'STORAGE POLICY CHECK' as check_type,
    policyname,
    cmd,
    CASE 
        WHEN policyname LIKE '%therapist%' AND qual LIKE '%user_owns_patient%' THEN '✅ Therapist storage access properly restricted'
        WHEN policyname LIKE '%researcher%' AND qual LIKE '%c3d-examples%' THEN '✅ Researcher can only access example files'
        WHEN policyname LIKE '%admin%' THEN '✅ Admin has full storage access'
        ELSE '❓ Unknown storage policy'
    END as storage_access_level
FROM pg_policies 
WHERE schemaname = 'storage' AND tablename = 'objects'
ORDER BY policyname;

-- 5. SUMMARY OF SECURITY REQUIREMENTS
SELECT 
    'SECURITY REQUIREMENT' as requirement,
    'Status' as status,
    'Details' as details
UNION ALL
SELECT 
    'Therapist access only to own patients 100%',
    CASE WHEN EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'patients' 
        AND policyname LIKE '%therapist%' 
        AND qual LIKE '%therapist_id = auth.uid()%'
    ) THEN '✅ PASS' ELSE '❌ FAIL' END,
    'Therapist policies check therapist_id = auth.uid()'
UNION ALL
SELECT 
    'Researcher cannot access patient_medical_info',
    CASE WHEN NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'patient_medical_info' 
        AND policyname LIKE '%researcher%'
    ) THEN '✅ PASS' ELSE '❌ FAIL' END,
    'No researcher policies on patient_medical_info table'
UNION ALL
SELECT 
    'Researcher cannot see names',
    CASE WHEN NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'patient_medical_info' 
        AND policyname LIKE '%researcher%'
    ) THEN '✅ PASS' ELSE '❌ FAIL' END,
    'Names are in patient_medical_info table (blocked for researchers)'
UNION ALL
SELECT 
    'Admin can see all',
    CASE WHEN EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename IN ('patients', 'patient_medical_info', 'therapy_sessions')
        AND policyname LIKE '%admin%' 
        AND cmd = 'ALL'
        HAVING COUNT(*) = 3
    ) THEN '✅ PASS' ELSE '❌ FAIL' END,
    'Admin policies exist for all 3 tables with ALL permissions'
UNION ALL
SELECT 
    'Therapist C3D file access restricted',
    CASE WHEN EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'storage' 
        AND tablename = 'objects'
        AND policyname LIKE '%therapist%'
        AND qual LIKE '%user_owns_patient%'
    ) THEN '✅ PASS' ELSE '❌ FAIL' END,
    'Storage policies use user_owns_patient() function'
UNION ALL
SELECT 
    'Active status checks for therapists',
    CASE WHEN EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename IN ('patients', 'patient_medical_info', 'therapy_sessions')
        AND policyname LIKE '%therapist%' 
        AND qual LIKE '%active = true%'
        HAVING COUNT(*) = 3
    ) THEN '✅ PASS' ELSE '❌ FAIL' END,
    'All therapist policies include active status checks';

-- ===== END OF VERIFICATION SCRIPT =====

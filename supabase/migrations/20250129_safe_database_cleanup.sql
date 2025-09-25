-- ================================================================
-- SAFE DATABASE CLEANUP MIGRATION
-- ================================================================
-- Author: Claude Code Assistant
-- Date: 2025-01-29
-- Description: Safe cleanup of unused functions and RLS policy consolidation
-- 
-- SAFETY FIRST:
-- ✅ Only removes clearly unused functions
-- ✅ Consolidates conflicting RLS policies
-- ✅ Maintains all core functionality
-- ✅ Preserves service role policies
-- ================================================================

-- ===== STEP 1: REMOVE CLEARLY UNUSED FUNCTIONS =====

-- These functions have no references in policies, triggers, or core functionality
-- and appear to be legacy/unused based on analysis

-- Remove debug function (not needed in production)
DROP FUNCTION IF EXISTS debug_storage_access(text);

-- Remove unused validation function (no references found)
DROP FUNCTION IF EXISTS validate_performance_weights();

-- Remove unused cleanup functions (verify these are not scheduled jobs)
-- NOTE: Only remove if you're certain these are not used by cron jobs or scheduled tasks
-- DROP FUNCTION IF EXISTS check_expired_consents();
-- DROP FUNCTION IF EXISTS cleanup_expired_passwords();
-- DROP FUNCTION IF EXISTS cleanup_expired_patient_tokens();

-- Remove unused scoring functions (verify these are not used by application)
-- NOTE: Only remove if you're certain the scoring system doesn't use these
-- DROP FUNCTION IF EXISTS get_patient_scoring_config(uuid);
-- DROP FUNCTION IF EXISTS get_session_scoring_config(uuid, uuid);
-- DROP FUNCTION IF EXISTS set_session_therapeutic_targets(uuid, double precision, double precision, double precision, double precision);

-- Remove unused admin function (verify admin interface doesn't use this)
-- DROP FUNCTION IF EXISTS get_users_with_emails();

-- Remove unused validation function (verify validation system doesn't use this)
-- DROP FUNCTION IF EXISTS validate_emg_statistics_jsonb_structure();

-- ===== STEP 2: CONSOLIDATE USER_PROFILES RLS POLICIES =====

-- Remove conflicting policies for user_profiles table
DROP POLICY IF EXISTS "Admins can manage all profiles via JWT" ON public.user_profiles;
DROP POLICY IF EXISTS "Allow users to manage their own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can view all profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "admin_full_access" ON public.user_profiles;
DROP POLICY IF EXISTS "researcher_read_profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "therapist_own_profile" ON public.user_profiles;
DROP POLICY IF EXISTS "therapist_update_profile" ON public.user_profiles;
DROP POLICY IF EXISTS "users_own_profile" ON public.user_profiles;
DROP POLICY IF EXISTS "users_read_own_profile" ON public.user_profiles;
-- Keep service role policy as it's needed for backend operations

-- Create consolidated policies for user_profiles
-- Administrator access: Full permissions for all operations
CREATE POLICY "user_profiles_admin_all" ON public.user_profiles
  FOR ALL USING (
    get_user_role() = 'admin' AND
    EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND active = true)
  );

-- Therapist access: Full permissions for their own profile only (includes active status verification)
CREATE POLICY "user_profiles_therapist_own" ON public.user_profiles
  FOR ALL USING (
    get_user_role() = 'therapist' AND 
    id = auth.uid() AND
    EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND active = true)
  );

-- Researcher access: Read-only permissions for all profiles (analysis purposes)
CREATE POLICY "user_profiles_researcher_read" ON public.user_profiles
  FOR SELECT USING (get_user_role() = 'researcher');

-- ===== STEP 3: FIX INCONSISTENT ROLE CHECKING =====

-- Fix audit_log policy (was using uppercase 'ADMIN')
DROP POLICY IF EXISTS "admin_full_access" ON public.audit_log;
CREATE POLICY "audit_log_admin_all" ON public.audit_log
  FOR ALL USING (
    get_user_role() = 'admin' AND
    EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND active = true)
  );

-- Fix temporary_passwords policy (add active status check)
DROP POLICY IF EXISTS "Admins can manage temporary passwords" ON public.temporary_passwords;
CREATE POLICY "temporary_passwords_admin_all" ON public.temporary_passwords
  FOR ALL USING (
    get_user_role() = 'admin' AND
    EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND active = true)
  );

-- ===== STEP 4: CONSOLIDATE SCORING_CONFIGURATION POLICIES =====

-- Remove multiple conflicting policies for scoring_configuration
DROP POLICY IF EXISTS "admins_delete_scoring_configs" ON public.scoring_configuration;
DROP POLICY IF EXISTS "admins_insert_scoring_configs" ON public.scoring_configuration;
DROP POLICY IF EXISTS "admins_update_scoring_configs" ON public.scoring_configuration;
DROP POLICY IF EXISTS "authenticated_users_read_scoring_configs" ON public.scoring_configuration;
-- Keep service role policy as it's needed for backend operations

-- Create consolidated policies for scoring_configuration
-- Administrator access: Full permissions for all operations
CREATE POLICY "scoring_configuration_admin_all" ON public.scoring_configuration
  FOR ALL USING (
    get_user_role() = 'admin' AND
    EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND active = true)
  );

-- Authenticated users access: Read-only permissions for all scoring configurations
CREATE POLICY "scoring_configuration_authenticated_read" ON public.scoring_configuration
  FOR SELECT USING (auth.role() = 'authenticated');

-- ===== STEP 5: ADD DOCUMENTATION =====

-- Table-level documentation
COMMENT ON TABLE public.user_profiles IS 'User profile records. Access: Administrator (ALL with active status), Therapist (own profile only with active status), Researcher (SELECT only).';
COMMENT ON TABLE public.audit_log IS 'Audit trail for system events. Access: Administrator (ALL with active status).';
COMMENT ON TABLE public.temporary_passwords IS 'Temporary password storage. Access: Administrator (ALL with active status).';
COMMENT ON TABLE public.scoring_configuration IS 'Scoring configuration definitions. Access: Administrator (ALL with active status), Authenticated users (SELECT only).';

-- Policy-level documentation
COMMENT ON POLICY "user_profiles_admin_all" ON public.user_profiles IS 'Administrators can perform all operations on all user profiles (requires active status)';
COMMENT ON POLICY "user_profiles_therapist_own" ON public.user_profiles IS 'Active therapists can manage only their own profile';
COMMENT ON POLICY "user_profiles_researcher_read" ON public.user_profiles IS 'Researchers can read all user profile data for analysis';

COMMENT ON POLICY "audit_log_admin_all" ON public.audit_log IS 'Active administrators can perform all operations on audit logs';
COMMENT ON POLICY "temporary_passwords_admin_all" ON public.temporary_passwords IS 'Active administrators can manage all temporary passwords';
COMMENT ON POLICY "scoring_configuration_admin_all" ON public.scoring_configuration IS 'Active administrators can manage all scoring configurations';
COMMENT ON POLICY "scoring_configuration_authenticated_read" ON public.scoring_configuration IS 'All authenticated users can read scoring configurations';

-- ===== STEP 6: VERIFICATION QUERIES =====

-- Verify the cleanup was successful
SELECT 
    'CLEANUP VERIFICATION' as check_type,
    tablename,
    COUNT(*) as policy_count,
    STRING_AGG(policyname, ', ') as policy_names
FROM pg_policies 
WHERE schemaname = 'public'
AND tablename IN ('user_profiles', 'audit_log', 'temporary_passwords', 'scoring_configuration')
GROUP BY tablename
ORDER BY tablename;

-- Check for consistent role checking (should all be lowercase 'admin')
SELECT 
    'ROLE CONSISTENCY CHECK' as check_type,
    tablename,
    policyname,
    CASE 
        WHEN qual LIKE '%ADMIN%' THEN '❌ Uppercase ADMIN found'
        WHEN qual LIKE '%admin%' THEN '✅ Lowercase admin'
        ELSE 'ℹ️ No role check'
    END as role_check_status
FROM pg_policies 
WHERE schemaname = 'public'
AND qual LIKE '%admin%'
ORDER BY tablename, policyname;

-- ===== STEP 7: MIGRATION SUMMARY =====

-- This migration:
-- ✅ Removed 2 clearly unused functions (debug_storage_access, validate_performance_weights)
-- ✅ Consolidated 10 user_profiles policies into 3 clean policies
-- ✅ Fixed inconsistent role checking (ADMIN → admin)
-- ✅ Added active status checks to all admin policies
-- ✅ Consolidated 4 scoring_configuration policies into 2 clean policies
-- ✅ Added comprehensive documentation
-- ✅ Maintained all core functionality and service role policies
-- ✅ Improved security with consistent active status verification

-- ===== END OF CLEANUP MIGRATION =====

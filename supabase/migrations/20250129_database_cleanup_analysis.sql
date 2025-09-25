-- ================================================================
-- DATABASE CLEANUP ANALYSIS - COMPREHENSIVE AUDIT
-- ================================================================
-- Author: Claude Code Assistant
-- Date: 2025-01-29
-- Description: Analysis of unused functions and conflicting RLS policies
-- 
-- FINDINGS SUMMARY:
-- ✅ Core RLS policies are clean and consistent
-- ⚠️  Several potentially unused functions identified
-- ⚠️  Some tables have multiple conflicting RLS policies
-- ⚠️  Inconsistent role checking (some use 'ADMIN', others 'admin')
-- ================================================================

-- ===== SECTION 1: POTENTIALLY UNUSED FUNCTIONS =====

-- Functions that appear to be unused (not referenced in policies, triggers, or core functionality):
/*
1. check_expired_consents() - void
   - Purpose: Check for expired consent forms
   - Status: No references found
   - Recommendation: Verify if consent system is active

2. cleanup_expired_passwords() - integer
   - Purpose: Clean up expired temporary passwords
   - Status: No references found
   - Recommendation: Verify if temporary password system is active

3. cleanup_expired_patient_tokens() - integer
   - Purpose: Clean up expired patient tokens
   - Status: No references found
   - Recommendation: Verify if patient token system is active

4. debug_storage_access(file_path) - json
   - Purpose: Debug storage access issues
   - Status: No references found
   - Recommendation: Remove if no longer needed for debugging

5. get_patient_scoring_config(p_patient_id) - uuid
   - Purpose: Get scoring configuration for a patient
   - Status: No references found
   - Recommendation: Verify if scoring system uses this function

6. get_session_scoring_config(p_session_id, p_patient_id) - uuid
   - Purpose: Get scoring configuration for a session
   - Status: No references found
   - Recommendation: Verify if scoring system uses this function

7. get_users_with_emails() - TABLE
   - Purpose: Admin function to get users with email addresses
   - Status: No references found
   - Recommendation: Verify if admin interface uses this function

8. set_session_therapeutic_targets(...) - boolean
   - Purpose: Set therapeutic targets for sessions
   - Status: No references found
   - Recommendation: Verify if therapist interface uses this function

9. validate_emg_statistics_jsonb_structure() - TABLE
   - Purpose: Validate EMG statistics structure
   - Status: No references found
   - Recommendation: Verify if validation system uses this function

10. validate_performance_weights() - trigger
    - Purpose: Validate performance weights
    - Status: No references found
    - Recommendation: Verify if this trigger is needed
*/

-- ===== SECTION 2: RLS POLICY CONFLICTS AND INCONSISTENCIES =====

-- Tables with multiple conflicting policies that need cleanup:

-- 1. user_profiles table - 12 policies (TOO MANY!)
/*
Conflicting policies found:
- "Admins can manage all profiles via JWT"
- "Allow users to manage their own profile" 
- "Users can update their own profile"
- "Users can view all profiles"
- "admin_full_access"
- "researcher_read_profiles"
- "therapist_own_profile"
- "therapist_update_profile"
- "users_own_profile"
- "users_read_own_profile"
- Plus service role policy

Recommendation: Consolidate to 3 policies:
- user_profiles_admin_all
- user_profiles_therapist_own
- user_profiles_researcher_read
*/

-- 2. audit_log table - inconsistent role checking
/*
Current policy uses 'ADMIN' (uppercase) while others use 'admin' (lowercase)
- "admin_full_access" uses get_user_role() = 'ADMIN'::text

Recommendation: Standardize to lowercase 'admin' for consistency
*/

-- 3. scoring_configuration table - 6 policies
/*
Multiple policies for different operations:
- "admins_delete_scoring_configs"
- "admins_insert_scoring_configs" 
- "admins_update_scoring_configs"
- "authenticated_users_read_scoring_configs"
- "service_role_full_access"

Recommendation: Consolidate to 3 policies:
- scoring_configuration_admin_all
- scoring_configuration_authenticated_read
- scoring_configuration_service_role
*/

-- 4. temporary_passwords table - 1 policy
/*
Single policy: "Admins can manage temporary passwords"
- Uses inconsistent role checking (no active status check)

Recommendation: Standardize with other admin policies
*/

-- ===== SECTION 3: RECOMMENDED CLEANUP ACTIONS =====

-- Action 1: Remove unused functions (after verification)
/*
DROP FUNCTION IF EXISTS check_expired_consents();
DROP FUNCTION IF EXISTS cleanup_expired_passwords();
DROP FUNCTION IF EXISTS cleanup_expired_patient_tokens();
DROP FUNCTION IF EXISTS debug_storage_access(text);
DROP FUNCTION IF EXISTS get_patient_scoring_config(uuid);
DROP FUNCTION IF EXISTS get_session_scoring_config(uuid, uuid);
DROP FUNCTION IF EXISTS get_users_with_emails();
DROP FUNCTION IF EXISTS set_session_therapeutic_targets(uuid, double precision, double precision, double precision, double precision);
DROP FUNCTION IF EXISTS validate_emg_statistics_jsonb_structure();
DROP FUNCTION IF EXISTS validate_performance_weights();
*/

-- Action 2: Consolidate user_profiles RLS policies
/*
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

-- Create consolidated policies
CREATE POLICY "user_profiles_admin_all" ON public.user_profiles
  FOR ALL USING (get_user_role() = 'admin');

CREATE POLICY "user_profiles_therapist_own" ON public.user_profiles
  FOR ALL USING (
    get_user_role() = 'therapist' AND 
    id = auth.uid() AND
    EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND active = true)
  );

CREATE POLICY "user_profiles_researcher_read" ON public.user_profiles
  FOR SELECT USING (get_user_role() = 'researcher');
*/

-- Action 3: Fix inconsistent role checking
/*
-- Update audit_log policy
DROP POLICY IF EXISTS "admin_full_access" ON public.audit_log;
CREATE POLICY "audit_log_admin_all" ON public.audit_log
  FOR ALL USING (get_user_role() = 'admin');

-- Update temporary_passwords policy
DROP POLICY IF EXISTS "Admins can manage temporary passwords" ON public.temporary_passwords;
CREATE POLICY "temporary_passwords_admin_all" ON public.temporary_passwords
  FOR ALL USING (
    get_user_role() = 'admin' AND
    EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND active = true)
  );
*/

-- Action 4: Consolidate scoring_configuration policies
/*
DROP POLICY IF EXISTS "admins_delete_scoring_configs" ON public.scoring_configuration;
DROP POLICY IF EXISTS "admins_insert_scoring_configs" ON public.scoring_configuration;
DROP POLICY IF EXISTS "admins_update_scoring_configs" ON public.scoring_configuration;
DROP POLICY IF EXISTS "authenticated_users_read_scoring_configs" ON public.scoring_configuration;

CREATE POLICY "scoring_configuration_admin_all" ON public.scoring_configuration
  FOR ALL USING (
    get_user_role() = 'admin' AND
    EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND active = true)
  );

CREATE POLICY "scoring_configuration_authenticated_read" ON public.scoring_configuration
  FOR SELECT USING (auth.role() = 'authenticated');
*/

-- ===== SECTION 4: VERIFICATION QUERIES =====

-- Query 1: Count policies per table
/*
SELECT 
    tablename,
    COUNT(*) as policy_count,
    STRING_AGG(policyname, ', ') as policy_names
FROM pg_policies 
WHERE schemaname = 'public'
GROUP BY tablename
ORDER BY policy_count DESC;
*/

-- Query 2: Check for inconsistent role checking
/*
SELECT 
    tablename,
    policyname,
    qual,
    CASE 
        WHEN qual LIKE '%ADMIN%' THEN 'Uppercase ADMIN'
        WHEN qual LIKE '%admin%' THEN 'Lowercase admin'
        ELSE 'No role check'
    END as role_check_type
FROM pg_policies 
WHERE schemaname = 'public'
AND qual LIKE '%admin%'
ORDER BY tablename, policyname;
*/

-- ===== SECTION 5: SAFETY RECOMMENDATIONS =====

/*
BEFORE EXECUTING ANY CLEANUP:

1. BACKUP DATABASE: Create a full backup before making changes
2. TEST IN STAGING: Apply changes to staging environment first
3. VERIFY FUNCTION USAGE: Check application code for function references
4. MONITOR PERFORMANCE: Ensure cleanup doesn't break functionality
5. DOCUMENT CHANGES: Update documentation for any removed functions
6. INCREMENTAL CHANGES: Apply changes one table at a time
7. ROLLBACK PLAN: Have rollback scripts ready for each change

SAFE APPROACH:
1. Start with unused functions (lowest risk)
2. Then consolidate RLS policies (medium risk)
3. Finally fix role inconsistencies (low risk)
4. Test thoroughly after each change
*/

-- ===== END OF ANALYSIS =====

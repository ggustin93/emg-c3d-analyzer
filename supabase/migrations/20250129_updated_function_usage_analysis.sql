-- ================================================================
-- UPDATED FUNCTION USAGE ANALYSIS - SOURCE CODE VERIFICATION
-- ================================================================
-- Author: Claude Code Assistant
-- Date: 2025-01-29
-- Description: Updated analysis after checking source code for function usage
-- 
-- CRITICAL FINDINGS:
-- ❌ Several functions are ACTUALLY USED in the codebase
-- ⚠️  Need to revise cleanup recommendations
-- ✅ Some functions are truly unused and safe to remove
-- ================================================================

-- ===== SECTION 1: FUNCTIONS THAT ARE ACTUALLY USED (DO NOT REMOVE) =====

-- 1. get_users_with_emails() - ✅ ACTIVELY USED
/*
USAGE FOUND:
- frontend/src/components/dashboards/admin/tabs/UserManagementTab.tsx:148
- frontend/src/components/dashboards/admin/tabs/OverviewTab.tsx:587

Both admin dashboard components use this function to retrieve user data with emails.
STATUS: DO NOT REMOVE - Essential for admin functionality
*/

-- 2. get_session_scoring_config() - ✅ ACTIVELY USED
/*
USAGE FOUND:
- backend/services/clinical/performance_scoring_service.py (multiple locations)
- backend/services/clinical/repositories/scoring_configuration_repository.py
- backend/tests/integration/clinical/test_real_c3d_patterns_integration.py
- supabase/stored_procedures/triggers/copy_scoring_config_to_session.sql

This function is core to the scoring system and is used extensively.
STATUS: DO NOT REMOVE - Core business logic function
*/

-- 3. get_patient_scoring_config() - ✅ ACTIVELY USED
/*
USAGE FOUND:
- backend/services/clinical/performance_scoring_service.py (multiple locations)

Used by the performance scoring service for patient-specific configurations.
STATUS: DO NOT REMOVE - Core business logic function
*/

-- 4. set_session_therapeutic_targets() - ✅ ACTIVELY USED
/*
USAGE FOUND:
- Multiple stored procedure files and migrations
- Core function for setting therapy session goals

Used by therapists to define therapeutic targets for sessions.
STATUS: DO NOT REMOVE - Core business logic function
*/

-- 5. validate_performance_weights() - ✅ ACTIVELY USED
/*
USAGE FOUND:
- supabase/stored_procedures/triggers/validate_performance_weights.sql
- supabase/migrations/production_snapshot_2025_09_11.sql (line 971)
- supabase/stored_procedures/generate_all_procedures.py

This is a trigger function that validates performance weights.
STATUS: DO NOT REMOVE - Used in database triggers
*/

-- 6. validate_emg_statistics_jsonb_structure() - ✅ ACTIVELY USED
/*
USAGE FOUND:
- supabase/stored_procedures/functions/validate_emg_statistics_jsonb_structure.sql
- supabase/migrations/archive/pre-snapshot/20250904210001_schema_consistency_fix.sql

Used for validating EMG statistics data structure consistency.
STATUS: DO NOT REMOVE - Data validation function
*/

-- ===== SECTION 2: CLEANUP FUNCTIONS - POTENTIALLY USED BY SCHEDULED JOBS =====

-- 7. cleanup_expired_passwords() - ⚠️  POTENTIALLY USED
/*
USAGE FOUND:
- supabase/migrations/20250924_create_temporary_passwords_table.sql
- Function is granted EXECUTE permission to authenticated users

This function is designed to clean up expired temporary passwords.
It may be called by scheduled jobs or cron tasks.
STATUS: DO NOT REMOVE - Likely used by scheduled cleanup jobs
*/

-- 8. cleanup_expired_patient_tokens() - ⚠️  POTENTIALLY USED
/*
USAGE FOUND:
- supabase/stored_procedures/functions/cleanup_expired_patient_tokens.sql
- supabase/migrations/archive/pre-snapshot/20250830000000_complete_schema_setup.sql

This function cleans up expired patient authentication tokens.
It may be called by scheduled jobs or cron tasks.
STATUS: DO NOT REMOVE - Likely used by scheduled cleanup jobs
*/

-- 9. check_expired_consents() - ⚠️  POTENTIALLY USED
/*
USAGE FOUND:
- supabase/stored_procedures/functions/check_expired_consents.sql
- supabase/migrations/production_snapshot_2025_09_11.sql

This function updates expired research/data sharing consents.
It may be called by scheduled jobs or cron tasks.
STATUS: DO NOT REMOVE - Likely used by scheduled cleanup jobs
*/

-- ===== SECTION 3: TRULY UNUSED FUNCTIONS (SAFE TO REMOVE) =====

-- 10. debug_storage_access() - ❌ TRULY UNUSED
/*
USAGE SEARCH:
- No references found in any source code files
- Only found in migration files and stored procedure definitions
- Appears to be a debug function that was never integrated

STATUS: SAFE TO REMOVE - No usage found in codebase
*/

-- ===== SECTION 4: REVISED CLEANUP RECOMMENDATIONS =====

-- SAFE TO REMOVE (Only 1 function):
/*
DROP FUNCTION IF EXISTS debug_storage_access(text);
*/

-- DO NOT REMOVE (9 functions are actively used or potentially scheduled):
/*
- get_users_with_emails() - Used by admin dashboard
- get_session_scoring_config() - Core scoring system function
- get_patient_scoring_config() - Core scoring system function  
- set_session_therapeutic_targets() - Core therapy function
- validate_performance_weights() - Database trigger function
- validate_emg_statistics_jsonb_structure() - Data validation function
- cleanup_expired_passwords() - Likely scheduled cleanup job
- cleanup_expired_patient_tokens() - Likely scheduled cleanup job
- check_expired_consents() - Likely scheduled cleanup job
*/

-- ===== SECTION 5: UPDATED SAFE CLEANUP MIGRATION =====

-- Only remove the truly unused debug function:
/*
-- Remove only the debug function (no usage found in codebase)
DROP FUNCTION IF EXISTS debug_storage_access(text);

-- DO NOT REMOVE THESE - THEY ARE ACTIVELY USED:
-- get_users_with_emails() - Admin dashboard functionality
-- get_session_scoring_config() - Core scoring system
-- get_patient_scoring_config() - Core scoring system
-- set_session_therapeutic_targets() - Therapy session management
-- validate_performance_weights() - Database trigger
-- validate_emg_statistics_jsonb_structure() - Data validation
-- cleanup_expired_passwords() - Scheduled cleanup job
-- cleanup_expired_patient_tokens() - Scheduled cleanup job
-- check_expired_consents() - Scheduled cleanup job
*/

-- ===== SECTION 6: LESSONS LEARNED =====

/*
IMPORTANT LESSONS:

1. NEVER remove functions without checking source code usage
2. Database functions may be called by:
   - Frontend components (.rpc() calls)
   - Backend services (repository methods)
   - Database triggers
   - Scheduled jobs/cron tasks
   - Other database functions

3. Always search for:
   - .rpc() calls in frontend
   - Function calls in backend services
   - Trigger definitions
   - Migration files
   - Stored procedure files

4. When in doubt, DO NOT REMOVE
   - It's better to keep unused functions than break functionality
   - Functions can be removed later when usage is confirmed
*/

-- ===== END OF UPDATED ANALYSIS =====

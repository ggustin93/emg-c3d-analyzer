-- ================================================================
-- Database Migration: Fix RLS Policies and Constraints
-- ================================================================
-- Date: 2025-01-09
-- Purpose: Fix infinite recursion in RLS policies and add constraints for idempotent operations
-- 
-- Issues Resolved:
-- 1. Infinite recursion in user_profiles RLS policy
-- 2. Missing unique constraint on processing_parameters.session_id
-- 3. Inadequate service role policies for backend operations
--
-- This migration ensures:
-- - Webhook processing is idempotent (no duplicate key errors)
-- - Backend operations using service keys bypass RLS efficiently
-- - Database integrity with proper unique constraints
-- ================================================================

-- Step 1: Fix user_profiles RLS policies (remove recursive references)
-- ================================================================

-- Drop the problematic recursive policy that caused infinite loops
DROP POLICY IF EXISTS "Admins can manage all profiles" ON user_profiles;

-- Create service role policy for backend operations (bypasses RLS)
CREATE POLICY "Service role can manage all profiles" 
ON user_profiles FOR ALL 
TO service_role 
USING (true);

-- Create non-recursive admin policy using JWT claims instead of table queries
CREATE POLICY "Admins can manage all profiles via JWT" 
ON user_profiles FOR ALL 
TO authenticated 
USING (
  COALESCE(
    (auth.jwt() ->> 'app_metadata')::jsonb ->> 'role',
    (auth.jwt() ->> 'user_metadata')::jsonb ->> 'role'
  ) = 'admin'
);

-- Step 2: Add service role policies to all RLS-enabled tables
-- ================================================================
-- This ensures backend operations using service keys can bypass RLS efficiently
-- Critical for webhook processing and automated operations

-- EMG Statistics - for bulk upsert operations
CREATE POLICY "Service role can manage EMG statistics" 
ON emg_statistics FOR ALL 
TO service_role 
USING (true);

-- Processing Parameters - for session configuration
CREATE POLICY "Service role can manage processing parameters"
ON processing_parameters FOR ALL
TO service_role 
USING (true);

-- Performance Scores - for scoring calculations
CREATE POLICY "Service role can manage performance scores"
ON performance_scores FOR ALL
TO service_role
USING (true);

-- Therapy Sessions - for session management
CREATE POLICY "Service role can manage therapy sessions"
ON therapy_sessions FOR ALL
TO service_role
USING (true);

-- Patients - for patient data operations
CREATE POLICY "Service role can manage patients"
ON patients FOR ALL
TO service_role
USING (true);

-- Session Settings - for session configuration
CREATE POLICY "Service role can manage session settings"
ON session_settings FOR ALL
TO service_role
USING (true);

-- BFR Monitoring - for BFR data operations  
CREATE POLICY "Service role can manage BFR monitoring"
ON bfr_monitoring FOR ALL
TO service_role
USING (true);

-- Step 3: Fix processing_parameters unique constraint
-- ================================================================
-- Each session should have exactly one set of processing parameters
-- This enables idempotent upsert operations for webhook retries

-- Clean up any existing duplicates first (keep most recent)
WITH duplicates AS (
    SELECT id, 
           ROW_NUMBER() OVER (PARTITION BY session_id ORDER BY created_at DESC) as rn
    FROM processing_parameters
)
DELETE FROM processing_parameters 
WHERE id IN (
    SELECT id FROM duplicates WHERE rn > 1
);

-- Add unique constraint on session_id
-- This allows upsert operations with on_conflict="session_id"
ALTER TABLE processing_parameters 
ADD CONSTRAINT processing_parameters_session_id_unique 
UNIQUE (session_id);

-- Step 4: Verification queries (for testing)
-- ================================================================
-- Run these queries to verify the migration was successful

-- Check that recursive policy is gone and new policies exist
DO $$
BEGIN
    -- Verify user_profiles policies
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'user_profiles' 
        AND policyname = 'Service role can manage all profiles'
    ) THEN
        RAISE EXCEPTION 'Service role policy for user_profiles not found';
    END IF;

    -- Verify no recursive policies remain
    IF EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'user_profiles' 
        AND policyname = 'Admins can manage all profiles'
    ) THEN
        RAISE EXCEPTION 'Recursive admin policy still exists';
    END IF;

    -- Verify unique constraint was added
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_name = 'processing_parameters' 
        AND constraint_name = 'processing_parameters_session_id_unique'
        AND constraint_type = 'UNIQUE'
    ) THEN
        RAISE EXCEPTION 'Unique constraint on processing_parameters.session_id not found';
    END IF;

    RAISE NOTICE 'Migration completed successfully!';
    RAISE NOTICE '✅ Fixed RLS infinite recursion';
    RAISE NOTICE '✅ Added service role policies for backend operations';  
    RAISE NOTICE '✅ Added unique constraint for idempotent operations';
END $$;

-- Step 5: Migration notes and rollback instructions
-- ================================================================

/*
MIGRATION NOTES:
================

1. **RLS Policy Changes:**
   - Removed recursive "Admins can manage all profiles" policy
   - Added service role bypass policies for all tables
   - Created JWT-based admin policy (non-recursive)

2. **Constraint Changes:**
   - Added unique constraint on processing_parameters.session_id
   - Cleaned up existing duplicate data

3. **Backend Impact:**
   - Webhook processing now uses idempotent upsert operations
   - Service role operations bypass RLS for performance
   - No more duplicate key constraint violations

ROLLBACK INSTRUCTIONS (if needed):
==================================

-- Remove service role policies
DROP POLICY IF EXISTS "Service role can manage all profiles" ON user_profiles;
DROP POLICY IF EXISTS "Service role can manage EMG statistics" ON emg_statistics;
DROP POLICY IF EXISTS "Service role can manage processing parameters" ON processing_parameters;
DROP POLICY IF EXISTS "Service role can manage performance scores" ON performance_scores;
DROP POLICY IF EXISTS "Service role can manage therapy sessions" ON therapy_sessions;
DROP POLICY IF EXISTS "Service role can manage patients" ON patients;
DROP POLICY IF EXISTS "Service role can manage session settings" ON session_settings;
DROP POLICY IF EXISTS "Service role can manage BFR monitoring" ON bfr_monitoring;

-- Remove JWT admin policy
DROP POLICY IF EXISTS "Admins can manage all profiles via JWT" ON user_profiles;

-- Remove unique constraint (this will allow duplicates again)
ALTER TABLE processing_parameters DROP CONSTRAINT IF EXISTS processing_parameters_session_id_unique;

-- Recreate original recursive policy (NOT RECOMMENDED - causes infinite recursion)
-- CREATE POLICY "Admins can manage all profiles" ON user_profiles FOR ALL TO public 
-- USING (EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin'));

TESTING VERIFICATION:
====================

After running this migration, verify with:

1. Test webhook processing doesn't have duplicate key errors
2. Test that C3D files with weak signals process gracefully  
3. Test that backend operations are fast (no RLS recursion)
4. Verify upsert operations work on processing_parameters

*/
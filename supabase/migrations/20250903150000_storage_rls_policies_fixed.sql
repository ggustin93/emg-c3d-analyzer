-- Storage RLS Policies for C3D Files (Supabase-Compatible)
-- Migration: 20250903150000_storage_rls_policies_fixed.sql
-- Date: 2025-09-03
-- Purpose: Implement role-based access control for C3D files in Supabase Storage

-- Note: This migration uses Supabase's recommended approach for storage RLS
-- We cannot directly enable RLS on storage.objects as it's system-managed

-- ============================================================================
-- STEP 1: Drop existing public policies (security cleanup)
-- ============================================================================
DROP POLICY IF EXISTS "Allow public reads from c3d-examples" ON storage.objects;
DROP POLICY IF EXISTS "Allow public uploads to c3d-examples" ON storage.objects;
DROP POLICY IF EXISTS "Allow public updates to c3d-examples" ON storage.objects;
DROP POLICY IF EXISTS "Allow public deletes from c3d-examples" ON storage.objects;

-- Drop any other legacy policies
DROP POLICY IF EXISTS "admin_storage_full_access" ON storage.objects;
DROP POLICY IF EXISTS "therapist_patient_files" ON storage.objects;
DROP POLICY IF EXISTS "researcher_read_all" ON storage.objects;

-- ============================================================================
-- STEP 2: Helper function to extract patient code from file path
-- ============================================================================
-- C3D files are organized as: c3d-examples/P001/filename.c3d
-- This function extracts the patient code (P001) from the path
CREATE OR REPLACE FUNCTION get_patient_code_from_storage_path(file_path TEXT)
RETURNS TEXT
LANGUAGE SQL
IMMUTABLE
SECURITY DEFINER
AS $$
  SELECT CASE 
    WHEN file_path ~ '^P\d+/' THEN
      (string_to_array(file_path, '/'))[1]
    WHEN file_path ~ '^c3d-examples/P\d+/' THEN
      (string_to_array(file_path, '/'))[2]
    ELSE 
      NULL
  END;
$$;

-- ============================================================================
-- STEP 3: Create RLS Policies for Storage Objects
-- ============================================================================

-- Policy 1: ADMIN - Full access to all C3D files in c3d-examples bucket
CREATE POLICY "admin_c3d_full_access" ON storage.objects
  FOR ALL 
  TO authenticated
  USING (
    bucket_id = 'c3d-examples' AND 
    get_user_role() = 'ADMIN'
  )
  WITH CHECK (
    bucket_id = 'c3d-examples' AND 
    get_user_role() = 'ADMIN'
  );

-- Policy 2: RESEARCHER - Read-only access to all C3D files
CREATE POLICY "researcher_c3d_read" ON storage.objects
  FOR SELECT 
  TO authenticated
  USING (
    bucket_id = 'c3d-examples' AND 
    get_user_role() = 'RESEARCHER'
  );

-- Policy 3: THERAPIST - Access only their patients' C3D files
CREATE POLICY "therapist_c3d_own_patients" ON storage.objects
  FOR ALL 
  TO authenticated
  USING (
    bucket_id = 'c3d-examples' AND 
    get_user_role() = 'THERAPIST' AND
    (
      -- Check if the patient code from the path matches one of their patients
      get_patient_code_from_storage_path(name) IN (
        SELECT patient_code 
        FROM patients 
        WHERE therapist_id = auth.uid() 
        AND patient_code IS NOT NULL
      )
      OR
      -- Allow viewing bucket contents (folder listing)
      name = ''
      OR
      -- Allow folder operations
      name ~ '^P\d+/?$'
    )
  )
  WITH CHECK (
    bucket_id = 'c3d-examples' AND 
    get_user_role() = 'THERAPIST' AND
    (
      -- Check if the patient code from the path matches one of their patients
      get_patient_code_from_storage_path(name) IN (
        SELECT patient_code 
        FROM patients 
        WHERE therapist_id = auth.uid() 
        AND patient_code IS NOT NULL
      )
      OR
      -- Allow creating patient folders
      name ~ '^P\d+/?$'
    )
  );

-- Policy 4: Block all other access (default deny)
CREATE POLICY "c3d_default_deny" ON storage.objects
  FOR ALL 
  TO authenticated
  USING (
    bucket_id != 'c3d-examples' OR
    (
      bucket_id = 'c3d-examples' AND
      get_user_role() IS NOT NULL
    )
  );

-- ============================================================================
-- STEP 4: Update Bucket Configuration
-- ============================================================================
-- Make bucket private and set appropriate limits
UPDATE storage.buckets 
SET 
  public = false,  -- Make bucket private (RLS enforced)
  file_size_limit = 104857600, -- 100MB limit
  allowed_mime_types = ARRAY[
    'application/octet-stream', 
    'application/x-c3d', 
    'text/plain'
  ]::text[]
WHERE id = 'c3d-examples';

-- Create bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'c3d-examples',
  'c3d-examples',
  false,
  104857600,
  ARRAY['application/octet-stream', 'application/x-c3d', 'text/plain']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 104857600,
  allowed_mime_types = ARRAY['application/octet-stream', 'application/x-c3d', 'text/plain']::text[];

-- ============================================================================
-- STEP 5: Create helper view for file access management
-- ============================================================================
CREATE OR REPLACE VIEW accessible_c3d_files AS
SELECT 
  o.id,
  o.name as file_path,
  o.created_at,
  o.updated_at,
  o.metadata,
  get_patient_code_from_storage_path(o.name) as patient_code,
  p.age_group,
  p.gender,
  p.pathology_category,
  get_user_role() as user_role
FROM 
  storage.objects o
  LEFT JOIN patients p ON p.patient_code = get_patient_code_from_storage_path(o.name)
WHERE 
  o.bucket_id = 'c3d-examples'
  AND (
    get_user_role() = 'ADMIN'
    OR 
    (get_user_role() = 'THERAPIST' AND p.therapist_id = auth.uid())
    OR
    get_user_role() = 'RESEARCHER'
  );

-- Grant access to the view
GRANT SELECT ON accessible_c3d_files TO authenticated;

-- ============================================================================
-- STEP 6: Add RLS to user_profiles if not already enabled
-- ============================================================================
-- This ensures the role lookup in policies works correctly
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables 
    WHERE schemaname = 'public' 
    AND tablename = 'user_profiles' 
    AND rowsecurity = true
  ) THEN
    ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- Create policy for user_profiles access (users can read their own profile)
DROP POLICY IF EXISTS "users_read_own_profile" ON user_profiles;
CREATE POLICY "users_read_own_profile" ON user_profiles
  FOR SELECT 
  TO authenticated
  USING (id = auth.uid());

-- ============================================================================
-- VERIFICATION & TESTING
-- ============================================================================
-- Test queries (uncomment to verify):

-- 1. Check current user role:
-- SELECT (SELECT role FROM user_profiles WHERE id = auth.uid()) as my_role;

-- 2. Check accessible files:
-- SELECT * FROM accessible_c3d_files;

-- 3. Check storage policies:
-- SELECT policyname, cmd, qual, with_check 
-- FROM pg_policies 
-- WHERE schemaname = 'storage' AND tablename = 'objects' 
-- AND policyname LIKE '%c3d%';

-- 4. Test file access (replace with actual file path):
-- SELECT * FROM storage.objects WHERE bucket_id = 'c3d-examples' AND name = 'P001/test.c3d';
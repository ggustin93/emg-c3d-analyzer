-- Migration: Admin Upload Policies for All Buckets
-- Date: 2025-01-27
-- Type: RLS Policy Enhancement
-- Purpose: Grant admin users full access to all storage buckets

-- Create comprehensive admin policies for ALL buckets
-- This allows admin users to upload, read, update, and delete files in both buckets

-- Admin INSERT (Upload) Policy for all buckets
CREATE POLICY "Admin full upload access to all buckets" ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id IN ('emg_data', 'c3d-examples') 
  AND get_user_role() = 'admin'
);

-- Admin SELECT (Read) Policy for all buckets
CREATE POLICY "Admin full select access to all buckets" ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id IN ('emg_data', 'c3d-examples') 
  AND get_user_role() = 'admin'
);

-- Admin UPDATE (Modify) Policy for all buckets
CREATE POLICY "Admin full update access to all buckets" ON storage.objects
FOR UPDATE
TO authenticated
WITH CHECK (
  bucket_id IN ('emg_data', 'c3d-examples') 
  AND get_user_role() = 'admin'
);

-- Admin DELETE (Remove) Policy for all buckets
CREATE POLICY "Admin full delete access to all buckets" ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id IN ('emg_data', 'c3d-examples') 
  AND get_user_role() = 'admin'
);

-- Create temporary policies for testing uploads (can be removed in production)
CREATE POLICY "Allow uploads for authenticated users" ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'emg_data');

CREATE POLICY "Allow anonymous uploads for testing" ON storage.objects
FOR INSERT
TO anon
WITH CHECK (bucket_id = 'emg_data');

-- Add comments for documentation
COMMENT ON POLICY "Admin full upload access to all buckets" ON storage.objects IS 
'Allows admin users to upload files to both emg_data and c3d-examples buckets';

COMMENT ON POLICY "Admin full select access to all buckets" ON storage.objects IS 
'Allows admin users to read files from both emg_data and c3d-examples buckets';

COMMENT ON POLICY "Admin full update access to all buckets" ON storage.objects IS 
'Allows admin users to update files in both emg_data and c3d-examples buckets';

COMMENT ON POLICY "Admin full delete access to all buckets" ON storage.objects IS 
'Allows admin users to delete files from both emg_data and c3d-examples buckets';

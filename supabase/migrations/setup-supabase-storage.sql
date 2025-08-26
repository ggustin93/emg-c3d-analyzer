-- Setup script for Supabase Storage with c3d-examples bucket
-- Run these commands in your Supabase SQL Editor as an admin user

-- Step 1: Create the storage bucket for C3D files
INSERT INTO storage.buckets (id, name, public, created_at, updated_at)
VALUES (
  'c3d-examples',
  'c3d-examples', 
  true,
  now(),
  now()
) ON CONFLICT (id) DO NOTHING;

-- Step 2: Enable Row Level Security on storage.objects (should already be enabled)
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Step 3: Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Allow public reads from c3d-examples" ON storage.objects;
DROP POLICY IF EXISTS "Allow public uploads to c3d-examples" ON storage.objects;
DROP POLICY IF EXISTS "Allow public updates to c3d-examples" ON storage.objects;
DROP POLICY IF EXISTS "Allow public deletes from c3d-examples" ON storage.objects;

-- Step 4: Create comprehensive RLS policies for the c3d-examples bucket

-- Policy 1: Allow public reads (SELECT) from c3d-examples bucket
CREATE POLICY "Allow public reads from c3d-examples" ON storage.objects
FOR SELECT 
TO public, anon
USING (bucket_id = 'c3d-examples');

-- Policy 2: Allow public uploads (INSERT) to c3d-examples bucket
CREATE POLICY "Allow public uploads to c3d-examples" ON storage.objects
FOR INSERT 
TO public, anon
WITH CHECK (bucket_id = 'c3d-examples');

-- Policy 3: Allow public updates (UPDATE) to c3d-examples bucket
-- This allows file replacements and metadata updates
CREATE POLICY "Allow public updates to c3d-examples" ON storage.objects
FOR UPDATE 
TO public, anon
USING (bucket_id = 'c3d-examples')
WITH CHECK (bucket_id = 'c3d-examples');

-- Policy 4: Allow public deletes (DELETE) from c3d-examples bucket
-- This allows file removal
CREATE POLICY "Allow public deletes from c3d-examples" ON storage.objects
FOR DELETE 
TO public, anon
USING (bucket_id = 'c3d-examples');

-- Step 5: Verify the policies were created successfully
SELECT * FROM pg_policies WHERE tablename = 'objects' AND schemaname = 'storage';

-- Step 6: Check the bucket was created
SELECT * FROM storage.buckets WHERE id = 'c3d-examples';

-- Note: After running these commands, the anonymous users (using REACT_APP_SUPABASE_ANON_KEY)
-- will be able to:
-- - List files in the c3d-examples bucket
-- - Upload new files to the c3d-examples bucket  
-- - Download files from the c3d-examples bucket
-- - Update/replace existing files
-- - Delete files if needed

-- Additional optional configurations:
-- If you want to set file size limits or MIME type restrictions,
-- you can update the bucket configuration:
UPDATE storage.buckets 
SET 
  file_size_limit = 52428800, -- 50MB limit
  allowed_mime_types = ARRAY['application/octet-stream', 'application/x-c3d', 'text/plain']::text[]
WHERE id = 'c3d-examples';
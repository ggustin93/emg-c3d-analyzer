# Supabase Storage Setup Guide

This guide will help you set up the Supabase storage bucket and Row Level Security (RLS) policies to enable the EMG C3D Analyzer frontend to upload and access C3D files.

## Problem Description

The c3d-examples bucket exists but uploads are blocked by Row Level Security policies. The frontend uses the anonymous key so the policies need to allow anonymous access for both reads and uploads.

## Quick Setup Steps

### 1. Run the SQL Setup Script

1. Open your Supabase dashboard: https://supabase.com/dashboard/project/egihfsmxphqcsjotmhmm
2. Navigate to **SQL Editor** → **New Query**
3. Copy and paste the contents of `setup-supabase-storage.sql`
4. Click **Run** to execute the script

### 2. Verify the Setup

```bash
node verify-supabase-setup.js
```

This will run comprehensive tests to ensure:
- ✅ Connection to Supabase works
- ✅ c3d-examples bucket exists and is configured correctly  
- ✅ Read permissions work for anonymous users
- ✅ Upload permissions work for anonymous users
- ✅ Download permissions work
- ✅ Public URLs are accessible

### 3. Upload Sample Files

```bash
node upload-sample-files.js
```

This will upload the existing C3D sample files from `frontend/public/samples/` to the Supabase bucket.

### 4. Test Frontend Functionality

Start your frontend application and verify that:
- The file browser loads and shows uploaded files
- You can download and analyze files
- You can upload new C3D files

## Files Created

- **`setup-supabase-storage.sql`** - Complete SQL script to create bucket and RLS policies
- **`supabase-rls-fix.js`** - Diagnostic script to check current status and provide instructions
- **`verify-supabase-setup.js`** - Comprehensive verification script to test all permissions
- **`upload-sample-files.js`** - Script to upload existing sample C3D files to the bucket

## What the SQL Script Does

1. **Creates the Storage Bucket**: Creates `c3d-examples` bucket if it doesn't exist
2. **Enables RLS**: Ensures Row Level Security is enabled on storage.objects
3. **Creates Policies**: Sets up 4 RLS policies for the bucket:
   - **Read Policy**: Allows anonymous users to SELECT/list files
   - **Upload Policy**: Allows anonymous users to INSERT new files
   - **Update Policy**: Allows anonymous users to UPDATE existing files
   - **Delete Policy**: Allows anonymous users to DELETE files

## Troubleshooting

### If verification fails:

1. **Connection Issues**: Check that your Supabase URL and anon key are correct
2. **Bucket Issues**: Ensure the bucket was created successfully
3. **Permission Issues**: Verify that all RLS policies were created correctly

### Check policies in dashboard:

1. Go to **Storage** → **Policies**
2. Look for policies with names starting with "Allow public" for the c3d-examples bucket
3. Ensure they target `public, anon` roles

### Manual policy creation:

If the SQL script doesn't work, you can create policies manually in the dashboard:

1. Go to **Storage** → **Policies**
2. Click **New Policy**
3. Select the c3d-examples bucket
4. Create policies for SELECT, INSERT, UPDATE, DELETE operations
5. Set target roles to `public, anon`
6. Use policy definition: `bucket_id = 'c3d-examples'`

## Environment Configuration

The setup uses these environment variables:
- **SUPABASE_URL**: `https://egihfsmxphqcsjotmhmm.supabase.co`
- **SUPABASE_ANON_KEY**: The anonymous key for public access

These are already configured in:
- `frontend/.env` (for React app)
- The setup scripts (hardcoded for convenience)

## Security Considerations

This setup allows **public anonymous access** to the c3d-examples bucket for:
- Reading/listing files
- Uploading new files  
- Updating existing files
- Deleting files

This is appropriate for a development/demo environment but you may want to restrict permissions for production use.

## Support

If you encounter issues:
1. Run `node supabase-rls-fix.js` for diagnostic information
2. Run `node verify-supabase-setup.js` to test all permissions
3. Check the Supabase dashboard for error messages
4. Ensure you have admin access to the Supabase project
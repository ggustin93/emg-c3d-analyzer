# RLS and Constraints Migration Guide

## Overview

This migration fixes critical issues that were causing webhook processing failures:

1. **Infinite Recursion in RLS Policies** - Circular references in `user_profiles` policies
2. **Duplicate Key Constraint Violations** - Missing unique constraints for idempotent operations  
3. **Backend Operation Performance** - No service role bypass policies

## Files

- `migration_fix_rls_and_constraints_2025_01_09.sql` - Complete SQL migration script
- `apply_rls_migration.py` - Python script to apply migration programmatically
- `README_RLS_Migration.md` - This documentation

## Quick Start

### Option 1: Run Python Script (Recommended)

```bash
# From the project root
cd backend
python scripts/database/apply_rls_migration.py
```

### Option 2: Run SQL Manually

```bash
# Using Supabase CLI
supabase db reset
# Then apply the SQL file through Supabase Dashboard or CLI

# Or using psql
psql -h db.YOUR_PROJECT_ID.supabase.co -U postgres -d postgres -f scripts/database/migration_fix_rls_and_constraints_2025_01_09.sql
```

## Environment Requirements

Ensure these environment variables are set:

```bash
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key
```

## What This Migration Does

### 1. Fixes RLS Infinite Recursion

**Before (Problematic):**
```sql
-- This caused infinite loops
CREATE POLICY "Admins can manage all profiles" ON user_profiles
USING (EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin'));
```

**After (Fixed):**
```sql
-- Service role bypass (for backend)
CREATE POLICY "Service role can manage all profiles" 
ON user_profiles FOR ALL TO service_role USING (true);

-- JWT-based admin (no table recursion)
CREATE POLICY "Admins can manage all profiles via JWT" 
ON user_profiles FOR ALL TO authenticated 
USING (COALESCE(
  (auth.jwt() ->> 'app_metadata')::jsonb ->> 'role',
  (auth.jwt() ->> 'user_metadata')::jsonb ->> 'role'
) = 'admin');
```

### 2. Adds Service Role Policies

Adds bypass policies for all RLS-enabled tables:
- `user_profiles`
- `emg_statistics` 
- `processing_parameters`
- `performance_scores`
- `therapy_sessions`
- `patients`
- `session_settings`
- `bfr_monitoring`

This allows backend operations using service keys to bypass RLS efficiently.

### 3. Enables Idempotent Operations

**Before:**
```sql
-- processing_parameters table had no unique constraint on session_id
-- This caused upsert failures: "no unique constraint matching ON CONFLICT"
```

**After:**
```sql
-- Added unique constraint for idempotent upserts
ALTER TABLE processing_parameters 
ADD CONSTRAINT processing_parameters_session_id_unique UNIQUE (session_id);
```

## Code Changes That Work With This Migration

The migration enables these code patterns to work correctly:

### Idempotent EMG Statistics
```python
# This now works without duplicate key errors
result = client.table("emg_statistics")
    .upsert(data, on_conflict="session_id,channel_name")
    .execute()
```

### Idempotent Processing Parameters  
```python
# This now works with the unique constraint
result = client.table("processing_parameters")
    .upsert(data, on_conflict="session_id")
    .execute()
```

### Service Role Operations
```python
# Backend operations bypass RLS efficiently
client = get_supabase_client(use_service_key=True)
# All operations are now fast and don't hit RLS recursion
```

## Verification

After running the migration, verify it worked:

### 1. Test Webhook Processing
```bash
# Upload a C3D file and check logs for:
# ✅ No "duplicate key constraint violation" errors
# ✅ No "infinite recursion detected" errors  
# ✅ Processing completes successfully
```

### 2. Test Idempotent Operations
```python
# Run the same processing twice - should not error
from services.clinical.therapy_session_processor import TherapySessionProcessor
processor = TherapySessionProcessor()
# Process same file twice - second time should be idempotent
```

### 3. Check Database Performance
```sql
-- These queries should be fast (no RLS recursion)
SELECT COUNT(*) FROM user_profiles;
SELECT COUNT(*) FROM emg_statistics;
```

## Rollback Instructions

If you need to rollback (not recommended), see the SQL file comments for complete rollback instructions.

**⚠️ Warning:** Rolling back will restore the infinite recursion issues and duplicate key problems.

## Troubleshooting

### Migration Fails with "Policy Already Exists"
This is expected if you run the migration multiple times. The script handles this gracefully.

### Service Key Not Working
Ensure your `SUPABASE_SERVICE_KEY` is the service role key (not anon key) and has admin privileges.

### Constraint Violations During Migration
The migration cleans up existing duplicates automatically. If this fails, manually clean duplicates:

```sql
WITH duplicates AS (
    SELECT id, ROW_NUMBER() OVER (PARTITION BY session_id ORDER BY created_at DESC) as rn
    FROM processing_parameters
)
DELETE FROM processing_parameters WHERE id IN (
    SELECT id FROM duplicates WHERE rn > 1
);
```

## Production Deployment

When deploying to production:

1. **Test First**: Apply migration to staging/dev environment
2. **Backup**: Ensure you have database backups
3. **Monitor**: Watch for any RLS policy issues after deployment
4. **Verify**: Test webhook processing and upsert operations

## Related Issues

This migration fixes the following error messages:

- `duplicate key value violates unique constraint "emg_statistics_pkey"`
- `infinite recursion detected in policy for relation "user_profiles"`
- `No analytics found in processing result for session`
- `there is no unique or exclusion constraint matching the ON CONFLICT specification`

## Impact

After this migration:
- ✅ Webhook processing is fully idempotent
- ✅ C3D files with weak signals process gracefully  
- ✅ Backend operations are fast (no RLS recursion)
- ✅ Database integrity maintained with proper constraints
- ✅ Production-ready error handling
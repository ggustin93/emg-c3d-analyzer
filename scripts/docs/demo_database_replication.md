# Demo Database Replication & Management Guide

## Overview
Complete guide for replicating the EMG C3D Analyzer database and managing demo data population/unpopulation on demand.

## Prerequisites
- Supabase CLI installed and configured
- Project access to `egihfsmxphqcsjotmhmm.supabase.co`
- Environment variables configured in `.env`

## 1. Complete Database Schema Application

### Apply All Migrations (Fresh Database)
```bash
# Navigate to project root
cd /Users/pwablo/Documents/GitHub/emg-c3d-analyzer

# Apply all migrations in sequence
supabase db reset --linked

# Or apply specific migration for complete schema
supabase migration apply 20250830000000_complete_schema_final
```

### Verify Schema Alignment
```bash
# Check current migration status
supabase migration list --linked

# Compare local and remote schemas
supabase db diff --linked
```

## 2. Demo Data Population Scripts

### Population Commands
```bash
# Populate demo users and basic data
supabase seed --linked

# Or execute specific population scripts
psql -h egihfsmxphqcsjotmhmm.supabase.co -U postgres -d postgres -f supabase/population/01_users_population.sql
psql -h egihfsmxphqcsjotmhmm.supabase.co -U postgres -d postgres -f supabase/population/02_clinical_data_population.sql
psql -h egihfsmxphqcsjotmhmm.supabase.co -U postgres -d postgres -f supabase/population/03_technical_metadata_population.sql
```

### Upload Sample C3D Files
```bash
# Upload GHOSTLY clinical data to storage
cd backend
python scripts/upload_demo_c3d_files.py
```

## 3. Demo Data Cleanup (Unpopulation)

### Complete Reset
```bash
# Reset entire database (WARNING: destructive)
supabase db reset --linked
```

### Selective Cleanup Script
Create `/scripts/cleanup_demo_data.sql`:
```sql
-- Clean demo data in reverse dependency order
BEGIN;

-- Remove performance scores
DELETE FROM performance_scores WHERE session_id IN (
    SELECT id FROM therapy_sessions WHERE patient_id IN (
        SELECT id FROM patients WHERE patient_code LIKE 'DEMO_%'
    )
);

-- Remove EMG statistics
DELETE FROM emg_statistics WHERE session_id IN (
    SELECT id FROM therapy_sessions WHERE patient_id IN (
        SELECT id FROM patients WHERE patient_code LIKE 'DEMO_%'
    )
);

-- Remove processing parameters
DELETE FROM processing_parameters WHERE session_id IN (
    SELECT id FROM therapy_sessions WHERE patient_id IN (
        SELECT id FROM patients WHERE patient_code LIKE 'DEMO_%'
    )
);

-- Remove session settings
DELETE FROM session_settings WHERE session_id IN (
    SELECT id FROM therapy_sessions WHERE patient_id IN (
        SELECT id FROM patients WHERE patient_code LIKE 'DEMO_%'
    )
);

-- Remove BFR monitoring
DELETE FROM bfr_monitoring WHERE session_id IN (
    SELECT id FROM therapy_sessions WHERE patient_id IN (
        SELECT id FROM patients WHERE patient_code LIKE 'DEMO_%'
    )
);

-- Remove therapy sessions
DELETE FROM therapy_sessions WHERE patient_id IN (
    SELECT id FROM patients WHERE patient_code LIKE 'DEMO_%'
);

-- Remove demo patients
DELETE FROM patients WHERE patient_code LIKE 'DEMO_%';

-- Remove demo users (therapists/researchers)
DELETE FROM user_profiles WHERE id IN (
    SELECT id FROM auth.users WHERE email LIKE 'demo_%@example.com'
);

COMMIT;
```

## 4. Database Verification Scripts

### Schema Compliance Check
```sql
-- Verify all required tables exist with correct structure
SELECT 
    table_name,
    COUNT(*) as column_count
FROM information_schema.columns 
WHERE table_schema = 'public' 
    AND table_name IN (
        'user_profiles', 'patients', 'therapy_sessions', 
        'emg_statistics', 'processing_parameters', 
        'session_settings', 'bfr_monitoring', 'performance_scores'
    )
GROUP BY table_name
ORDER BY table_name;
```

### Data Integrity Check
```sql
-- Verify referential integrity
SELECT 
    'patients' as table_name,
    COUNT(*) as total_records,
    COUNT(CASE WHEN therapist_id IS NULL THEN 1 END) as missing_therapist_refs
FROM patients
UNION ALL
SELECT 
    'therapy_sessions' as table_name,
    COUNT(*) as total_records,
    COUNT(CASE WHEN patient_id IS NULL THEN 1 END) as missing_patient_refs
FROM therapy_sessions
UNION ALL
SELECT 
    'emg_statistics' as table_name,
    COUNT(*) as total_records,
    COUNT(CASE WHEN session_id IS NULL THEN 1 END) as missing_session_refs
FROM emg_statistics;
```

## 5. Migration Status Verification

### Current Applied Migrations
Based on investigation, these migrations are currently applied:
- ✅ `20250901091424_mvc_workflow_alignment_simplified` (similar to MVC workflow)
- ✅ Core schema tables exist with therapeutic targets
- ✅ BFR monitoring per channel implemented
- ✅ Row Level Security policies active

### Schema Gaps Resolved
- ✅ `duration_threshold_seconds` column added to `session_settings`
- ✅ All expected tables exist in database
- ✅ Foreign key relationships intact

## 6. Complete Replication Workflow

### Step 1: Fresh Database Setup
```bash
# Create new Supabase project or reset existing
supabase projects create emg-c3d-analyzer-demo
# OR
supabase db reset --linked
```

### Step 2: Apply Complete Schema
```bash
# Apply the comprehensive migration
supabase migration apply 20250830000000_complete_schema_final --linked
```

### Step 3: Populate Demo Data
```bash
# Run population scripts
cd supabase/population
psql -h [PROJECT_URL] -U postgres -d postgres -f 01_users_population.sql
psql -h [PROJECT_URL] -U postgres -d postgres -f 02_clinical_data_population.sql
psql -h [PROJECT_URL] -U postgres -d postgres -f 03_technical_metadata_population.sql
```

### Step 4: Upload Sample Files
```bash
# Upload C3D files to storage
cd backend
python scripts/upload_demo_c3d_files.py --environment demo
```

### Step 5: Verify Setup
```bash
# Run backend tests to verify everything works
cd backend
python -m pytest tests/ -v --tb=short
```

## 7. Automated Demo Management

### Quick Demo Reset Script (`reset_demo.sh`)
```bash
#!/bin/bash
set -e

echo "🧹 Resetting demo database..."
supabase db reset --linked

echo "📊 Applying complete schema..."
supabase migration apply 20250830000000_complete_schema_final --linked

echo "👥 Populating demo users..."
psql -h egihfsmxphqcsjotmhmm.supabase.co -U postgres -d postgres -f supabase/population/01_users_population.sql

echo "🏥 Populating clinical data..."
psql -h egihfsmxphqcsjotmhmm.supabase.co -U postgres -d postgres -f supabase/population/02_clinical_data_population.sql

echo "📁 Uploading sample C3D files..."
cd backend && python scripts/upload_demo_c3d_files.py

echo "✅ Demo database ready for use!"
```

### Quick Demo Cleanup Script (`cleanup_demo.sh`)
```bash
#!/bin/bash
set -e

echo "🧹 Cleaning demo data..."
psql -h egihfsmxphqcsjotmhmm.supabase.co -U postgres -d postgres -f scripts/cleanup_demo_data.sql

echo "✅ Demo data cleaned - database ready for fresh demo!"
```

## 8. Maintenance Commands

### Check Migration Status
```bash
supabase migration list --linked
```

### Backup Before Demo
```bash
# Create backup before demo
supabase db dump --linked > backup_$(date +%Y%m%d_%H%M%S).sql
```

### Restore from Backup
```bash
# Restore from backup
supabase db reset --linked
psql -h [PROJECT_URL] -U postgres -d postgres -f backup_YYYYMMDD_HHMMSS.sql
```

This guide provides complete database replication and demo management capabilities as requested by the user.
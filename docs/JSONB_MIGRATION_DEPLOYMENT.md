# EMG Statistics JSONB Migration Deployment Guide

## Overview

This guide covers the deployment of the EMG statistics database optimization from 44+ individual columns to 4 clinical JSONB groups. The migration maintains full backwards compatibility while significantly improving performance and maintainability.

## Migration Files

1. **`20250904190000_optimize_emg_statistics_clinical_groups.sql`**
   - Adds 4 clinical JSONB columns
   - Migrates existing data to JSONB structure
   - Creates clinical view for backwards compatibility
   - **Does NOT remove legacy columns** (safe rollback)

2. **`20250904200000_cleanup_legacy_emg_statistics_columns.sql`**
   - Removes 26+ redundant legacy columns
   - Updates constraints and indexes
   - **Point of no return** - creates final backup table

## Pre-Deployment Checklist

### 1. Environment Preparation

```bash
# Ensure you have the latest migration files
git pull origin feature/rbac-implementation

# Verify Supabase CLI is configured
supabase status

# Create manual backup (recommended)
pg_dump -h [your-db-host] -U [username] -d [database] -t public.emg_statistics > emg_statistics_pre_migration_backup.sql
```

### 2. Validate Current Schema

```sql
-- Check current table structure
\d public.emg_statistics

-- Count existing records
SELECT COUNT(*) FROM public.emg_statistics;

-- Verify no pending migrations
SELECT * FROM supabase_migrations.schema_migrations ORDER BY version DESC LIMIT 5;
```

## Deployment Process

### Phase 1: Add JSONB Structure (Safe - Rollback Possible)

```bash
# Apply first migration - adds JSONB columns and migrates data
supabase db push

# OR manually apply specific migration
psql -h [host] -U [user] -d [db] -f supabase/migrations/20250904190000_optimize_emg_statistics_clinical_groups.sql
```

**Validation after Phase 1:**
```sql
-- Verify JSONB columns exist
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'emg_statistics' 
AND column_name LIKE '%_metrics';

-- Check data migration
SELECT COUNT(*) FROM public.emg_statistics 
WHERE contraction_quality_metrics != '{}'::jsonb;

-- Test clinical view
SELECT * FROM public.emg_statistics_clinical_view LIMIT 1;
```

### Phase 2: Remove Legacy Columns (Point of No Return)

**⚠️ CRITICAL: Validate Phase 1 completely before proceeding**

```bash
# Apply cleanup migration - removes legacy columns
psql -h [host] -U [user] -d [db] -f supabase/migrations/20250904200000_cleanup_legacy_emg_statistics_columns.sql
```

**Final Validation:**
```bash
cd backend
python scripts/validate_jsonb_migration.py
```

## System Integration

### Backend Changes (Already Implemented)

- ✅ **TherapySessionProcessor**: Updated to generate JSONB groups
- ✅ **Repository Layer**: Clinical view methods added
- ✅ **API Models**: Optional clinical fields for enhanced responses
- ✅ **Upload Route**: Full compatibility maintained through adapter pattern

### Frontend Impact

- ✅ **No changes required** - API responses identical via clinical view
- ✅ **Optional enhancement** - Can access JSONB groups for richer UI

## Performance Benefits

### Before Migration (44+ columns)
```sql
-- Large, flat structure
SELECT total_contractions, good_contractions, mvc75_compliance_rate, 
       duration_compliance_rate, avg_duration_ms, max_duration_ms, 
       min_duration_ms, rms_mean, rms_std, mav_mean, mav_std,
       mpf_mean, mpf_std, mdf_mean, mdf_std, ... 
FROM emg_statistics;
```

### After Migration (4 JSONB groups)
```sql
-- Clean, organized structure
SELECT contraction_quality_metrics, contraction_timing_metrics,
       muscle_activation_metrics, fatigue_assessment_metrics
FROM emg_statistics;
```

### Query Performance
- **Storage**: ~60% reduction in column count (44 → ~17)
- **Indexing**: GIN indexes on JSONB for fast searches
- **Maintainability**: Clinical grouping matches UI structure
- **Flexibility**: Easy to add new metrics without schema changes

## Clinical JSONB Structure

### 1. Contraction Quality Metrics
```json
{
  "total_contractions": 10,
  "overall_compliant_contractions": 8,
  "mvc75_compliant_contractions": 9,
  "duration_compliant_contractions": 7,
  "mvc75_compliance_percentage": 90.0,
  "duration_compliance_percentage": 70.0,
  "overall_compliance_percentage": 80.0
}
```

### 2. Contraction Timing Metrics
```json
{
  "avg_duration_ms": 2500.0,
  "max_duration_ms": 4000.0,
  "min_duration_ms": 1500.0,
  "total_time_under_tension_ms": 25000.0,
  "duration_threshold_ms": 2000.0
}
```

### 3. Muscle Activation Metrics
```json
{
  "rms_mean": 0.45,
  "rms_std": 0.12,
  "mav_mean": 0.38,
  "mav_std": 0.09,
  "avg_amplitude": 0.42,
  "max_amplitude": 0.78,
  "rms_coefficient_of_variation": 26.67,
  "mav_coefficient_of_variation": 23.68
}
```

### 4. Fatigue Assessment Metrics
```json
{
  "mpf_mean": 85.2,
  "mpf_std": 12.4,
  "mdf_mean": 78.4,
  "mdf_std": 8.9,
  "fatigue_index_mean": 0.12,
  "fatigue_index_std": 0.03,
  "fatigue_index_fi_nsm5": 0.12,
  "mpf_coefficient_of_variation": 14.55,
  "mdf_coefficient_of_variation": 11.35,
  "fatigue_slope_mpf": -0.02,
  "fatigue_slope_mdf": -0.015
}
```

## Backwards Compatibility

The `emg_statistics_clinical_view` provides computed fields from JSONB data:

```sql
-- Old API calls still work
SELECT total_contractions, good_contractions, avg_duration_ms, rms_mean 
FROM emg_statistics_clinical_view;

-- New enhanced API calls can access JSONB groups
SELECT contraction_quality_metrics, muscle_activation_metrics
FROM emg_statistics_clinical_view;
```

## Rollback Strategy

### Before Phase 2 (Legacy columns still exist)
```sql
-- Simple rollback - just stop using JSONB columns
-- Legacy columns still contain all data
```

### After Phase 2 (Legacy columns removed)
```sql
-- Restore from backup table
CREATE TABLE emg_statistics_restored AS 
SELECT * FROM emg_statistics_final_backup_20250904;

-- Requires re-creating legacy schema structure
```

## Monitoring and Validation

### Post-Deployment Monitoring

```sql
-- Check JSONB query performance
EXPLAIN ANALYZE 
SELECT * FROM emg_statistics 
WHERE contraction_quality_metrics->>'total_contractions' = '10';

-- Validate data consistency
SELECT COUNT(*) as total_records,
       COUNT(*) FILTER (WHERE contraction_quality_metrics != '{}') as with_quality,
       COUNT(*) FILTER (WHERE muscle_activation_metrics != '{}') as with_activation
FROM emg_statistics;
```

### Automated Validation

```bash
# Run comprehensive validation script
cd backend
python scripts/validate_jsonb_migration.py

# Validate specific session
python scripts/validate_jsonb_migration.py --session-id [UUID]
```

## Troubleshooting

### Common Issues

1. **Migration fails with constraint errors**
   - Ensure no invalid data exists in current columns
   - Check for NULL values in required fields

2. **JSONB data appears empty**
   - Verify first migration completed successfully
   - Check that source columns contained valid data

3. **Performance slower than expected**
   - Ensure GIN indexes were created
   - Run `ANALYZE emg_statistics` to update statistics

4. **Clinical view returns unexpected results**
   - Check JSONB data structure with `SELECT contraction_quality_metrics FROM emg_statistics LIMIT 1`
   - Validate JSONB keys match view column mappings

### Emergency Procedures

1. **If Phase 1 fails:** Simply rollback migration
2. **If Phase 2 fails:** Restore from `emg_statistics_final_backup_20250904`
3. **If validation fails:** Contact development team immediately

## Success Criteria

✅ **Schema Validation**
- JSONB columns exist and contain structured data
- Clinical view accessible and returns expected fields
- Legacy columns removed (Phase 2 only)

✅ **Data Integrity**
- All existing records migrated successfully
- No data loss detected
- JSONB structure matches specification

✅ **System Functionality**
- Upload route works correctly
- API responses identical to pre-migration
- TherapySessionProcessor generates proper JSONB

✅ **Performance**
- Query response times acceptable (<2s for typical operations)
- JSONB indexes functioning properly
- Storage requirements reduced

## Support

For issues during deployment:
1. Check migration logs in Supabase dashboard
2. Run validation script for detailed diagnostics
3. Contact development team with specific error messages
4. Have backup restoration procedure ready if needed

## Next Steps After Successful Migration

1. **Optional Frontend Enhancement**: Update UI to leverage clinical groupings
2. **Performance Monitoring**: Track query performance improvements
3. **Backup Cleanup**: Remove backup tables after validation period
4. **Documentation Updates**: Update API documentation with clinical groups

---

**Migration Created**: 2025-09-04  
**Status**: Ready for deployment  
**Impact**: Low risk with high benefit  
**Rollback**: Possible until Phase 2 completion
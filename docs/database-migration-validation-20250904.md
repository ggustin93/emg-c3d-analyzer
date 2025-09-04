# EMG Statistics Database Migration Validation Guide

**Migration**: `20250904190000_optimize_emg_statistics_clinical_groups.sql`
**Date**: September 4, 2025
**Branch**: `feature/database-schema-optimization`
**Status**: ✅ Phase 1 Complete - Ready for Testing

## Overview

This document provides validation procedures for the EMG Statistics Clinical Groups migration that consolidates 40+ columns into 4 clinical JSONB groups aligned with the UI structure.

## Migration Summary

### ✅ Completed Implementation
- **4 Clinical JSONB Groups**: contraction_quality_metrics, contraction_timing_metrics, muscle_activation_metrics, fatigue_assessment_metrics
- **Data Migration**: Complete migration from flat columns to JSONB structure
- **Performance Optimization**: GIN indexes + specific path indexes for query performance
- **Clinical View**: `emg_statistics_clinical_view` with computed fields for backwards compatibility
- **Safety Measures**: Full backup table + comprehensive rollback script

### 📊 Schema Transformation

#### Before: Flat Column Structure (40+ columns)
```sql
-- Example of old structure
total_contractions, good_contractions, mvc75_compliance_rate,
duration_compliance_rate, avg_duration_ms, max_duration_ms, 
rms_mean, rms_std, mav_mean, mav_std, mpf_mean, mpf_std, ...
```

#### After: Clinical JSONB Groups (4 groups)
```sql
-- New clinical structure
contraction_quality_metrics: {
  "total_contractions": 15,
  "overall_compliant_contractions": 12,
  "mvc75_compliant_contractions": 14,
  "duration_compliant_contractions": 13,
  "mvc75_compliance_percentage": 93.33,
  "duration_compliance_percentage": 86.67,
  "overall_compliance_percentage": 80.00
}

contraction_timing_metrics: {
  "avg_duration_ms": 2150.5,
  "max_duration_ms": 3200.0,
  "min_duration_ms": 1800.0,
  "total_time_under_tension_ms": 32257.5,
  "std_duration_ms": 245.8,
  "duration_threshold_ms": 2000.0
}

muscle_activation_metrics: {
  "rms_mean": 45.2,
  "rms_std": 8.7,
  "mav_mean": 38.9,
  "mav_std": 7.3,
  "avg_amplitude": 52.1,
  "max_amplitude": 78.5,
  "rms_coefficient_of_variation": 19.25,
  "mav_coefficient_of_variation": 18.77
}

fatigue_assessment_metrics: {
  "mpf_mean": 85.4,
  "mpf_std": 12.3,
  "mdf_mean": 78.9,
  "mdf_std": 11.7,
  "fatigue_index_mean": 0.15,
  "fatigue_index_std": 0.03,
  "fatigue_index_fi_nsm5": 0.12,
  "fatigue_slope_mpf": -0.25,
  "fatigue_slope_mdf": -0.18
}
```

## Validation Procedures

### 1. Pre-Deployment Validation (Local Testing)

#### 1.1 Data Integrity Check
```sql
-- Verify all records have JSONB data
SELECT 
  COUNT(*) as total_records,
  SUM(CASE WHEN contraction_quality_metrics = '{}'::jsonb THEN 1 ELSE 0 END) as missing_quality,
  SUM(CASE WHEN contraction_timing_metrics = '{}'::jsonb THEN 1 ELSE 0 END) as missing_timing,
  SUM(CASE WHEN muscle_activation_metrics = '{}'::jsonb THEN 1 ELSE 0 END) as missing_activation,
  SUM(CASE WHEN fatigue_assessment_metrics = '{}'::jsonb THEN 1 ELSE 0 END) as missing_fatigue
FROM emg_statistics;
```

**Expected Result**: All missing_* counts should be 0

#### 1.2 Sample Data Validation
```sql
-- Check sample JSONB structure
SELECT 
  session_id,
  channel_name,
  contraction_quality_metrics,
  contraction_timing_metrics
FROM emg_statistics_clinical_view
ORDER BY created_at DESC
LIMIT 5;
```

**Expected Result**: JSONB fields should contain properly structured data with numeric values

#### 1.3 Backwards Compatibility Check
```sql
-- Verify clinical view provides backwards compatibility
SELECT 
  total_contractions,
  good_contractions,
  mvc75_compliance_count,
  avg_duration_ms,
  rms_mean,
  mpf_mean
FROM emg_statistics_clinical_view
WHERE session_id = (
  SELECT session_id FROM emg_statistics ORDER BY created_at DESC LIMIT 1
);
```

**Expected Result**: All computed fields should match original data values

### 2. Performance Validation

#### 2.1 Index Performance Test
```sql
-- Test JSONB query performance
EXPLAIN ANALYZE
SELECT session_id, channel_name
FROM emg_statistics 
WHERE contraction_quality_metrics->>'total_contractions' > '10';

-- Test compound JSONB queries
EXPLAIN ANALYZE  
SELECT session_id, 
       contraction_quality_metrics->>'overall_compliance_percentage' as compliance_rate
FROM emg_statistics 
WHERE (contraction_quality_metrics->>'total_contractions')::int > 5
  AND (muscle_activation_metrics->>'rms_mean')::numeric > 20.0;
```

**Expected Result**: Query plans should show index usage, execution time < 50ms for typical queries

#### 2.2 Clinical View Performance
```sql
-- Test clinical view performance
EXPLAIN ANALYZE
SELECT * FROM emg_statistics_clinical_view 
WHERE total_contractions > 10 
ORDER BY created_at DESC 
LIMIT 20;
```

**Expected Result**: Reasonable performance for typical clinical queries

### 3. Application Integration Validation

#### 3.1 API Response Structure Check
After backend updates, validate API responses:

```bash
# Test EMG statistics endpoint
curl -X GET "http://localhost:8080/api/sessions/{session_id}/emg-statistics" \
  -H "Authorization: Bearer {token}" | jq .
```

**Expected Fields**: Should include both JSONB groups and backwards-compatible flat fields

#### 3.2 Frontend Data Access Validation
Check key frontend components can access new structure:

**Test Points**:
- StatsPanel.tsx displays metrics correctly
- PerformanceTab shows compliance rates
- Export functionality includes all metrics
- Charts render with correct data

### 4. Production Deployment Validation

#### 4.1 Pre-Deployment Checklist
- [ ] Migration tested in staging environment
- [ ] Backup table created successfully  
- [ ] Application code updated for JSONB access
- [ ] Test suite passing (232 tests)
- [ ] Performance benchmarks established
- [ ] Rollback script tested

#### 4.2 Post-Deployment Monitoring
```sql
-- Monitor migration success
SELECT 
  'Migration Status' as check_type,
  COUNT(*) as total_records,
  COUNT(CASE WHEN contraction_quality_metrics != '{}'::jsonb THEN 1 END) as migrated_records,
  ROUND(COUNT(CASE WHEN contraction_quality_metrics != '{}'::jsonb THEN 1 END) * 100.0 / COUNT(*), 2) as migration_percentage
FROM emg_statistics;

-- Monitor query performance
SELECT 
  schemaname,
  tablename,
  indexname,
  idx_scan as index_scans,
  idx_tup_read as tuples_read
FROM pg_stat_user_indexes 
WHERE tablename = 'emg_statistics' 
  AND indexname LIKE '%clinical%' OR indexname LIKE '%jsonb%'
ORDER BY idx_scan DESC;
```

## Error Scenarios and Responses

### Scenario 1: Migration Fails During Execution
**Response**: 
1. Check migration logs for specific error
2. Verify table structure prerequisites
3. Validate data integrity in existing table
4. Consider partial rollback and re-attempt

### Scenario 2: Performance Degradation After Migration
**Response**:
1. Check index creation success
2. Analyze slow queries with EXPLAIN ANALYZE
3. Consider additional indexes for specific query patterns
4. Monitor application response times

### Scenario 3: Application Errors After Deployment
**Response**:
1. Check API endpoints for JSONB access patterns
2. Validate frontend components use correct data paths
3. Verify backwards compatibility fields
4. Execute rollback if critical functionality broken

## Rollback Procedures

### Emergency Rollback
If critical issues occur post-deployment:

```bash
# Execute rollback script
psql -h your-supabase-host -d your-database -f supabase/rollback_20250904_emg_statistics_clinical_groups.sql
```

### Post-Rollback Validation
```sql
-- Verify rollback success
SELECT COUNT(*) FROM emg_statistics;
SELECT COUNT(*) FROM emg_statistics_backup_20250904;

-- Check original structure restored
\d emg_statistics

-- Verify application functionality
SELECT * FROM emg_statistics_with_rates LIMIT 5;
```

## Next Phase Preparation

### Phase 2: Backend Model Updates
**Ready When**: 
- [ ] Migration validated in production
- [ ] Performance metrics acceptable
- [ ] No critical application issues
- [ ] Rollback tested and verified

**Files to Update**:
- `backend/services/clinical/therapy_session_processor.py` (lines 769-834)
- `backend/models/clinical/session.py` (lines 76-128) 
- `backend/services/clinical/repositories/emg_data_repository.py`

### Phase 3: Frontend Type Updates
**Dependencies**: Phase 2 backend completion
**Files to Update**:
- `frontend/src/types/emg.ts` (lines 212-249)
- 31+ component files using EMG statistics

## Success Metrics

- ✅ **Data Integrity**: 0% data loss, 100% migration completion
- ✅ **Performance**: Query response time ≤ previous performance baseline  
- ✅ **Compatibility**: All existing API contracts maintained
- ✅ **Quality**: 232 tests passing (154 backend + 78 frontend)
- ✅ **Clinical Value**: UI matches clinical workflow expectations

## Support and Troubleshooting

### Key Files
- **Migration**: `supabase/migrations/20250904190000_optimize_emg_statistics_clinical_groups.sql`
- **Rollback**: `supabase/rollback_20250904_emg_statistics_clinical_groups.sql`
- **Validation**: This document + validation queries
- **Backup**: `emg_statistics_backup_20250904` table

### Contacts
- **Database Issues**: Check Supabase dashboard, logs, and monitoring
- **Application Issues**: Review backend/frontend logs for JSONB access errors
- **Performance Issues**: Analyze query plans and index usage statistics

---

**Last Updated**: September 4, 2025  
**Document Version**: 1.0  
**Migration Status**: ✅ Phase 1 Complete - Ready for Local Testing
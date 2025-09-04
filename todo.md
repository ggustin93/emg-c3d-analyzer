EMG Statistics Database Schema Optimization Plan                                                                                                                    │
     │                                                                                                                                                                     │
     │ Overview                                                                                                                                                            │
     │                                                                                                                                                                     │
     │ Optimize the emg_statistics table by consolidating 40+ columns into 4 clinical JSONB groups matching the UI structure, removing redundant fields, and cleaning up   │
     │ legacy views.                                                                                                                                                       │
     │                                                                                                                                                                     │
     │ Phase 1: Database Migration (Critical Path)                                                                                                                         │
     │                                                                                                                                                                     │
     │ 1.1 Create Migration File                                                                                                                                           │
     │                                                                                                                                                                     │
     │ File: supabase/migrations/20250903_optimize_emg_statistics_clinical_groups.sql                                                                                      │
     │                                                                                                                                                                     │
     │ Actions:                                                                                                                                                            │
     │ 1. Add 4 new JSONB columns matching UI groupings:                                                                                                                   │
     │   - contraction_quality_metrics (MVC compliance, overall compliance)                                                                                                │
     │   - contraction_timing_metrics (durations, time under tension)                                                                                                      │
     │   - muscle_activation_metrics (RMS, MAV amplitude metrics)                                                                                                          │
     │   - fatigue_assessment_metrics (MPF, MDF, fatigue indices)                                                                                                          │
     │ 2. Remove redundant columns:                                                                                                                                        │
     │   - compliance_rate (duplicate of good/total ratio)                                                                                                                 │
     │   - mvc_threshold (duplicate of mvc75_threshold)                                                                                                                    │
     │   - duration_threshold_actual_value (stored in processing_config)                                                                                                   │
     │ 3. Rename columns for clarity:                                                                                                                                      │
     │   - good_contractions → overall_compliant_contractions                                                                                                              │
     │ 4. Migrate existing data to new structure:                                                                                                                          │
     │ -- Populate new JSONB columns from existing data                                                                                                                    │
     │ UPDATE emg_statistics SET                                                                                                                                           │
     │   contraction_quality_metrics = jsonb_build_object(                                                                                                                 │
     │     'total_contractions', total_contractions,                                                                                                                       │
     │     'overall_compliant_contractions', good_contractions,                                                                                                            │
     │     'mvc75_compliant_contractions', mvc75_compliance_rate,                                                                                                          │
     │     'duration_compliant_contractions', duration_compliance_rate                                                                                                     │
     │   ),                                                                                                                                                                │
     │   contraction_timing_metrics = jsonb_build_object(                                                                                                                  │
     │     'avg_duration_ms', avg_duration_ms,                                                                                                                             │
     │     'max_duration_ms', max_duration_ms,                                                                                                                             │
     │     'min_duration_ms', min_duration_ms,                                                                                                                             │
     │     'total_time_under_tension_ms', total_time_under_tension_ms                                                                                                      │
     │   ),                                                                                                                                                                │
     │   muscle_activation_metrics = jsonb_build_object(                                                                                                                   │
     │     'rms_mean', rms_mean,                                                                                                                                           │
     │     'rms_std', rms_std,                                                                                                                                             │
     │     'mav_mean', mav_mean,                                                                                                                                           │
     │     'mav_std', mav_std,                                                                                                                                             │
     │     'avg_amplitude', avg_amplitude,                                                                                                                                 │
     │     'max_amplitude', max_amplitude                                                                                                                                  │
     │   ),                                                                                                                                                                │
     │   fatigue_assessment_metrics = jsonb_build_object(                                                                                                                  │
     │     'mpf_mean', mpf_mean,                                                                                                                                           │
     │     'mpf_std', mpf_std,                                                                                                                                             │
     │     'mdf_mean', mdf_mean,                                                                                                                                           │
     │     'mdf_std', mdf_std,                                                                                                                                             │
     │     'fatigue_index_mean', fatigue_index_mean,                                                                                                                       │
     │     'fatigue_index_std', fatigue_index_std,                                                                                                                         │
     │     'fatigue_index_fi_nsm5', fatigue_index_fi_nsm5                                                                                                                  │
     │   );                                                                                                                                                                │
     │ 5. Add GIN indexes for JSONB query performance                                                                                                                      │
     │ 6. Drop legacy views (except accessible_c3d_files and anonymized_sessions)                                                                                          │
     │ 7. Create new emg_statistics_clinical_view with computed compliance rates                                                                                           │
     │                                                                                                                                                                     │
     │ Phase 2: Backend Updates                                                                                                                                            │
     │                                                                                                                                                                     │
     │ 2.1 Update TherapySessionProcessor                                                                                                                                  │
     │                                                                                                                                                                     │
     │ File: backend/services/clinical/therapy_session_processor.py                                                                                                        │
     │                                                                                                                                                                     │
     │ Lines to Modify: 769-834 (_build_emg_stats_record method)                                                                                                           │
     │                                                                                                                                                                     │
     │ Changes:                                                                                                                                                            │
     │ 1. Build new JSONB structures instead of flat columns:                                                                                                              │
     │ contraction_quality_metrics = {                                                                                                                                     │
     │     "total_contractions": channel_data.get("contraction_count", 0),                                                                                                 │
     │     "overall_compliant_contractions": channel_data.get("good_contraction_count", 0),                                                                                │
     │     "mvc75_compliant_contractions": channel_data.get("mvc_contraction_count", 0),                                                                                   │
     │     "duration_compliant_contractions": channel_data.get("duration_contraction_count", 0)                                                                            │
     │ }                                                                                                                                                                   │
     │ 2. Remove redundant field assignments                                                                                                                               │
     │ 3. Update return dictionary to use JSONB groups                                                                                                                     │
     │                                                                                                                                                                     │
     │ 2.2 Update Pydantic Models                                                                                                                                          │
     │                                                                                                                                                                     │
     │ File: backend/models/clinical/session.py                                                                                                                            │
     │                                                                                                                                                                     │
     │ Lines to Modify: 76-128 (EMGStatisticsBase class)                                                                                                                   │
     │                                                                                                                                                                     │
     │ Changes:                                                                                                                                                            │
     │ 1. Replace individual fields with JSONB field definitions                                                                                                           │
     │ 2. Add validators for JSONB structure integrity                                                                                                                     │
     │ 3. Update computed properties for backwards compatibility                                                                                                           │
     │                                                                                                                                                                     │
     │ 2.3 Update Repository Layer                                                                                                                                         │
     │                                                                                                                                                                     │
     │ File: backend/services/clinical/repositories/emg_data_repository.py                                                                                                 │
     │                                                                                                                                                                     │
     │ Changes:                                                                                                                                                            │
     │ 1. Ensure bulk_insert_emg_statistics handles new JSONB structure                                                                                                    │
     │ 2. Add migration helper methods if needed                                                                                                                           │
     │                                                                                                                                                                     │
     │ Phase 3: Frontend Updates                                                                                                                                           │
     │                                                                                                                                                                     │
     │ 3.1 Update TypeScript Types                                                                                                                                         │
     │                                                                                                                                                                     │
     │ File: frontend/src/types/emg.ts                                                                                                                                     │
     │                                                                                                                                                                     │
     │ Lines to Modify: 212-249                                                                                                                                            │
     │                                                                                                                                                                     │
     │ Changes:                                                                                                                                                            │
     │ 1. Update ChannelAnalyticsData interface to match new structure                                                                                                     │
     │ 2. Add new interfaces for JSONB groups                                                                                                                              │
     │ 3. Remove deprecated field references                                                                                                                               │
     │                                                                                                                                                                     │
     │ 3.2 Update Data Access Components (31 files)                                                                                                                        │
     │                                                                                                                                                                     │
     │ Critical Files:                                                                                                                                                     │
     │ - frontend/src/components/tabs/GameStatsTab/StatsPanel.tsx - Update to use JSONB accessors                                                                          │
     │ - frontend/src/hooks/useEnhancedPerformanceMetrics.ts - Update metric calculations                                                                                  │
     │ - frontend/src/hooks/useContractionAnalysis.ts - Update contraction analysis                                                                                        │
     │ - frontend/src/store/sessionStore.ts - Update state management                                                                                                      │
     │                                                                                                                                                                     │
     │ Pattern: Replace flat field access with JSONB path access:                                                                                                          │
     │ // Before:                                                                                                                                                          │
     │ channel.good_contractions                                                                                                                                           │
     │ // After:                                                                                                                                                           │
     │ channel.contraction_quality_metrics?.overall_compliant_contractions                                                                                                 │
     │                                                                                                                                                                     │
     │ Phase 4: Testing Updates                                                                                                                                            │
     │                                                                                                                                                                     │
     │ 4.1 Backend Test Updates                                                                                                                                            │
     │                                                                                                                                                                     │
     │ Files:                                                                                                                                                              │
     │ - backend/tests/integration/clinical/test_therapy_session_processor_comprehensive.py                                                                                │
     │ - backend/tests/integration/clinical/test_database_table_population.py                                                                                              │
     │ - backend/tests/e2e/test_webhook_complete_integration.py                                                                                                            │
     │                                                                                                                                                                     │
     │ Changes:                                                                                                                                                            │
     │ 1. Update assertions to check JSONB structure                                                                                                                       │
     │ 2. Add tests for data migration integrity                                                                                                                           │
     │ 3. Verify computed compliance rates                                                                                                                                 │
     │                                                                                                                                                                     │
     │ 4.2 Frontend Test Updates                                                                                                                                           │
     │                                                                                                                                                                     │
     │ Files: All test files referencing EMG statistics                                                                                                                    │
     │                                                                                                                                                                     │
     │ Changes:                                                                                                                                                            │
     │ 1. Update mock data to new structure                                                                                                                                │
     │ 2. Update assertions for JSONB access patterns                                                                                                                      │
     │                                                                                                                                                                     │
     │ Phase 5: Validation & Rollback Plan                                                                                                                                 │
     │                                                                                                                                                                     │
     │ 5.1 Pre-Migration Backup                                                                                                                                            │
     │                                                                                                                                                                     │
     │ CREATE TABLE emg_statistics_backup_20250903 AS                                                                                                                      │
     │ SELECT * FROM emg_statistics;                                                                                                                                       │
     │                                                                                                                                                                     │
     │ 5.2 Validation Queries                                                                                                                                              │
     │                                                                                                                                                                     │
     │ -- Verify data integrity after migration                                                                                                                            │
     │ SELECT                                                                                                                                                              │
     │   COUNT(*) as total_records,                                                                                                                                        │
     │   COUNT(DISTINCT session_id) as unique_sessions,                                                                                                                    │
     │   SUM(CASE WHEN contraction_quality_metrics IS NULL THEN 1 ELSE 0 END) as missing_quality,                                                                          │
     │   SUM(CASE WHEN contraction_timing_metrics IS NULL THEN 1 ELSE 0 END) as missing_timing,                                                                            │
     │   SUM(CASE WHEN muscle_activation_metrics IS NULL THEN 1 ELSE 0 END) as missing_activation,                                                                         │
     │   SUM(CASE WHEN fatigue_assessment_metrics IS NULL THEN 1 ELSE 0 END) as missing_fatigue                                                                            │
     │ FROM emg_statistics;                                                                                                                                                │
     │                                                                                                                                                                     │
     │ 5.3 Rollback Script                                                                                                                                                 │
     │                                                                                                                                                                     │
     │ Ready to execute if issues arise, restoring from backup table.                                                                                                      │
     │                                                                                                                                                                     │
     │ Implementation Order                                                                                                                                                │
     │                                                                                                                                                                     │
     │ 1. Day 1 - Database:                                                                                                                                                │
     │   - Create and test migration locally                                                                                                                               │
     │   - Apply to development database                                                                                                                                   │
     │   - Verify data integrity                                                                                                                                           │
     │ 2. Day 2 - Backend:                                                                                                                                                 │
     │   - Update Python models and processor                                                                                                                              │
     │   - Run backend test suite                                                                                                                                          │
     │   - Verify API responses                                                                                                                                            │
     │ 3. Day 3 - Frontend:                                                                                                                                                │
     │   - Update types and critical components                                                                                                                            │
     │   - Test UI functionality                                                                                                                                           │
     │   - Run frontend test suite                                                                                                                                         │
     │ 4. Day 4 - Integration:                                                                                                                                             │
     │   - End-to-end testing                                                                                                                                              │
     │   - Performance validation                                                                                                                                          │
     │   - Documentation updates                                                                                                                                           │
     │                                                                                                                                                                     │
     │ Risk Mitigation                                                                                                                                                     │
     │                                                                                                                                                                     │
     │ - Data Loss: Full backup before migration                                                                                                                           │
     │ - Performance: GIN indexes on JSONB columns                                                                                                                         │
     │ - Compatibility: Temporary backwards compatibility layer                                                                                                            │
     │ - Testing: Comprehensive test coverage at each phase                                                                                                                │
     │                                                                                                                                                                     │
     │ Success Metrics                                                                                                                                                     │
     │                                                                                                                                                                     │
     │ - ✅ All 223 tests passing (135 backend + 78 frontend)                                                                                                               │
     │ - ✅ No data loss during migration                                                                                                                                   │
     │ - ✅ Query performance maintained or improved                                                                                                                        │
     │ - ✅ UI correctly displays all metrics                                                                                                                               │
     │ - ✅ Cleaner, more maintainable schema aligned with clinical perspective                                                                                             │
     ╰─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────╯

> We dont need "│ │ - Compatibility: Temporary backwards compatibility layer                                                                 │ │" \
  \
  Please write your plan in a markdown file with timestamp of today. Then wait, we will first merge our current branch, and then start a new branch for this big plan.

⏺ Write(docs/database-optimization-plan-20250104.md)
  ⎿  Wrote 340 lines to docs/database-optimization-plan-20250104.md                                                                                                    
     # EMG Statistics Database Schema Optimization Plan
     **Date**: January 4, 2025
     **Author**: Claude Code
     **Project**: EMG C3D Analyzer
     **Current Branch**: feature/rbac-implementation
     ## Executive Summary
     Optimize the `emg_statistics` table by consolidating 40+ columns into 4 clinical JSONB groups matching the UI structure, removing redundant fields, and cleaning up
      legacy views. This will improve maintainability, align with clinical perspectives, and follow PostgreSQL best practices.
     ## Core Changes
     … +330 lines (ctrl+r to expand)

⏺ I've created a comprehensive database optimization plan and saved it to /docs/database-optimization-plan-20250104.md.

  The plan details the optimization of the EMG statistics schema by:
  - Consolidating 40+ columns into 4 clinical JSONB groups
  - Removing redundant fields (compliance_rate, mvc_threshold, duration_threshold_actual_value)
  - Renaming good_contractions to overall_compliant_contractions
  - Cleaning up legacy database views

  The implementation is organized into 5 phases with a clear 2-week timeline, affecting approximately 40 files across the database, backend, and frontend.

  Now we can wait to:
  1. First merge your current feature/rbac-implementation branch
  2. Then create a new branch feature/database-schema-optimization for this work

  The plan is ready to execute whenever you're ready to proceed!

# TODO: Database Schema Alignment - September 5, 2025

## Priority: HIGH - Database & Backend Alignment Required

### Executive Summary
The backend service `therapy_session_processor.py` and repositories are misaligned with the actual Supabase database schema. This TODO outlines the comprehensive plan to fix these inconsistencies and ensure proper data population across all tables.

---

## 1. Database Migrations Required

### 1.1 Rename Patient Duration Columns (Standardize to Milliseconds)
```sql
-- Migration: Rename patient duration columns from seconds to milliseconds
ALTER TABLE public.patients 
  RENAME COLUMN current_duration_ch1_seconds TO current_target_ch1_ms;

ALTER TABLE public.patients 
  RENAME COLUMN current_duration_ch2_seconds TO current_target_ch2_ms;

-- Update data to convert seconds to milliseconds
UPDATE public.patients 
SET 
  current_target_ch1_ms = current_target_ch1_ms * 1000,
  current_target_ch2_ms = current_target_ch2_ms * 1000
WHERE current_target_ch1_ms IS NOT NULL 
   OR current_target_ch2_ms IS NOT NULL;
```

**Rationale**: 
- Consistency with session_settings table which already uses `target_duration_ch1_ms`
- All duration fields should be in milliseconds for consistency
- Distinction: `current_target_*` = patient baseline, `target_duration_*` = session-specific

---

## 2. Backend Code Fixes

### 2.1 Remove Non-Existent processing_parameters Table References

**File**: `backend/services/clinical/therapy_session_processor.py`

**Changes Required**:
1. **Remove line 638-640** - Call to non-existent `_populate_processing_parameters`
2. **Remove lines 991-1038** - Entire `_populate_processing_parameters` method
3. **Update line 777** - Store processing config in `emg_statistics.processing_parameters` JSONB field instead

**Implementation**:
```python
# Replace the processing_parameters table insert with JSONB storage
# In _populate_emg_statistics method, add:
processing_config = {
    "algorithm_version": "1.0.0",
    "mvc_source": mvc_source,
    "mvc_ch1": mvc_ch1,
    "mvc_ch2": mvc_ch2,
    "envelope_window_ms": 50,
    "filter_highpass_hz": 20,
    "filter_lowpass_hz": 10,
    "threshold_mvc_percentage": 75,
    "baseline_noise_threshold": 0.01
}

# Store in emg_statistics.processing_parameters JSONB field
```

### 2.2 Fix Patient Duration Query

**File**: `backend/services/clinical/therapy_session_processor.py`
**Line**: 1742

**Current (WRONG)**:
```python
query = """
    SELECT target_duration_ch1_ms, target_duration_ch2_ms 
    FROM patients 
    WHERE uuid = %s
"""
```

**Fixed**:
```python
query = """
    SELECT current_target_ch1_ms, current_target_ch2_ms 
    FROM patients 
    WHERE uuid = %s
"""
```

---

## 3. Repository Pattern Enhancement

### 3.1 Add Transaction Support to EMGDataRepository

```python
class EMGDataRepository:
    async def save_complete_session_data(self, session_data: Dict) -> None:
        """Atomic save of all session data with transaction support"""
        async with self.db.transaction():
            # 1. Core session data
            session_id = await self._save_therapy_session(session_data['session'])
            
            # 2. EMG statistics with JSONB
            await self._save_emg_statistics(session_id, session_data['statistics'])
            
            # 3. Performance scores
            await self._save_performance_scores(session_id, session_data['scores'])
            
            # 4. EMG contractions
            await self._save_contractions_batch(session_id, session_data['contractions'])
            
            # 5. Game session data
            await self._save_game_session(session_id, session_data['game'])
```

---

## 4. JSONB Strategy for Metabase Analytics

### 4.1 Hybrid Approach: Core Fields + JSONB + Materialized Views

**Current JSONB Structure in emg_statistics**:
```json
{
  "contraction_quality_metrics": {
    "total_contractions": 24,
    "overall_compliant_contractions": 18,
    "mvc75_compliant_contractions": 20,
    "duration_compliant_contractions": 19
  },
  "contraction_timing_metrics": {
    "avg_duration_ms": 3500,
    "min_duration_ms": 2000,
    "max_duration_ms": 5000
  },
  "muscle_activation_metrics": {
    "rms_mean": 0.145,
    "mav_mean": 0.132
  },
  "fatigue_assessment_metrics": {
    "mpf_slope": -0.023,
    "mdf_slope": -0.019
  }
}
```

### 4.2 Materialized Views for Metabase (FUTURE - Not Now)

```sql
-- Will create later when needed for researchers
CREATE MATERIALIZED VIEW mv_emg_analytics AS
SELECT 
    es.id,
    es.therapy_session_id,
    -- Core fields
    es.total_contractions,
    es.overall_compliant_contractions,
    
    -- Extracted JSONB metrics
    (es.contraction_quality_metrics->>'mvc75_compliant_contractions')::int as mvc75_compliant,
    (es.contraction_timing_metrics->>'avg_duration_ms')::float as avg_duration_ms,
    (es.muscle_activation_metrics->>'rms_mean')::float as rms_mean,
    (es.fatigue_assessment_metrics->>'mpf_slope')::float as fatigue_slope,
    
    -- Calculated fields
    CASE 
        WHEN es.total_contractions > 0 
        THEN (es.overall_compliant_contractions::float / es.total_contractions * 100)
        ELSE 0 
    END as compliance_percentage
    
FROM emg_statistics es;

-- Refresh strategy
CREATE INDEX idx_mv_emg_analytics_session ON mv_emg_analytics(therapy_session_id);
```

---

## 5. Validation Layer

### 5.1 Add Data Validation Service

```python
class SessionDataValidator:
    def validate_complete_session(self, data: Dict) -> ValidationResult:
        """Validate all required fields before database insertion"""
        
        errors = []
        warnings = []
        
        # Required fields validation
        if not data.get('session', {}).get('patient_id'):
            errors.append("Missing required patient_id")
            
        # Duration consistency check
        if data.get('statistics', {}).get('avg_duration_ms'):
            avg = data['statistics']['avg_duration_ms']
            if avg < 1000 or avg > 10000:
                warnings.append(f"Unusual average duration: {avg}ms")
        
        # JSONB structure validation
        required_jsonb_keys = [
            'contraction_quality_metrics',
            'contraction_timing_metrics',
            'muscle_activation_metrics',
            'fatigue_assessment_metrics'
        ]
        
        for key in required_jsonb_keys:
            if key not in data.get('statistics', {}).get('processing_parameters', {}):
                errors.append(f"Missing required JSONB key: {key}")
        
        return ValidationResult(
            is_valid=len(errors) == 0,
            errors=errors,
            warnings=warnings
        )
```

---

## 6. Test Updates Required

### 6.1 Update Test Fixtures
- Update all test fixtures to use `current_target_ch1_ms` instead of `target_duration_ch1_ms`
- Remove any references to processing_parameters table
- Add JSONB validation tests

### 6.2 New Integration Tests
```python
def test_complete_session_data_population():
    """Verify all tables are populated correctly"""
    # Test that single C3D processing populates:
    # - therapy_sessions
    # - emg_statistics (with JSONB)
    # - performance_scores
    # - emg_contractions
    # - game_sessions
```

---

## 7. Implementation Order

### Phase 1: Database Migration (Immediate)
1. ✅ Run migration to rename patient columns
2. ✅ Update existing data (multiply by 1000)
3. ✅ Verify session_settings columns exist

### Phase 2: Backend Fixes (Today)
1. ⬜ Remove processing_parameters references
2. ⬜ Fix patient duration query
3. ⬜ Update JSONB storage logic
4. ⬜ Run tests to verify

### Phase 3: Repository Enhancement (This Week)
1. ⬜ Add transaction support
2. ⬜ Implement atomic saves
3. ⬜ Add validation layer
4. ⬜ Update integration tests

### Phase 4: Analytics Support (Future - When Needed)
1. ⬜ Create materialized views for Metabase
2. ⬜ Add refresh policies
3. ⬜ Document for researchers

---

## 8. Benefits of This Approach

### For Development:
- ✅ Consistent millisecond units everywhere
- ✅ Clear distinction between patient baseline vs session targets
- ✅ Atomic operations prevent partial data
- ✅ Validation catches issues early

### For Research/Analytics:
- ✅ JSONB provides flexibility for evolving metrics
- ✅ Materialized views make data accessible in Metabase
- ✅ No need for researchers to understand JSONB
- ✅ Performance optimized with proper indexes

### For Maintenance:
- ✅ Single source of truth (no processing_parameters table)
- ✅ Transaction support prevents data corruption
- ✅ Clear separation of concerns
- ✅ Healthcare-standard JSONB approach (FHIR-compliant pattern)

---

## 9. Notes

- **JSONB Best Practices**: Research confirmed JSONB is standard for healthcare data (FHIR uses it extensively)
- **Performance**: GIN indexes with jsonb_path_ops provide excellent query performance
- **Metabase**: Materialized views solve the analytics accessibility problem
- **Consistency**: All durations now in milliseconds throughout the system

---

## Questions Resolved

1. **Q**: Should we use JSONB heavily?
   **A**: Yes, hybrid approach is best - core fields normalized, complex metrics in JSONB

2. **Q**: Will researchers be able to use Metabase?
   **A**: Yes, through materialized views that flatten JSONB data

3. **Q**: Current vs session targets?
   **A**: `current_target_*` in patients table (baseline), `target_duration_*` in session_settings (per-session)

4. **Q**: Milliseconds everywhere?
   **A**: Yes, standardized to milliseconds for all duration fields

---

**Created**: 2025-09-05
**Priority**: HIGH - Blocking proper data collection
**Assigned**: Backend Team
**Status**: PLANNING → READY FOR IMPLEMENTATION
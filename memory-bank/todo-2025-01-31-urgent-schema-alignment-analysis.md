# TODO-2025-01-31-URGENT: Schema Alignment Analysis & Required Fixes

## 🚨 Priority: HIGH - Database Schema & Population Issues

### Executive Summary
Analysis conducted on 2025-01-31 revealed that while the database migration schema is mostly aligned with requirements, there are critical gaps in the therapy_session_processor.py implementation that prevent full table population, particularly for therapeutic targets and patient baseline updates.

---

## 1. ✅ Migration File Status

**File:** `/supabase/migrations/20250830000000_complete_schema_final.sql`

### Confirmed Working
All 9 core tables are correctly defined:
- ✅ `bfr_monitoring` - Per-channel BFR monitoring (CH1/CH2)
- ✅ `emg_statistics` - EMG analysis data with all clinical metrics
- ✅ `patients` - Includes therapeutic target fields
- ✅ `performance_scores` - GHOSTLY+ scoring system
- ✅ `processing_parameters` - Signal processing configuration
- ✅ `scoring_configuration` - Weighted scoring parameters
- ✅ `session_settings` - Session configuration with therapeutic targets
- ✅ `therapy_sessions` - Main session records
- ✅ `user_profiles` - Unified user management

### Minor Discrepancies
1. **user_profiles.full_name**: Uses `GENERATED ALWAYS AS ... STORED` vs schema DEFAULT
2. **session_settings**: Has `duration_threshold_seconds` field (processor uses this name)
3. **bfr_monitoring**: Correctly includes `created_at` timestamp

---

## 2. ✅ Population Scripts Status

**Location:** `/supabase/population/`

### Available Scripts
1. `01_core_data_population.sql` - Users, patients, sessions
2. `02_emg_performance_population.sql` - EMG stats & scores
3. `03_technical_metadata_population.sql` - Technical data
4. `04_validation_and_summary.sql` - Data validation
5. `run_all_population.sh` - Orchestration script

### To Execute Population
```bash
cd supabase/population
DATABASE_URL="postgresql://..." ./run_all_population.sh
```

### Expected Data Volume
- 5 Clinical user profiles
- 65+ Diverse patients
- 400+ Therapy sessions
- 300+ EMG statistics records
- 200+ Performance scores
- 150+ BFR monitoring records

---

## 3. ⚠️ CRITICAL: therapy_session_processor.py Issues

**File:** `/backend/services/clinical/therapy_session_processor.py`

### Current Table Population (6 tables)
1. ✅ `therapy_sessions` - Main record created
2. ✅ `emg_statistics` - Populated via `_populate_emg_statistics()`
3. ✅ `processing_parameters` - Populated via `_populate_processing_parameters()`
4. ✅ `performance_scores` - Via PerformanceScoringService
5. ✅ `bfr_monitoring` - Per-channel via `_populate_bfr_monitoring()`
6. ⚠️ `session_settings` - **INCOMPLETE** via `_populate_session_settings()`

### 🔴 URGENT FIXES NEEDED

#### Fix 1: session_settings Missing Therapeutic Targets
**Location:** Lines 954-970 in `_populate_session_settings()`

**Currently Missing:**
```python
# NOT BEING SET:
- target_mvc_ch1
- target_mvc_ch2  
- target_duration_ch1
- target_duration_ch2
```

**Required Addition:**
```python
session_settings_data = {
    # ... existing fields ...
    
    # ADD THESE THERAPEUTIC TARGETS:
    "target_mvc_ch1": getattr(session_params, "target_mvc_ch1", None),
    "target_mvc_ch2": getattr(session_params, "target_mvc_ch2", None),
    "target_duration_ch1": getattr(session_params, "target_duration_ch1", None),
    "target_duration_ch2": getattr(session_params, "target_duration_ch2", None),
}
```

#### Fix 2: Patient Baseline Updates Not Happening
**Missing Functionality:** After successful session, should update patient baselines

**Required New Method:**
```python
async def _update_patient_baselines(self, session_id: str, analytics: dict):
    """Update patient's current MVC and duration baselines after session."""
    # Get patient_id from session
    # Calculate new baselines from analytics
    # Update patients table:
    #   - current_mvc_ch1
    #   - current_mvc_ch2
    #   - current_duration_ch1
    #   - current_duration_ch2
    #   - last_assessment_date
```

#### Fix 3: Field Name Alignment
**Issue:** Inconsistent field naming between processor and schema

**Check These Fields:**
- `duration_threshold_seconds` vs expected name in schema
- `updated_at` timestamps not being maintained properly

---

## 4. 📋 Action Items (Priority Order)

### Immediate (Today/Tomorrow):
1. [ ] **Fix `_populate_session_settings()`** - Add therapeutic target fields
2. [ ] **Implement `_update_patient_baselines()`** - Update patient records after session
3. [ ] **Test population scripts** - Verify all tables populate correctly
4. [ ] **Run integration test** - Process real C3D file and verify all tables

### This Week:
5. [ ] **Align field names** - Ensure consistency between processor and migration
6. [ ] **Add validation** - Verify all required fields are populated
7. [ ] **Update tests** - Add test coverage for new population logic
8. [ ] **Document changes** - Update API documentation

### Follow-up:
9. [ ] **Performance optimization** - Batch inserts for better performance
10. [ ] **Error handling** - Improve transaction rollback on failures

---

## 5. Testing Checklist

After fixes, verify:
- [ ] All 9 tables receive data from C3D processing
- [ ] Therapeutic targets populate in session_settings
- [ ] Patient baselines update after successful session
- [ ] BFR monitoring has per-channel records
- [ ] Performance scores calculate correctly
- [ ] Population scripts run without errors

---

## 6. Contact & Resources

- **Schema Location:** `/supabase/migrations/20250830000000_complete_schema_final.sql`
- **Processor Location:** `/backend/services/clinical/therapy_session_processor.py`
- **Population Scripts:** `/supabase/population/`
- **Test C3D Files:** `/data/test_samples/`

---

## Notes
- Analysis performed: 2025-01-31
- Current Git Branch: `feature/schema-therapeutic-targets`
- All tests passing: 111/111 (33 backend + 78 frontend)
- Architecture: Domain-Driven Design with clean separation

**⚠️ IMPORTANT:** These fixes are required for proper clinical data tracking and therapeutic progression monitoring in the GHOSTLY+ rehabilitation system.
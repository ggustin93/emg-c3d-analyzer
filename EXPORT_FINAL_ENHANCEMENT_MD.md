# 📊 Export API Final Enhancement Plan
## Single Source of Truth Implementation

### Executive Summary
This plan enhances the backend `/upload` route to provide **ALL** data needed for the frontend CSV export, establishing the backend as the single source of truth for export data. The frontend will only format data, never calculate it.

---

## 🎯 Current State Analysis

### What's Already Working ✅
1. **Upload Route** (`/api/routes/upload.py`):
   - Processes C3D files with `GHOSTLYC3DProcessor`
   - Calls `PerformanceScoringService` for clinical analysis
   - Returns `performance_analysis` in response (line 166)

2. **Clinical Services** (`/services/clinical/`):
   - `emg_analytics_adapter.py` - Converts EMG to clinical format
   - `performance_scoring_service.py` - Calculates performance scores
   - `ScoringWeights` dataclass with default GHOSTLY+ weights
   - `RPEMapping` for effort score calculation

3. **Frontend Export** (`/components/tabs/ExportTab/`):
   - `hooks.tsx` already checks for backend data:
     - Line 191: Uses `analysisResult.performance_analysis` if available
     - Line 175: Uses `analysisResult.session_parameters` if available
     - Line 240: Uses `analysisResult.processing_parameters` if available
   - `csvGenerator.ts` formats all data into CSV (531 lines)

### What's Missing ❌
Backend doesn't provide all fields that CSV needs:
1. **RPE Descriptions** - Borg scale text descriptions
2. **Formatted Session Configuration** - MVC/duration with units
3. **Per-Muscle Compliance Breakdown** - Detailed rates
4. **Scoring Configuration Weights** - For transparency
5. **Data Completeness Indicators** - What data is available

---

## 📋 Detailed Field Mapping

### Fields Frontend CSV Expects vs Backend Provides

| CSV Section | Frontend Field | Backend Status | Required Action |
|------------|---------------|----------------|-----------------|
| **Session Configuration** | | | |
| | `rpe_pre_description` | ❌ Missing | Add helper function |
| | `rpe_post_description` | ❌ Missing | Add helper function |
| | `mvc_threshold_ch1_percentage` | ❌ Missing | Calculate from threshold |
| | `mvc_threshold_ch2_percentage` | ❌ Missing | Calculate from threshold |
| | `session_duration_minutes` | ❌ Missing | Calculate from seconds |
| **Performance Analysis** | | | |
| | `overall_score` | ✅ Provided | None |
| | `compliance_score` | ✅ Provided | None |
| | `compliance_components` | ⚠️ Partial | Enhance structure |
| | `rpe_value` | ⚠️ Partial | Add to response |
| | `effort_score` | ⚠️ Partial | Ensure calculated |
| | `weights` | ❌ Missing | Add configuration |
| | `data_completeness` | ❌ Missing | Add indicators |
| **Scoring Configuration** | | | |
| | `weight_compliance` | ❌ Missing | Export from service |
| | `weight_symmetry` | ❌ Missing | Export from service |
| | `weight_effort` | ❌ Missing | Export from service |
| | `weight_game` | ❌ Missing | Export from service |
| | Sub-weights | ❌ Missing | Export from service |

---

## 🔧 Implementation Plan

### Phase 1: Enhance Upload Route Response Structure
**File**: `/backend/api/routes/upload.py`

#### 1.1 Add Helper Functions (New)
```python
def get_rpe_description(rpe: int | None) -> str:
    """Get Borg CR-10 scale description."""
    if rpe is None:
        return "Not recorded"
    descriptions = {
        1: 'Very Easy',
        2: 'Easy',
        3: 'Moderate',
        4: 'Somewhat Hard',
        5: 'Hard',
        6: 'Very Hard',
        7: 'Very Hard+',
        8: 'Extremely Hard',
        9: 'Extremely Hard+',
        10: 'Maximum Effort'
    }
    return descriptions.get(rpe, 'Unknown')

def format_session_configuration(session_params: GameSessionParameters) -> dict:
    """Format session parameters with units and descriptions."""
    config = {}
    
    # RPE with descriptions
    if hasattr(session_params, 'rpe_pre_session'):
        config['rpe_pre_session'] = session_params.rpe_pre_session
        config['rpe_pre_description'] = get_rpe_description(session_params.rpe_pre_session)
    
    if hasattr(session_params, 'rpe_post_session'):
        config['rpe_post_session'] = session_params.rpe_post_session
        config['rpe_post_description'] = get_rpe_description(session_params.rpe_post_session)
    
    # MVC thresholds with percentages
    if hasattr(session_params, 'mvc_threshold_ch1'):
        config['mvc_threshold_ch1'] = session_params.mvc_threshold_ch1
        config['mvc_threshold_ch1_percentage'] = session_params.mvc_threshold_ch1 * 100
    
    if hasattr(session_params, 'mvc_threshold_ch2'):
        config['mvc_threshold_ch2'] = session_params.mvc_threshold_ch2
        config['mvc_threshold_ch2_percentage'] = session_params.mvc_threshold_ch2 * 100
    
    # Duration thresholds
    if hasattr(session_params, 'contraction_duration_threshold'):
        config['contraction_duration_threshold'] = session_params.contraction_duration_threshold
    if hasattr(session_params, 'target_duration_ch1_ms'):
        config['target_duration_ch1_ms'] = session_params.target_duration_ch1_ms
    if hasattr(session_params, 'target_duration_ch2_ms'):
        config['target_duration_ch2_ms'] = session_params.target_duration_ch2_ms
    
    # Session/rest durations with conversions
    if hasattr(session_params, 'session_duration_seconds'):
        config['session_duration_seconds'] = session_params.session_duration_seconds
        config['session_duration_minutes'] = session_params.session_duration_seconds / 60
    if hasattr(session_params, 'rest_duration_seconds'):
        config['rest_duration_seconds'] = session_params.rest_duration_seconds
    
    return config

def get_scoring_configuration() -> dict:
    """Get default GHOSTLY+ scoring configuration."""
    from config import ScoringDefaults
    
    return {
        # Main weights
        'weight_compliance': ScoringDefaults.WEIGHT_COMPLIANCE,  # 0.50
        'weight_symmetry': ScoringDefaults.WEIGHT_SYMMETRY,      # 0.25
        'weight_effort': ScoringDefaults.WEIGHT_EFFORT,          # 0.25
        'weight_game': ScoringDefaults.WEIGHT_GAME,              # 0.00
        # Sub-weights for compliance
        'weight_completion': ScoringDefaults.WEIGHT_COMPLETION,  # 0.333
        'weight_intensity': ScoringDefaults.WEIGHT_INTENSITY,    # 0.333
        'weight_duration': ScoringDefaults.WEIGHT_DURATION,      # 0.334
    }

def enhance_performance_analysis(clinical_scores: dict, session_params: GameSessionParameters) -> dict:
    """Enhance clinical scores with additional fields for CSV export."""
    enhanced = {**clinical_scores}  # Keep all existing scores
    
    # Add RPE data if available
    if hasattr(session_params, 'rpe_post_session') and session_params.rpe_post_session:
        enhanced['rpe_value'] = session_params.rpe_post_session
        enhanced['rpe_description'] = get_rpe_description(session_params.rpe_post_session)
    
    # Add scoring weights for transparency
    enhanced['weights'] = get_scoring_configuration()
    
    # Add data completeness indicators
    enhanced['data_completeness'] = {
        'has_emg_data': bool(clinical_scores.get('compliance_score')),
        'has_rpe': bool(getattr(session_params, 'rpe_post_session', None)),
        'has_game_data': bool(clinical_scores.get('game_score')),
        'has_bfr_data': False,  # Not yet implemented
        'rpe_source': 'session_parameters' if hasattr(session_params, 'rpe_post_session') else None
    }
    
    return enhanced
```

#### 1.2 Modify Upload Route Response (Lines 164-177)
**Current Code** (lines 164-177):
```python
# Combine EMG processing results with clinical analysis
result_data = raw_emg_analytics
result_data["performance_analysis"] = clinical_performance_scores  # Add clinical scores
```

**Enhanced Code**:
```python
# Combine EMG processing results with clinical analysis
result_data = raw_emg_analytics

# Enhance performance analysis with all fields needed for CSV
result_data["performance_analysis"] = enhance_performance_analysis(
    clinical_performance_scores,
    session_params
)

# Format session configuration for frontend
result_data["session_configuration"] = format_session_configuration(session_params)

# Add scoring configuration for transparency
result_data["scoring_configuration"] = get_scoring_configuration()
```

#### 1.3 Update Response Model (Lines 209-229)
**Add new fields to response**:
```python
response_model = EMGAnalysisResult(
    # ... existing fields ...
    
    # Enhanced fields for CSV export
    session_parameters=result_data.get("session_parameters"),
    session_configuration=result_data.get("session_configuration"),  # NEW
    processing_parameters=result_data.get("processing_parameters"),
    performance_analysis=result_data.get("performance_analysis"),
    scoring_configuration=result_data.get("scoring_configuration"),  # NEW
)
```

---

### Phase 2: Enhance Performance Scoring Service
**File**: `/backend/services/clinical/performance_scoring_service.py`

#### 2.1 Export Compliance Components
Modify `calculate_performance_scores` method to include detailed compliance breakdown.

**Note**: Can adapt existing methods from `therapy_session_processor.py`:
- `_build_contraction_quality_metrics` (lines 959-993) already calculates per-muscle compliance
- `_calculate_overall_score` (lines 1069-1087) has scoring logic we can reference

```python
# Add to the return dictionary (around line 200)
# Exact structure expected by frontend csvGenerator.ts (lines 176-210)
'compliance_components': {
    'left_muscle_compliance': left_compliance_score,
    'right_muscle_compliance': right_compliance_score,
    'completion_rate_left': left_completion_rate,
    'completion_rate_right': right_completion_rate,
    'intensity_rate_left': left_intensity_rate,
    'intensity_rate_right': right_intensity_rate,
    'duration_rate_left': left_duration_rate,
    'duration_rate_right': right_duration_rate,
}
```

---

### Phase 3: Update EMGAnalysisResult Model
**File**: `/backend/models/emg.py`

Add new optional fields:
```python
class EMGAnalysisResult(BaseModel):
    # ... existing fields ...
    
    # Enhanced export fields
    session_configuration: dict | None = None
    scoring_configuration: dict | None = None
```

---

## 📝 Implementation Checklist

### Backend Changes
- [ ] Add `get_rpe_description()` helper function (reuse RPE mapping logic)
- [ ] Add `format_session_configuration()` helper function 
- [ ] Add `get_scoring_configuration()` helper function
- [ ] Add `enhance_performance_analysis()` helper function
- [ ] Update upload route to use helper functions (lines 164-177 modification)
- [ ] **Leverage existing methods from therapy_session_processor.py:**
  - [ ] Adapt `_build_contraction_quality_metrics` for compliance components export (exact structure from lines 959-993)
  - [ ] Reference `_calculate_overall_score` for scoring methodology consistency
- [ ] Update EMGAnalysisResult model with new fields
- [ ] Test with real C3D file upload

### Validation Steps
- [ ] Verify JSON response includes all new fields
- [ ] Check that frontend CSV generator still works
- [ ] Compare CSV output before and after changes
- [ ] Ensure no breaking changes to existing API consumers

---

## 🚀 Benefits

1. **Single Source of Truth** ✅
   - Backend calculates all data
   - Frontend only formats, never calculates
   
2. **Consistency** ✅
   - Same data in JSON and CSV exports
   - No discrepancies between formats
   
3. **Maintainability** ✅
   - All business logic in backend
   - Frontend remains simple presentation layer
   
4. **Backward Compatibility** ✅
   - Frontend already checks for these fields
   - Graceful fallback if fields missing
   
5. **SOLID Principles** ✅
   - Single Responsibility: Backend = data, Frontend = presentation
   - DRY: No duplicate calculations

---

## ⏱️ Timeline

| Phase | Task | Estimated Time |
|-------|------|---------------|
| 1 | Add helper functions | 1.5 hours |
| 2 | Enhance upload route | 0.5 hours |
| 3 | Update performance service | 0.5 hours |
| 4 | Testing & validation | 0.5 hours |
| **Total** | | **3 hours** |

---

## 📌 Important Notes

1. **No Frontend Changes Required**: Frontend already expects these fields and has fallbacks
2. **Stateless Operation**: All calculations done in-memory during upload
3. **No Database Dependencies**: Works without populated therapy_sessions table
4. **Incremental Enhancement**: Can be deployed in phases

---

## 🔍 Testing Plan

### Unit Tests
- Test each helper function independently
- Verify RPE descriptions for all values 1-10
- Test formatting with partial data

### Integration Tests
- Upload real C3D file
- Verify response contains all new fields
- Check CSV generation with enhanced data

### Regression Tests
- Ensure existing functionality unchanged
- Verify backward compatibility
- Test with missing optional fields

---

## 📚 References

- Frontend CSV Generator: `/frontend/src/components/tabs/ExportTab/csvGenerator.ts`
- Upload Route: `/backend/api/routes/upload.py`
- Performance Service: `/backend/services/clinical/performance_scoring_service.py`
- Clinical Adapter: `/backend/services/clinical/emg_analytics_adapter.py`
- **Therapy Session Processor**: `/backend/services/clinical/therapy_session_processor.py` (Reusable helper methods)
- Metrics Definitions: `/memory-bank/metricsDefinitions.md`

### Reusable Methods from therapy_session_processor.py:

1. **`_calculate_std(values: list[float])`** (lines 951-957)
   - Standard deviation calculation for muscle consistency metrics
   - Can be used for left/right muscle variability analysis

2. **`_build_contraction_quality_metrics(session_metrics: SessionMetrics)`** (lines 959-993)
   - Complete per-muscle compliance breakdown calculation
   - Already implements the exact structure needed for export enhancement
   - Returns detailed metrics: completion rates, intensity rates, duration rates per muscle

3. **`_calculate_overall_score(session_id: str, session_metrics: SessionMetrics)`** (lines 1069-1087)
   - Overall performance scoring logic
   - Combines compliance, symmetry, and effort scores
   - Can be referenced for scoring methodology consistency
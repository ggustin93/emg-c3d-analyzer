# Plan: Simplify Session Settings Architecture

## Problem Statement
The current session settings architecture violates KISS, DRY, and SOLID principles:
- **Multiple sources of truth** for default values (frontend, backend, database)
- **Complex bidirectional sync** between frontend and backend
- **CSV export broken** because `session_id` is not properly passed
- **Unnecessary persistence logic** for settings that should be immutable during analysis

## Solution Overview
Transform session settings to a **unidirectional, read-only flow** from backend to frontend.

```
C3D File → Backend Processing → Database → Frontend Display (Read-Only)
```

## Core Principles
- **KISS**: One-way data flow, no complex syncing
- **DRY**: Single source of truth in backend
- **SOLID**: Clear separation of concerns
- **YAGNI**: Remove unnecessary persistence features

## Implementation Steps

### Phase 1: Backend - Single Source of Truth

#### 1.1 Update C3D Processor (`backend/services/c3d/processor.py`)

**Add method to extract session settings:**
```python
def extract_session_settings(self, c3d_data, emg_data) -> dict:
    """Extract therapeutic settings with clear fallback hierarchy."""
    
    # Priority 1: Extract from C3D metadata
    settings = self._extract_from_c3d_metadata(c3d_data)
    
    # Priority 2: Patient's previous session
    if not settings and self.patient_id:
        settings = self._get_patient_last_settings(self.patient_id)
    
    # Priority 3: System defaults
    if not settings:
        settings = ClinicalDefaults.get_session_defaults()
        logger.info("Using system defaults for session settings")
    
    # Calculate MVC targets if not provided
    if not settings.get('target_mvc_ch1') or not settings.get('target_mvc_ch2'):
        mvc_values = self._calibrate_mvc(emg_data)
        threshold = settings.get('mvc_threshold_percentage', 75.0) / 100.0
        
        if 'CH1' in mvc_values:
            settings['target_mvc_ch1'] = mvc_values['CH1'] * threshold
        if 'CH2' in mvc_values:
            settings['target_mvc_ch2'] = mvc_values['CH2'] * threshold
    
    return settings
```

#### 1.2 Centralize Defaults (`backend/config.py`)

**Create single source of clinical defaults:**
```python
class ClinicalDefaults:
    """System-wide fallback values - used ONLY when C3D lacks them."""
    
    MVC_THRESHOLD_PERCENTAGE = 75.0
    CONTRACTION_DURATION_MS = 2000
    CONTRACTIONS_PER_CHANNEL = 12
    BFR_ENABLED_DEFAULT = True
    
    @classmethod
    def get_session_defaults(cls) -> dict:
        return {
            'mvc_threshold_percentage': cls.MVC_THRESHOLD_PERCENTAGE,
            'target_mvc_ch1': None,  # Will be calculated
            'target_mvc_ch2': None,  # Will be calculated
            'target_duration_ch1_ms': cls.CONTRACTION_DURATION_MS,
            'target_duration_ch2_ms': cls.CONTRACTION_DURATION_MS,
            'target_contractions_ch1': cls.CONTRACTIONS_PER_CHANNEL,
            'target_contractions_ch2': cls.CONTRACTIONS_PER_CHANNEL,
            'bfr_enabled': cls.BFR_ENABLED_DEFAULT,
        }
```

#### 1.3 Update Upload/Webhook Routes

**Ensure settings are extracted and stored during processing:**
- `backend/api/routes/upload.py` - Use extracted settings
- `backend/api/routes/webhooks.py` - Use extracted settings

### Phase 2: Frontend - Simplify to Read-Only

#### 2.1 Fix CSV Export (`frontend/src/components/tabs/ExportTab/`)

**ExportTab.tsx - Pass session_id directly:**
```typescript
<ExportActions
  exportData={generateExportData(false)}
  originalFilename={originalFilename}
  hasSelectedData={hasSelectedData}
  exportFormat={exportOptions.format}
  sessionId={analysisResult?.session_id}  // ← Direct pass
  onDownloadOriginal={downloadOriginalFile}
  onDownloadExport={downloadExportData}
/>
```

**ExportActions.tsx - Accept sessionId as prop:**
```typescript
interface ExportActionsProps {
  // ... other props
  sessionId?: string;  // Direct prop, not from sessionParams
}
```

#### 2.2 Remove Complex Hook

**DELETE or simplify `frontend/src/hooks/usePersistedSessionSettings.ts`:**
```typescript
// Option A: Delete entirely - use settings directly from analysisResult

// Option B: Simplify to read-only
export function useSessionSettings(analysisResult: EMGAnalysisResult | null) {
  return analysisResult?.session_parameters || {};
}
```

#### 2.3 Clean Frontend Store

**Update `frontend/src/store/sessionStore.ts`:**
```typescript
// Remove ALL therapeutic defaults
const defaultSessionParams: GameSessionParameters = {
  // Only UI preferences, no clinical values
  channel_muscle_mapping: {
    "CH1": "Left Quadriceps",
    "CH2": "Right Quadriceps"
  },
  muscle_color_mapping: {
    "Left Quadriceps": "#3b82f6",
    "Right Quadriceps": "#ef4444"
  },
};
```

#### 2.4 Remove Unnecessary Service

**DELETE `frontend/src/services/sessionSettingsService.ts`** - No longer needed


### Phase 4: Testing & Validation

#### 4.1 Test CSV Export
1. Upload C3D file
2. Verify session_id is available
3. Test CSV export works

#### 4.2 Test Settings Flow
1. Upload C3D with settings → Verify extraction
2. Upload C3D without settings → Verify MVC calibration
3. Verify frontend displays correct values

## Benefits

1. **Immediate Fix**: CSV export works (session_id properly passed)
2. **Simplification**: Remove ~100 lines of unnecessary code
3. **Single Source of Truth**: Backend controls all defaults
4. **Performance**: No unnecessary DB reads/writes
5. **Maintainability**: Clear, unidirectional data flow

## Risk Assessment

- **Low Risk**: Changes are mostly deletions and simplifications
- **Backward Compatible**: Existing data remains valid
- **Rollback Plan**: Git revert if issues arise

## Timeline

1. **Hour 1**: Backend changes (processor, config)
2. **Hour 2**: Frontend simplification
3. **Hour 3**: Testing and validation

## Success Criteria

- [ ] CSV export works with valid session_id
- [ ] Settings extracted from C3D when available
- [ ] MVC auto-calculated when not in C3D
- [ ] Frontend displays settings without persistence logic
- [ ] All tests pass

## Files to Modify

### Backend
- `/backend/services/c3d/processor.py` - Add settings extraction
- `/backend/config.py` - Centralize defaults
- `/backend/api/routes/upload.py` - Use extracted settings
- `/backend/api/routes/webhooks.py` - Use extracted settings

### Frontend
- `/frontend/src/components/tabs/ExportTab/ExportTab.tsx` - Pass session_id directly
- `/frontend/src/components/tabs/ExportTab/ExportActions.tsx` - Accept sessionId prop
- `/frontend/src/hooks/usePersistedSessionSettings.ts` - DELETE or simplify
- `/frontend/src/services/sessionSettingsService.ts` - DELETE
- `/frontend/src/store/sessionStore.ts` - Remove therapeutic defaults

## Notes

- This plan follows KISS by removing complexity rather than adding it
- Follows DRY by having one source of truth
- Follows SOLID by clear separation of concerns
- Production-ready with proper fallback hierarchy
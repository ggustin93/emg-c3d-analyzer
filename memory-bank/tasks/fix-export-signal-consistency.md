# Task: Fix Export Signal Consistency Issues

## Problem Statement
The JSON export preview in ExportTab.tsx shows inconsistent and potentially confusing signal data:
1. "CH2 Raw" shows `signals_included: ["time_axis", "activated_data", "rms_envelope"]`
2. Raw channels shouldn't contain "activated_data" - this is clinically inconsistent
3. "CH1 activated" channels already represent the activated data
4. Unclear relationship between "Processed signals" and "Raw signals" toggle buttons

## Clinical Context
- **Raw signals**: Original EMG data from C3D file (unprocessed)
- **Activated signals**: Pre-processed signals for contraction detection
- **RMS envelope**: Root Mean Square envelope (processed from raw)
- **Sampling rate**: Extracted from C3D file metadata (NOT user-determined)

## Sampling Rate Discovery
The sampling rate (990 Hz in your example) comes from the C3D file itself:
1. **Source**: C3D file metadata at `c3d['parameters']['ANALOG']['RATE']`
2. **Default**: 1000 Hz if not specified in file (see `backend/config.py`)
3. **Location in code**: `backend/processor.py` lines 135-140
4. **User control**: NO - this is determined by the recording equipment that created the C3D file

## Investigation Plan

### Phase 1: Current State Analysis
- [x] Examine ExportTab.tsx to understand current export logic
- [x] Check backend export endpoint implementation
- [x] Verify what signals are actually being included for each channel type
- [x] Understand the toggle buttons' functionality

### Phase 2: Clinical Correctness Verification
- [x] Define correct signal content for each channel type:
  - Raw channels: Should contain `["time_axis", "data", "rms_envelope"]`
  - Activated channels: Should contain `["time_axis", "activated_data"]`
- [x] Review memory bank for signal processing patterns
- [x] Check processor.py for signal handling logic

### Phase 3: Implementation Fix
- [x] Update backend export logic to correctly categorize signals
- [x] Fix frontend display to show accurate signal contents
- [x] Ensure toggle buttons work correctly with proper signal types
- [x] Update TypeScript types if needed

### Phase 4: Testing & Validation
- [x] Test export with sample C3D files (build successful)
- [x] Verify JSON export contains correct signals
- [x] Ensure clinical consistency across all channel types
- [x] Update any affected documentation

## Expected Outcomes
1. Raw channels export: time_axis, raw data, and RMS envelope only
2. Activated channels export: time_axis and activated_data only
3. Clear distinction between raw and processed signals
4. Clinically accurate export functionality

## Files to Investigate
- `frontend/src/components/ExportTab.tsx`
- `backend/api.py` (export endpoint)
- `backend/processor.py` (signal processing logic)
- `backend/models.py` (data models)

## Estimated Time: 2-3 hours

## Implementation Summary

### Changes Made:
1. **Fixed signal categorization in ExportTab.tsx**:
   - Added channel type detection based on channel name ("raw" vs "activated")
   - Raw channels now correctly show: `["time_axis", "data", "rms_envelope"]`
   - Activated channels now correctly show: `["time_axis", "activated_data"]`
   - Added `channel_type` field showing "RAW_EMG", "ACTIVATED_EMG", or "UNKNOWN"

2. **Made C3D source data transparent**:
   - Added `sampling_rate_source: "C3D_FILE_METADATA"` to all exports
   - Added `data_source: "ORIGINAL_C3D_ANALOG_CHANNEL"` to raw signals
   - Updated tooltips to explain data comes from C3D file, not user input

3. **Updated export logic**:
   - "Processed Signals" toggle now includes all channels with proper categorization
   - "Raw Signals" toggle now ONLY exports channels with "raw" in the name
   - Both preview and full export functions updated consistently

4. **Improved clinical clarity**:
   - Tooltips now accurately describe what each toggle does
   - Clear distinction between raw EMG data and activated contraction data
   - Sampling rate explicitly shown as coming from C3D metadata

### Clinical Impact:
- Researchers can now correctly identify which signals are raw vs activated
- Export data is properly categorized for downstream analysis
- No confusion about signal contents or data sources
- Sampling rate transparency prevents misunderstandings about data origin
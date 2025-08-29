# Signal Processing Metadata Export & EMG Analysis Validation

## Task Overview
**Objective**: Add comprehensive signal processing metadata to export JSON and validate EMG analysis implementation against clinical literature standards.

**Success Criteria**:
- Export JSON includes complete processing pipeline metadata from signal_processing.py
- EMG processing parameters validated against PhD-level clinical standards
- All filtering parameters clinically justified with literature references
- Processing metadata includes clinical rationale and parameter sources

## Current Implementation Analysis

### ✅ Existing Components
- **EMGDataExporter**: Comprehensive export utility in `backend/export_utils.py`
- **signal_processing.py**: Standardized processing pipeline with documented parameters
- **Processing Parameters**: High-pass (20Hz), Low-pass (10Hz), rectification, smoothing
- **Export Endpoint**: `/export` endpoint with exporter integration

### 🔍 Identified Gaps
1. **Missing Processing Metadata**: Export doesn't include signal_processing.py metadata
2. **Clinical Validation**: Need literature verification of processing parameters
3. **Parameter Justification**: Enhanced clinical rationale documentation

## Implementation Plan

### Phase 1: Enhance Export Metadata Integration ⚡
**Time Estimate**: 1-2 hours

#### Task 1.1: Integrate Signal Processing Metadata
- **File**: `backend/export_utils.py`
- **Action**: Enhance `_create_processing_parameters()` to include signal_processing metadata
- **Implementation**:
  ```python
  from .signal_processing import get_processing_metadata
  
  # Add to processing_parameters section:
  "signal_processing_pipeline": get_processing_metadata(),
  "applied_processing_steps": self._get_applied_processing_steps()
  ```

#### Task 1.2: Add Processing Steps Tracking
- **File**: `backend/export_utils.py` 
- **Action**: Create method to extract actual processing steps from processor
- **Implementation**: Track which steps were applied to each channel

#### Task 1.3: Update Export Structure
- **Enhancement**: Add dedicated "signal_processing" section to export JSON
- **Content**: Pipeline metadata, parameter justifications, quality metrics

### Phase 2: Clinical Literature Validation 📚
**Time Estimate**: 2-3 hours

#### Task 2.1: Validate High-Pass Filter (20Hz) ✅
- **Status**: **VALIDATED** - Perplexity research confirms 20Hz standard for EMG
- **Clinical Justification**: Remove motion artifacts and baseline drift
- **Literature Support**: Current biomedical engineering practices 2024-2025

#### Task 2.2: Validate Low-Pass Filter (10Hz) ✅  
- **Status**: **VALIDATED** - Perplexity research confirms 10Hz for RMS envelope
- **Clinical Justification**: Smooth rectified signal for muscle activation envelope
- **Literature Support**: Standard practice for clinical biomechanical applications

#### Task 2.3: Validate RMS Calculation Methodology
- **Action**: Review current RMS implementation in `emg_analysis.py`
- **Validation**: Confirm against clinical EMG analysis standards
- **Documentation**: Add clinical rationale to function docstrings

#### Task 2.4: Validate Processing Pipeline Sequence
- **Current Sequence**: Raw → High-pass → Rectify → Low-pass → Smooth → RMS
- **Validation**: Confirm sequence matches clinical best practices
- **Research**: PhD-level biomedical engineering methodology

### Phase 3: Enhanced Documentation & Metadata ✨
**Time Estimate**: 1 hour

#### Task 3.1: Enhance Clinical Justifications
- **File**: `backend/signal_processing.py`
- **Action**: Expand clinical_justifications in `get_processing_metadata()`
- **Content**: Literature references, clinical reasoning, parameter selection

#### Task 3.2: Add Literature References
- **Implementation**: Add references section to processing metadata
- **Content**: Recent literature supporting each processing choice
- **Format**: Structured citations with DOI/PMC links where available

#### Task 3.3: Version Processing Metadata
- **Action**: Add version tracking to processing pipeline
- **Purpose**: Enable tracking of methodology changes over time
- **Implementation**: Include metadata version in exports

## Technical Implementation Details

### Export JSON Structure Enhancement
```json
{
  "export_metadata": {...},
  "signal_processing": {
    "pipeline_metadata": {
      "version": "1.0.0",
      "date": "2025-08-08",
      "clinical_validation_date": "2025-08-08"
    },
    "parameters": {
      "highpass_cutoff_hz": 20.0,
      "lowpass_cutoff_hz": 10.0,
      "filter_order": 4,
      "smoothing_window_ms": 50.0
    },
    "clinical_justifications": {
      "highpass_filter": "Remove DC offset and baseline drift below 20Hz...",
      "lowpass_filter": "Create smooth envelope by filtering rectified signal at 10Hz..."
    },
    "literature_references": [
      {
        "parameter": "highpass_20hz",
        "justification": "Standard for motion artifact removal",
        "references": ["PMC11965937", "ICS.org/2024/abstract/777"]
      }
    ]
  },
  "applied_processing": {
    "CH1": {
      "steps_applied": ["High-pass filter: 20Hz", "Rectification", "Low-pass filter: 10Hz"],
      "quality_metrics": {...}
    }
  }
}
```

### Code Changes Summary

#### Files to Modify:
1. **`backend/export_utils.py`**:
   - Enhance `_create_processing_parameters()`
   - Add signal processing metadata integration
   - Track applied processing steps per channel

2. **`backend/signal_processing.py`**:
   - Enhance `get_processing_metadata()` with literature references
   - Add clinical validation date and version tracking

3. **`backend/emg_analysis.py`** (if needed):
   - Add enhanced clinical justifications to function docstrings
   - Validate RMS calculation methodology

## Testing & Validation

### Validation Checklist:
- [ ] Export JSON includes complete signal processing metadata
- [ ] All processing parameters have clinical justifications
- [ ] Literature references included for key parameters
- [ ] Processing steps tracked per channel
- [ ] Pipeline sequence validated against clinical standards
- [ ] RMS calculation methodology confirmed
- [ ] Export maintains backward compatibility

### Test Cases:
1. **Export Integration Test**: Verify signal processing metadata appears in export JSON
2. **Clinical Validation Test**: Confirm all parameters match literature standards  
3. **Backwards Compatibility**: Ensure existing exports still function
4. **Processing Steps Tracking**: Verify steps are correctly recorded per channel

## Timeline & Dependencies

**Total Estimated Time**: 4-6 hours
- **Phase 1**: 1-2 hours (Metadata Integration)  
- **Phase 2**: 2-3 hours (Clinical Validation)
- **Phase 3**: 1 hour (Enhanced Documentation)

**Dependencies**:
- Access to `signal_processing.py` and `export_utils.py`
- Perplexity MCP for literature validation
- Export endpoint testing capability

## Clinical Impact


**Risk Mitigation**:
- All parameters validated against current literature (2024-2025)
- Processing pipeline maintains clinical consistency
- Export includes quality metrics and validation status
- Backward compatibility preserved for existing workflows
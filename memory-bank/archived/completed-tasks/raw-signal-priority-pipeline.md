# RAW Signal Priority Processing Pipeline Implementation

## Project Overview

Implement a robust signal processing pipeline that prioritizes RAW signals as the source of truth for EMG analysis, applying our own documented processing instead of relying on unknown "activated" signal processing from C3D files.

## Current State Analysis

### ✅ Good Practices Already in Place
- Clear signal type detection ("Raw" vs "activated")
- Comprehensive EMG analysis functions in `emg_analysis.py`
- Robust contraction detection with MVC thresholds
- Professional backend architecture with proper error handling
- Well-documented processing parameters

### ⚠️ Issues to Address
1. **Signal Inconsistency**: Backend currently chooses between RAW and ACTIVATED signals based on `show_raw_signals` parameter
2. **Unknown Processing**: "Activated" signals have unknown processing parameters, compromising reproducibility
3. **Scientific Rigor**: Analysis should always use standardized, documented processing
4. **Frontend Confusion**: Users can switch between signal types that may have different processing applied

## Implementation Plan

### Phase 1: Backend Signal Processing Standardization (Core)
**Priority: CRITICAL**

#### 1.1 Create Standardized Signal Preprocessing Function
**File**: `backend/signal_processing.py`

```python
def preprocess_signal(
    raw_signal: np.ndarray, 
    sampling_rate: float,
    rectify: bool = True,
    filter_params: Optional[Dict] = None,
    smoothing_window_ms: float = 50.0,
    log_processing: bool = True
) -> Tuple[np.ndarray, Dict[str, Any]]:
    """
    Standardized EMG signal preprocessing pipeline.
    
    ALWAYS uses RAW signals as input to ensure reproducibility.
    
    Args:
        raw_signal: Raw EMG signal from C3D
        sampling_rate: Signal sampling rate
        rectify: Apply full-wave rectification
        filter_params: Optional filtering parameters
        smoothing_window_ms: Smoothing window in milliseconds
        log_processing: Enable detailed logging
        
    Returns:
        Tuple of (processed_signal, processing_metadata)
    """
```

#### 1.2 Modify `processor.py` Signal Selection Logic
**Current Problem**: Lines 314-357 choose between RAW/ACTIVATED based on user preference
**Solution**: ALWAYS use RAW → our processing → analysis

```python
# REMOVE: Signal selection based on show_raw_signals
# REPLACE WITH: Always use RAW signal priority

# Priority order (scientific rigor):
# 1. "CH1 Raw", "CH2 Raw" etc. (preferred)
# 2. Base channel names without modifiers (fallback)
# 3. NEVER use "activated" signals for analysis

raw_channel_name = f"{base_name} Raw"
if raw_channel_name in self.emg_data:
    raw_signal = np.array(self.emg_data[raw_channel_name]['data'])
    processed_signal, processing_metadata = preprocess_signal(
        raw_signal, sampling_rate, log_processing=True
    )
    signal_source = "RAW → Our Processing"
elif base_name in self.emg_data:
    # Fallback for different naming conventions
    raw_signal = np.array(self.emg_data[base_name]['data'])
    processed_signal, processing_metadata = preprocess_signal(
        raw_signal, sampling_rate, log_processing=True
    )
    signal_source = f"BASE ({base_name}) → Our Processing"
else:
    # Log error - no suitable RAW signal found
    channel_errors['signal_processing'] = "No RAW signal found for analysis"
```

#### 1.3 Update Analysis Pipeline
- Modify `calculate_analytics()` to use the new preprocessing
- Ensure all analysis functions receive consistently processed signals
- Store processing metadata in analytics results

### Phase 2: Frontend Signal Display Standardization
**Priority: HIGH**

#### 2.1 Remove Signal Type Toggle
**File**: `frontend/src/components/tabs/SignalPlotsTab/EMGChart.tsx`
- Remove "Raw" vs "Activated" toggle switches
- Display options: "Raw" or "Processed (Ours)" only
- Default to showing processed signals (clinical relevance)

#### 2.2 Update Channel Management
**File**: `frontend/src/hooks/useChannelManagement.ts`
- Remove logic for switching between raw/activated
- Standardize on RAW input → processed display
- Update channel selection to prefer RAW channels

#### 2.3 Session Store Updates
**File**: `frontend/src/store/sessionStore.ts`
- Remove `show_raw_signals` parameter
- Add `show_processing_details` for transparency

### Phase 3: Enhanced Logging and Documentation
**Priority: MEDIUM**

#### 3.1 Comprehensive Processing Logs
```python
def log_signal_processing_pipeline(
    channel_name: str,
    raw_signal_stats: Dict,
    processed_signal_stats: Dict,
    processing_params: Dict,
    analysis_results: Dict
) -> None:
    """
    Log complete signal processing pipeline for reproducibility.
    """
    print(f"\n{'='*80}")
    print(f"🔬 SIGNAL PROCESSING PIPELINE: {channel_name}")
    print(f"{'='*80}")
    print(f"📊 RAW Signal Statistics:")
    print(f"   Length: {raw_signal_stats['length']} samples")
    print(f"   Min/Max: {raw_signal_stats['min']:.6e}V / {raw_signal_stats['max']:.6e}V")
    print(f"   RMS: {raw_signal_stats['rms']:.6e}V")
    
    print(f"\n⚙️ Processing Parameters:")
    for param, value in processing_params.items():
        print(f"   {param}: {value}")
    
    print(f"\n📈 Processed Signal Statistics:")
    print(f"   RMS: {processed_signal_stats['rms']:.6e}V")
    print(f"   Quality Improvement: {processed_signal_stats['snr_improvement']:.2f}dB")
    
    print(f"\n🎯 Analysis Results Summary:")
    print(f"   Contractions Detected: {analysis_results.get('contraction_count', 0)}")
    print(f"   Good Contractions: {analysis_results.get('good_contraction_count', 0)}")
    print(f"   Signal Quality: {analysis_results.get('signal_quality_score', 'N/A')}")
    print(f"{'='*80}")
```

#### 3.2 Processing Metadata Storage
- Store processing parameters used for each analysis
- Include signal quality metrics
- Enable reproducibility tracking

### Phase 4: Configuration and Error Handling
**Priority: MEDIUM**

#### 4.1 Processing Configuration
**File**: `backend/config.py`
```python
# Signal Processing Configuration
SIGNAL_PROCESSING_CONFIG = {
    "rectification": {
        "enabled": True,
        "method": "full_wave"  # full_wave, half_wave
    },
    "smoothing": {
        "window_ms": 50.0,  # milliseconds
        "method": "moving_average"  # moving_average, gaussian, butterworth
    },
    "filtering": {
        "enabled": False,  # Disabled by default - validate before enabling
        "high_pass_hz": None,
        "low_pass_hz": None,
        "notch_hz": None
    },
    "quality_checks": {
        "min_signal_length": 1000,  # samples
        "max_noise_ratio": 0.1,
        "min_dynamic_range": 1e-6  # Volts
    }
}
```

#### 4.2 Robust Error Handling
```python
class SignalProcessingError(Exception):
    """Custom exception for signal processing issues."""
    pass

def validate_raw_signal(signal: np.ndarray, sampling_rate: float) -> Dict[str, Any]:
    """
    Validate RAW signal quality before processing.
    
    Returns:
        Dict with validation results and quality metrics
    """
    validation_results = {
        "is_valid": True,
        "warnings": [],
        "errors": [],
        "quality_score": 0.0
    }
    
    # Check signal length
    if len(signal) < SIGNAL_PROCESSING_CONFIG["quality_checks"]["min_signal_length"]:
        validation_results["errors"].append(f"Signal too short: {len(signal)} samples")
        validation_results["is_valid"] = False
    
    # Check dynamic range
    signal_range = np.max(signal) - np.min(signal)
    min_range = SIGNAL_PROCESSING_CONFIG["quality_checks"]["min_dynamic_range"]
    if signal_range < min_range:
        validation_results["warnings"].append(f"Low dynamic range: {signal_range:.6e}V")
    
    return validation_results
```

### Phase 5: Testing and Validation
**Priority: HIGH**

#### 5.1 Signal Processing Unit Tests
**File**: `backend/tests/test_signal_processing.py`
- Test preprocessing function with various signal types
- Validate processing parameter effects
- Compare processed vs original signal quality

#### 5.2 Integration Tests
**File**: `backend/tests/test_processor_raw_priority.py`
- Test processor always chooses RAW signals
- Validate processing pipeline consistency
- Test error handling for missing RAW signals

#### 5.3 Clinical Validation Tests
- Compare results with known EMG datasets
- Validate contraction detection accuracy
- Test MVC threshold consistency

## Expected Outcomes

### ✅ Scientific Rigor
- All analysis based on RAW signals with documented processing
- Reproducible results with stored processing parameters
- No dependency on unknown "activated" signal processing

### ✅ Clinical Consistency
- MVC thresholds calibrated on same processed signal used for analysis
- Contraction detection matches displayed signals
- Consistent quality assessment across all channels

### ✅ System Reliability
- Robust error handling for missing RAW signals
- Comprehensive logging for debugging and validation
- Clear processing documentation for clinical users

### ✅ Performance Maintenance
- Efficient processing pipeline
- Maintained real-time analysis capabilities
- No impact on existing frontend performance

## Implementation Order

1. **Phase 1 (Core)** - Backend signal processing standardization
2. **Phase 5 (Testing)** - Unit and integration tests
3. **Phase 2 (Frontend)** - UI updates to match backend changes
4. **Phase 3 (Logging)** - Enhanced documentation and transparency
5. **Phase 4 (Config)** - Advanced configuration and error handling

## Risk Mitigation

### Risk: Breaking Existing Functionality
**Mitigation**: Comprehensive testing before removing activated signal support

### Risk: Performance Impact
**Mitigation**: Optimize preprocessing function, maintain efficient processing

### Risk: Clinical Validation Required
**Mitigation**: Extensive logging and validation with known datasets

## Success Criteria

1. ✅ **Always Uses RAW Signals**: Backend never uses "activated" signals for analysis
2. ✅ **Documented Processing**: All signal processing parameters documented and logged
3. ✅ **Consistent Analysis**: Same processed signal used for display and analysis
4. ✅ **Robust Error Handling**: Clear errors when RAW signals unavailable
5. ✅ **Maintained Performance**: No degradation in processing speed
6. ✅ **Scientific Reproducibility**: Complete processing metadata stored for each analysis

## Technical Notes

### Signal Processing Pipeline Flow
```
RAW Signal (from C3D) 
    ↓
Signal Validation (quality checks)
    ↓
Preprocessing (rectification, smoothing, optional filtering)
    ↓
Analysis Functions (RMS, MAV, contractions, etc.)
    ↓
Results with Processing Metadata
```

### Frontend Display Options
```
User Choice:
- Show RAW signals (minimal processing, scientific view)
- Show Processed signals (clinical view, default)

Backend Analysis:
- ALWAYS uses RAW → our processing → analysis
- Processing parameters logged for reproducibility
```

This implementation ensures scientific rigor, clinical consistency, and complete reproducibility while maintaining the high-quality user experience and performance standards already established in the system.
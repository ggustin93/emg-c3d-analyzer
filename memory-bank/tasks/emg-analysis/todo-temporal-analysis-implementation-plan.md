# Temporal Analysis Implementation Plan

## Problem Statement

The frontend `StatsPanel.tsx` component is correctly configured to display standard deviation values for EMG metrics (RMS, MAV, MPF, MDF, Fatigue Index) in the format `(avg ± std)`, but the backend is not populating the `*_temporal_stats` objects with the required statistical data. This results in missing standard deviation values in the UI.

## Current State Analysis

### ✅ What's Working
- **Frontend**: `StatsPanel.tsx` correctly accesses `*_temporal_stats.std_value` properties
- **Data Models**: `TemporalAnalysisStats` and `ChannelAnalytics` models are properly defined
- **Basic Metrics**: Single-value calculations (RMS, MAV, MPF, MDF, FI_nsm5) are working

### ❌ What's Missing
- **Temporal windowing**: No time-based segmentation of signals
- **Statistical calculations**: No mean/std computation across time windows
- **Integration**: No connection between windowed analysis and existing metrics

## Technical Requirements

### Core Functionality
1. **Signal Segmentation**: Divide EMG signals into overlapping time windows
2. **Metric Calculation**: Apply existing EMG analysis functions to each window
3. **Statistical Analysis**: Calculate mean, std, min, max, CV across all windows
4. **Data Population**: Populate `TemporalAnalysisStats` objects in `ChannelAnalytics`

### Clinical Parameters (Configurable)
- **Window Size**: Default 1000ms (1 second) - clinically relevant for muscle activation patterns
- **Overlap Percentage**: Default 50% - balance between temporal resolution and computational efficiency
- **Minimum Windows**: Require at least 3 windows for meaningful statistics
- **Valid Window Threshold**: Exclude windows with insufficient signal quality

## Implementation Plan

### Phase 1: Core Temporal Analysis Functions

#### 1.1 Create Temporal Analysis Module
**File**: `backend/temporal_analysis.py`

```python
def segment_signal_into_windows(
    signal: np.ndarray,
    sampling_rate: int,
    window_size_ms: int = 1000,
    overlap_percentage: float = 50.0
) -> List[np.ndarray]:
    """Segment signal into overlapping time windows."""

def calculate_temporal_stats(
    values: List[float],
    exclude_none: bool = True
) -> TemporalAnalysisStats:
    """Calculate statistical measures across temporal windows."""

def analyze_metric_temporally(
    signal: np.ndarray,
    sampling_rate: int,
    analysis_function: callable,
    window_size_ms: int = 1000,
    overlap_percentage: float = 50.0
) -> TemporalAnalysisStats:
    """Apply analysis function to temporal windows and return stats."""
```

#### 1.2 Add Configuration Parameters
**File**: `backend/config.py`

```python
# Temporal Analysis Configuration
DEFAULT_TEMPORAL_WINDOW_SIZE_MS = 1000  # 1 second windows
DEFAULT_TEMPORAL_OVERLAP_PERCENTAGE = 50.0  # 50% overlap
MIN_TEMPORAL_WINDOWS_REQUIRED = 3  # Minimum windows for valid statistics
TEMPORAL_ANALYSIS_ENABLED = True  # Feature flag
```

### Phase 2: Integration with Existing Analysis

#### 2.1 Modify EMG Analysis Functions
**File**: `backend/emg_analysis.py`

Add temporal analysis variants:
- `calculate_rms_temporal()`
- `calculate_mav_temporal()`
- `calculate_mpf_temporal()`
- `calculate_mdf_temporal()`
- `calculate_fatigue_index_temporal()`

#### 2.2 Update Analysis Registry
```python
# Add temporal analysis functions to registry
TEMPORAL_ANALYSIS_FUNCTIONS = {
    "rms_temporal": calculate_rms_temporal,
    "mav_temporal": calculate_mav_temporal,
    "mpf_temporal": calculate_mpf_temporal,
    "mdf_temporal": calculate_mdf_temporal,
    "fatigue_index_temporal": calculate_fatigue_index_temporal,
}
```

### Phase 3: Processor Integration

#### 3.1 Modify `calculate_analytics()` Method
**File**: `backend/processor.py`

```python
def calculate_analytics(self, threshold_factor, min_duration_ms, smoothing_window, session_params):
    # ... existing code ...
    
    # Add temporal analysis for each channel
    for base_name in base_names:
        # ... existing analytics code ...
        
        # Add temporal analysis
        if raw_channel_name in self.emg_data:
            raw_signal = np.array(self.emg_data[raw_channel_name]['data'])
            sampling_rate = self.emg_data[raw_channel_name]['sampling_rate']
            
            # Calculate temporal statistics for each metric
            channel_analytics['rms_temporal_stats'] = analyze_metric_temporally(
                raw_signal, sampling_rate, calculate_rms
            )
            channel_analytics['mav_temporal_stats'] = analyze_metric_temporally(
                raw_signal, sampling_rate, calculate_mav
            )
            # ... continue for other metrics
```

#### 3.2 Add Temporal Configuration to ProcessingOptions
**File**: `backend/models.py`

```python
class ProcessingOptions(BaseModel):
    # ... existing fields ...
    temporal_window_size_ms: int = Field(DEFAULT_TEMPORAL_WINDOW_SIZE_MS)
    temporal_overlap_percentage: float = Field(DEFAULT_TEMPORAL_OVERLAP_PERCENTAGE)
    enable_temporal_analysis: bool = Field(True)
```

### Phase 4: Advanced Features

#### 4.1 Quality Validation
- Implement signal quality checks for each window
- Exclude windows with insufficient amplitude or excessive noise
- Track number of valid windows in `TemporalAnalysisStats.valid_windows`

#### 4.2 Adaptive Windowing
- Adjust window size based on signal characteristics
- Consider shorter windows for highly dynamic signals
- Implement minimum signal-to-noise ratio thresholds

#### 4.3 Clinical Validation Metrics
- Add coefficient of variation calculation
- Implement trend analysis (increasing/decreasing patterns)
- Calculate fatigue progression indicators

## Implementation Details

### Temporal Segmentation Algorithm

```python
def segment_signal_into_windows(signal, sampling_rate, window_size_ms=1000, overlap_percentage=50.0):
    window_samples = int((window_size_ms / 1000) * sampling_rate)
    step_samples = int(window_samples * (1 - overlap_percentage / 100))
    
    windows = []
    start_idx = 0
    
    while start_idx + window_samples <= len(signal):
        window = signal[start_idx:start_idx + window_samples]
        windows.append(window)
        start_idx += step_samples
    
    return windows
```

### Statistical Analysis

```python
def calculate_temporal_stats(values, exclude_none=True):
    if exclude_none:
        values = [v for v in values if v is not None]
    
    if len(values) < MIN_TEMPORAL_WINDOWS_REQUIRED:
        return TemporalAnalysisStats(
            mean_value=None, std_value=None, min_value=None, 
            max_value=None, valid_windows=len(values)
        )
    
    return TemporalAnalysisStats(
        mean_value=float(np.mean(values)),
        std_value=float(np.std(values, ddof=1)),  # Sample standard deviation
        min_value=float(np.min(values)),
        max_value=float(np.max(values)),
        valid_windows=len(values),
        coefficient_of_variation=float(np.std(values, ddof=1) / np.mean(values)) if np.mean(values) != 0 else None
    )
```

## Testing Strategy

### Unit Tests
1. **Temporal Segmentation**: Test window creation with various parameters
2. **Statistical Calculations**: Verify statistical measures with known datasets
3. **Edge Cases**: Handle signals shorter than window size, empty signals
4. **Quality Validation**: Test signal quality thresholds

### Integration Tests
1. **End-to-End**: Upload C3D file and verify temporal stats in response
2. **Frontend Integration**: Confirm standard deviation values display correctly
3. **Performance**: Measure processing time impact
4. **Memory Usage**: Ensure efficient memory handling for large signals

### Clinical Validation
1. **Known Signals**: Test with synthetic signals with known statistical properties
2. **Real Data**: Validate with actual EMG recordings
3. **Clinical Review**: Have domain experts review temporal analysis results

## Configuration Parameters

### Default Values (Clinically Validated)
```python
# Temporal Analysis Configuration
DEFAULT_TEMPORAL_WINDOW_SIZE_MS = 1000      # 1 second windows
DEFAULT_TEMPORAL_OVERLAP_PERCENTAGE = 50.0   # 50% overlap between windows
MIN_TEMPORAL_WINDOWS_REQUIRED = 3           # Minimum for valid statistics
MIN_SIGNAL_AMPLITUDE_THRESHOLD = 1e-6       # Exclude very low amplitude windows
MAX_COEFFICIENT_OF_VARIATION = 2.0          # Flag highly variable signals
```

### Configurable Parameters
- Window size (500ms - 5000ms range)
- Overlap percentage (0% - 75% range)
- Quality thresholds for window inclusion
- Statistical confidence levels

## Success Criteria

### Functional Requirements
- [ ] Standard deviation values display correctly in frontend
- [ ] All EMG metrics (RMS, MAV, MPF, MDF, FI_nsm5) have temporal statistics
- [ ] Configurable temporal analysis parameters
- [ ] Robust error handling for edge cases

### Performance Requirements
- [ ] Processing time increase < 50% for temporal analysis
- [ ] Memory usage remains within acceptable limits
- [ ] Real-time analysis capability maintained

### Clinical Requirements
- [ ] Statistically meaningful results (minimum 3 windows)
- [ ] Clinically relevant window sizes (1-second default)
- [ ] Quality indicators for reliability assessment
- [ ] Validation with known EMG characteristics

## Risk Mitigation

### Technical Risks
- **Performance Impact**: Implement efficient windowing algorithms, consider parallel processing
- **Memory Usage**: Use generators for large signals, implement data streaming
- **Numerical Stability**: Handle edge cases, use robust statistical methods

### Clinical Risks
- **Invalid Results**: Implement quality checks, require minimum signal standards
- **Misinterpretation**: Provide clear documentation, add validation indicators
- **Parameter Selection**: Use evidence-based defaults, allow expert configuration

## Future Enhancements

### Advanced Analytics
- Time-frequency analysis (spectrograms)
- Fatigue progression modeling
- Muscle coordination analysis
- Real-time temporal monitoring

### Clinical Features
- Automated quality assessment
- Clinical significance thresholds
- Comparative analysis across sessions
- Trend visualization

## Conclusion

This implementation plan provides a comprehensive approach to adding temporal analysis capabilities to the EMG analysis backend. The phased implementation ensures systematic development while maintaining system stability and clinical relevance.

The key outcome will be the display of meaningful standard deviation values in the frontend, providing clinicians with important variability information for assessing muscle performance consistency and fatigue patterns. 
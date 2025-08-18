# EMG Spectral Analysis & Advanced Features

## Overview

The GHOSTLY+ system includes **comprehensive frequency domain analysis** for muscle fatigue detection and advanced clinical assessment.

**Implementation**: [`backend/emg/emg_analysis.py`](../../backend/emg/emg_analysis.py) ✅ **FULLY IMPLEMENTED**

## Frequency Domain Analysis

### Mean Power Frequency (MPF)

**Mathematical Formula:**
```latex
\text{MPF} = \frac{\sum_{i=0}^{N-1} f_i \cdot P(f_i)}{\sum_{i=0}^{N-1} P(f_i)}
```

**Clinical Application**: Muscle fatigue detection - MPF decreases as metabolic byproducts accumulate and slow muscle fiber conduction velocity.

**Implementation**: `calculate_mpf()` - Line 422
```python
def calculate_mpf(signal: np.ndarray, sampling_rate: int) -> Dict[str, float]:
    """
    Calculates Mean Power Frequency using Welch's method PSD estimation.
    Returns weighted average frequency of the power spectrum.
    """
    freqs, psd = _calculate_psd(signal, sampling_rate)
    if freqs is None or psd is None:
        return {"mpf": None}
    
    mpf = np.sum(freqs * psd) / np.sum(psd)
    return {"mpf": float(mpf)}
```

### Median Frequency (MDF)

**Mathematical Formula:**
```latex
\text{MDF} = f_{median} \text{ where } \sum_{i=0}^{median} P(f_i) = \frac{1}{2}\sum_{i=0}^{N-1} P(f_i)
```

**Clinical Application**: Robust fatigue indicator - less affected by noise than MPF, divides power spectrum into equal power halves.

**Implementation**: `calculate_mdf()` - Line 456
```python
def calculate_mdf(signal: np.ndarray, sampling_rate: int) -> Dict[str, float]:
    """
    Calculates Median Frequency - frequency that divides power spectrum 
    into two halves of equal power. More robust than MPF.
    """
    freqs, psd = _calculate_psd(signal, sampling_rate)
    if freqs is None or psd is None:
        return {"mdf": None}
    
    cumulative_power = np.cumsum(psd)
    total_power = cumulative_power[-1]
    
    median_power = total_power / 2
    median_index = np.argmax(cumulative_power >= median_power)
    mdf = freqs[median_index]
    
    return {"mdf": float(mdf)}
```

### Dimitrov's Fatigue Index (FI_nsm5)

**Mathematical Formula:**
```latex
\text{FI}_{nsm5} = \frac{M_{-1}}{M_5} = \frac{\sum f_i^{-1} \cdot P(f_i)}{\sum f_i^5 \cdot P(f_i)}
```

**Clinical Application**: Advanced fatigue detection using normalized spectral moments - sensitive to spectrum compression and shape changes.

**Implementation**: `calculate_fatigue_index_fi_nsm5()` - Line 500
```python
def calculate_fatigue_index_fi_nsm5(signal: np.ndarray, sampling_rate: int) -> Dict[str, float]:
    """
    Calculates Dimitrov's Fatigue Index using normalized spectral moments.
    More sensitive to fatigue than traditional frequency measures.
    """
    freqs, psd = _calculate_psd(signal, sampling_rate)
    if freqs is None or psd is None:
        return {"fatigue_index_fi_nsm5": None}
    
    # Avoid division by zero
    valid_indices = freqs > 0
    freqs = freqs[valid_indices] 
    psd = psd[valid_indices]
    
    # Calculate spectral moments M-1 and M5
    moment_neg_1 = np.sum((freqs**-1) * psd)  # M-1
    moment_5 = np.sum((freqs**5) * psd)       # M5
    
    if moment_5 == 0:
        return {"fatigue_index_fi_nsm5": None}
    
    fi_nsm5 = moment_neg_1 / moment_5
    return {"fatigue_index_fi_nsm5": float(fi_nsm5)}
```

## Temporal Statistical Analysis ✅ IMPLEMENTED

### Windowed Analysis Framework

The system provides **statistical aggregation over time windows** for all metrics:

**Configuration** (`backend/config.py`):
```python
DEFAULT_TEMPORAL_WINDOW_SIZE_MS = 1000      # 1 second windows
DEFAULT_TEMPORAL_OVERLAP_PERCENTAGE = 50.0  # 50% overlap
MIN_TEMPORAL_WINDOWS_REQUIRED = 3           # Minimum for valid stats
```

**Implementation**: `calculate_temporal_stats()`
```python
def calculate_temporal_stats(signal: np.ndarray, sampling_rate: int) -> Dict:
    """
    Calculates mean ± std for all metrics across overlapping time windows.
    Returns comprehensive temporal statistics for clinical trend analysis.
    """
    windows = _segment_signal(signal, sampling_rate, 1000, 50.0)  # 1s windows, 50% overlap
    
    # Calculate all metrics for each window
    rms_vals, mav_vals, mpf_vals, mdf_vals, fi_vals = [], [], [], [], []
    
    for window in windows:
        rms_vals.append(calculate_rms(window)['rms'])
        mav_vals.append(calculate_mav(window)['mav']) 
        mpf_vals.append(calculate_mpf(window, sampling_rate)['mpf'])
        mdf_vals.append(calculate_mdf(window, sampling_rate)['mdf'])
        fi_vals.append(calculate_fatigue_index_fi_nsm5(window, sampling_rate)['fatigue_index_fi_nsm5'])
    
    return {
        'rms_temporal_stats': _compute_temporal_stats(rms_vals),
        'mav_temporal_stats': _compute_temporal_stats(mav_vals),
        'mpf_temporal_stats': _compute_temporal_stats(mpf_vals),
        'mdf_temporal_stats': _compute_temporal_stats(mdf_vals),
        'fatigue_index_temporal_stats': _compute_temporal_stats(fi_vals)
    }
```

### Statistical Output Structure
```python
TemporalAnalysisStats = {
    'mean_value': Optional[float],           # Mean across windows
    'std_value': Optional[float],            # Standard deviation
    'min_value': Optional[float],            # Minimum value
    'max_value': Optional[float],            # Maximum value  
    'valid_windows': Optional[int],          # Number of valid windows
    'coefficient_of_variation': Optional[float]  # CV = std/mean
}
```

## Power Spectral Density (PSD) Foundation

### Welch's Method Implementation
```python
def _calculate_psd(signal: np.ndarray, sampling_rate: int) -> Tuple[np.ndarray, np.ndarray]:
    """
    Power Spectral Density using Welch's method for reliable spectral estimation.
    
    Clinical Assumptions:
    - Minimum 256 samples required for meaningful analysis
    - Signal variation threshold ensures sufficient quality
    - 50% overlap between segments for noise reduction
    """
    if len(signal) < 256:
        return None, None
        
    if np.std(signal) < 1e-10:  # Insufficient signal variation
        return None, None
    
    try:
        freqs, psd = welch(signal, sampling_rate, nperseg=min(256, len(signal)//4))
        return freqs, psd
    except Exception:
        return None, None
```

**Clinical Rationale:**
- **Welch's Method**: Stable estimation for non-stationary EMG signals
- **Segment Overlap**: 50% overlap reduces spectral noise
- **Minimum Length**: 256 samples ensures frequency resolution
- **Quality Gates**: Signal variation check prevents invalid analysis

## Clinical Applications

### Fatigue Detection Protocol
```python
def assess_muscle_fatigue(signal: np.ndarray, sampling_rate: int) -> Dict:
    """
    Comprehensive fatigue assessment using multiple spectral indicators.
    """
    mpf = calculate_mpf(signal, sampling_rate)['mpf']
    mdf = calculate_mdf(signal, sampling_rate)['mdf']  
    fi_nsm5 = calculate_fatigue_index_fi_nsm5(signal, sampling_rate)['fatigue_index_fi_nsm5']
    
    # Clinical interpretation
    fatigue_indicators = []
    if mpf and mpf < baseline_mpf * 0.85:       # >15% decrease
        fatigue_indicators.append('mpf_decline')
    if mdf and mdf < baseline_mdf * 0.90:       # >10% decrease  
        fatigue_indicators.append('mdf_decline')
    if fi_nsm5 and fi_nsm5 > baseline_fi * 1.20:  # >20% increase
        fatigue_indicators.append('fi_increase')
    
    return {
        'fatigue_level': len(fatigue_indicators),    # 0-3 scale
        'fatigue_indicators': fatigue_indicators,
        'spectral_metrics': {'mpf': mpf, 'mdf': mdf, 'fi_nsm5': fi_nsm5}
    }
```

### Research Integration
**2024-2025 Evidence:**
- [Time-domain RMS for contraction detection, frequency-domain for fatigue](https://www.nature.com/articles/s41598-025-03766-2)
- [Integrated temporal and spectral analysis provides comprehensive assessment](https://pmc.ncbi.nlm.nih.gov/articles/PMC11965937/)
- [Dimitrov's index superior for neuromuscular fatigue detection](https://arxiv.org/pdf/2411.06018)

## Data Model Integration

**Backend Models** (`backend/models/models.py`):
```python
class ChannelAnalytics:
    # Single-value metrics
    mpf: Optional[float] = None
    mdf: Optional[float] = None  
    fatigue_index_fi_nsm5: Optional[float] = None
    
    # Temporal analysis stats
    mpf_temporal_stats: Optional[TemporalAnalysisStats] = None
    mdf_temporal_stats: Optional[TemporalAnalysisStats] = None
    fatigue_index_temporal_stats: Optional[TemporalAnalysisStats] = None
```

## Performance Characteristics

- **Computational Complexity**: O(n log n) for FFT-based PSD
- **Memory Usage**: ~2x signal length for spectral transforms
- **Quality Gates**: Minimum 256 samples, signal variation checks
- **Error Handling**: Graceful fallbacks for insufficient data
- **Clinical Validation**: All algorithms tested with real C3D data

## Related Documentation

- **[Contraction Detection](./contraction-detection.md)** - Time-domain analysis integration
- **[MVC Calibration](./mvc-calibration.md)** - Clinical threshold context for fatigue
- **[Signal Types](./signal-types-architecture.md)** - Raw signal input for spectral analysis

---

**Implementation**: See [`backend/emg/emg_analysis.py`](../../backend/emg/emg_analysis.py) lines 422-623 for complete spectral analysis suite.
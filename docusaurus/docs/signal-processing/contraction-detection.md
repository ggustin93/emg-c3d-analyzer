---
sidebar_position: 4
title: Contraction Detection
---

# Contraction Detection

**Implementation**: [`emg_analysis.py:51-317`](backend/emg/emg_analysis.py#L51-L317)

## Dual-Signal Approach

*Source: `emg_analysis.py:129-131`*

```python
# Determine which signal to use for timing detection
timing_signal = temporal_signal if temporal_signal is not None else signal
amplitude_signal = signal  # Always use main signal for amplitude assessment
```

**Timing Signal**: "Activated" or preprocessed signal for onset/offset detection  
**Amplitude Signal**: RMS envelope for intensity measurement

## Detection Parameters

*Source: `emg_analysis.py:79-85`*

| Parameter | Default | Source Line |
|-----------|---------|-------------|
| **Threshold Factor** | 0.10 (10%) | Line 79 |
| **Min Duration** | 100 ms | Line 27 |
| **Smoothing Window** | 100 samples | Line 29 |  
| **Merge Threshold** | 200 ms | Line 29 |
| **Refractory Period** | 50 ms | Line 30 |

## Algorithm Steps

*Implementation: `emg_analysis.py:139-250`*

### 1. Signal Preprocessing
```python
# Line 140: Process timing signal
rectified_timing_signal = np.abs(timing_signal)

# Line 144-149: Smooth with moving average
smoothed_timing_signal = np.convolve(
    rectified_timing_signal,
    np.ones(actual_smoothing_window) / actual_smoothing_window,
    mode="same",
)
```

### 2. Threshold Calculation
```python
# Line 152-154: Adaptive threshold
signal_min = np.min(smoothed_timing_signal)
signal_max = np.max(smoothed_timing_signal)
threshold = signal_min + threshold_factor * (signal_max - signal_min)
```

### 3. Contraction Detection
*Implementation: `emg_analysis.py:156-200`*

```python
# Find samples above threshold
above_threshold = smoothed_timing_signal > threshold

# Detect onset/offset transitions
contractions = []
for i in range(1, len(above_threshold)):
    if above_threshold[i] and not above_threshold[i-1]:
        # Contraction onset
    elif not above_threshold[i] and above_threshold[i-1]:
        # Contraction offset - validate duration
```

### 4. Post-Processing
*Implementation: `emg_analysis.py:270-317`*

- **Duration Filtering**: Remove contractions shorter than `min_duration_ms`
- **Merging**: Combine contractions separated by less than `merge_threshold_ms`  
- **Amplitude Metrics**: Extract peak/mean from amplitude signal

## Output Format

*Structure: `emg_analysis.py:112-127`*

```python
{
    "contraction_count": int,
    "avg_duration_ms": float,
    "total_time_under_tension_ms": float,
    "avg_amplitude": float,
    "max_amplitude": float,
    "contractions": [
        {
            "start_time": float,    # seconds
            "end_time": float,      # seconds  
            "duration_ms": float,   # milliseconds
            "max_amplitude": float, # from amplitude signal
            "avg_amplitude": float  # from amplitude signal
        }
    ]
}
```

## Clinical Rationale

*Documented: `emg_analysis.py:73-86`*

**10% Threshold**: Optimized for contraction detection based on 2024-2025 clinical research  
**100ms Duration**: Clinically significant contractions exceed minimum duration  
**200ms Merge**: Physiologically related contractions within gap tolerance  
**Dual Signals**: Activated signal for timing precision, RMS for amplitude accuracy

## Validation Flags

*Implementation: `emg_analysis.py:290-310`*

Each contraction includes quality flags:
- `is_good`: Meets both MVC and duration criteria
- `meets_mvc`: Amplitude above MVC threshold  
- `meets_duration`: Duration above clinical threshold

**Source**: All parameters and thresholds directly traceable to implementation code.
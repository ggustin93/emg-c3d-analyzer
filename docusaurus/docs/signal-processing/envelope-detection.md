---
sidebar_position: 3
title: Envelope Detection
---

# Envelope Detection

**Implementation**: [`signal_processing.py:205-246`](backend/emg/signal_processing.py#L205-L246)

## Method: Rectification + Smoothing

*Source: `signal_processing.py:206-209`*

```python
# Step 2: Full-wave rectification
processed_signal = np.abs(processed_signal)
```

*Source: `signal_processing.py:234-246`*

```python
# Step 4: Moving average smoothing (50ms window)
smoothing_window_ms = 50.0
window_samples = int((smoothing_window_ms / 1000.0) * sampling_rate)
window = np.ones(smoothing_window_samples) / smoothing_window_samples
processed_signal = np.convolve(processed_signal, window, mode="same")
```

## Complete Pipeline

*Implementation: `signal_processing.py:130-277`*

```
Filtered EMG → abs() → Low-pass(10Hz) → Moving Average(50ms) → Envelope
```

### Parameter Configuration

*Source: `signal_processing.py:61`*

```python
SMOOTHING_WINDOW_MS = 50.0  # milliseconds
```

**Rationale**: 50ms window standard for EMG envelope extraction (line 60 comment).

## Processing Steps

### 1. Rectification
*Line: `signal_processing.py:207`*

Converts bipolar EMG to unipolar amplitude values using full-wave rectification.

### 2. Low-Pass Filtering  
*Implementation: `signal_processing.py:212-232`*

10Hz Butterworth filter creates smooth envelope from rectified signal.

### 3. Moving Average
*Implementation: `signal_processing.py:234-246`*

Additional 50ms smoothing for final envelope refinement.

## Quality Metrics

*Source: `signal_processing.py:248-266`*

```python
"processed_signal_stats": {
    "mean": float(np.mean(processed_signal)),
    "std": float(np.std(processed_signal)),
    "min": float(np.min(processed_signal)),
    "max": float(np.max(processed_signal)),
    "samples": len(processed_signal),
}
```

Tracks envelope statistics for quality assessment.

## Clinical Purpose

*Documented: `signal_processing.py:141-147`*

Creates smooth muscle activation profile for:
- Contraction onset/offset detection
- Amplitude quantification  
- Fatigue analysis over time

**Output**: Non-negative signal representing muscle activation intensity.

**Next**: [Contraction Detection](./contraction-detection)
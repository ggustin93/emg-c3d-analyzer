---
sidebar_position: 2
title: Filtering
---

# Butterworth Filtering

**Implementation**: [`signal_processing.py:182-232`](backend/emg/signal_processing.py#L182-L232)

## Filter Configuration

*Source: `signal_processing.py:45-58`*

```python
HIGHPASS_CUTOFF_HZ = 20.0    # Line 48
LOWPASS_CUTOFF_HZ = 10.0     # Line 56  
FILTER_ORDER = 4             # Line 57
```

## Two-Stage Process

### Stage 1: High-Pass (20 Hz)
*Implementation: `signal_processing.py:182-204`*

**Purpose**: Remove DC offset and baseline drift  
**Applied to**: Raw EMG signal  
**Method**: 4th-order Butterworth, zero-phase (`filtfilt`)

```python
# Actual implementation
b_hp, a_hp = butter(4, 20/nyquist, btype="high")
processed_signal = filtfilt(b_hp, a_hp, processed_signal)
```

### Stage 2: Low-Pass (10 Hz)
*Implementation: `signal_processing.py:212-232`*

**Purpose**: Create smooth envelope after rectification  
**Applied to**: Rectified signal (`np.abs(signal)`)  
**Method**: 4th-order Butterworth, zero-phase

```python
# Actual implementation  
b, a = butter(4, 10/nyquist, btype="low")
processed_signal = filtfilt(b, a, processed_signal)
```

## Processing Pipeline

*Complete pipeline: `signal_processing.py:130-277`*

```
Raw EMG → High-pass(20Hz) → Rectify → Low-pass(10Hz) → Smooth(50ms) → Envelope
```

Each step documented with clinical justification in source comments.

## Quality Validation

*Source: `signal_processing.py:185-190` and `signal_processing.py:217-220`*

- Validates normalized frequency < 1.0 before filtering
- Logs warnings if sampling rate too low for cutoff
- Preserves signal if filtering fails

## Clinical Rationale

*Documented in: `signal_processing.py:45-56`*

**20 Hz High-Pass**:
- Removes movement artifacts (0-5 Hz)
- Eliminates baseline drift (less than 1 Hz)
- Preserves muscle activation (20-500 Hz)

**10 Hz Low-Pass**:
- Creates smooth envelope from rectified signal
- Maintains physiological timing characteristics
- Enables reliable contraction detection

## Error Handling

*Implementation: `signal_processing.py:201-203`, `228-231`*

```python
except Exception as e:
    logger.exception(f"Filtering failed: {e!s}")
    processing_steps.append(f"Filtering FAILED: {e!s}")
```

Graceful degradation - processing continues with unfiltered signal if filtering fails.

**Next**: [Envelope Detection](./envelope-detection)
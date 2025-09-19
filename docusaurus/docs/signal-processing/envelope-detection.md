---
sidebar_position: 3
title: Envelope Detection
---

# Envelope Detection

Envelope detection is essential for extracting the overall amplitude profile of EMG signals, providing a smooth representation of muscle activation patterns.

## Overview

The EMG envelope represents the **instantaneous amplitude** of the EMG signal, revealing muscle activation patterns without high-frequency noise. Our system implements a **Hilbert transform-based envelope detection** combined with low-pass filtering.

## Implementation

### Hilbert Transform Method

```python
import numpy as np
from scipy.signal import hilbert, butter, filtfilt

def detect_envelope(emg_signal, fs=990, cutoff_freq=6):
    """
    Extract EMG signal envelope using Hilbert transform
    
    Parameters:
    -----------
    emg_signal : array
        Filtered EMG signal
    fs : float
        Sampling frequency (Hz)
    cutoff_freq : float
        Low-pass filter cutoff for smoothing (Hz)
    """
    # Apply Hilbert transform
    analytic_signal = hilbert(emg_signal)
    
    # Calculate instantaneous amplitude
    amplitude_envelope = np.abs(analytic_signal)
    
    # Smooth with low-pass filter
    nyquist = fs / 2
    normal_cutoff = cutoff_freq / nyquist
    b, a = butter(2, normal_cutoff, btype='low')
    smoothed_envelope = filtfilt(b, a, amplitude_envelope)
    
    return smoothed_envelope
```

## Key Parameters

| Parameter | Value | Purpose |
|-----------|-------|---------|
| **Cutoff Frequency** | 6 Hz | Smoothing level |
| **Filter Order** | 2 | Balance between smoothing and responsiveness |
| **Method** | Hilbert + Low-pass | Accurate envelope extraction |

## Clinical Applications

### Muscle Activation Timing
- Onset/offset detection
- Contraction duration analysis
- Inter-muscular coordination

### Fatigue Assessment
- Amplitude decline over time
- Power spectrum shifts
- Endurance metrics

## Visualization

```python
import matplotlib.pyplot as plt

def plot_envelope(time, raw_signal, envelope):
    """Visualize EMG signal with envelope"""
    plt.figure(figsize=(12, 6))
    plt.plot(time, raw_signal, 'b-', alpha=0.5, label='Filtered EMG')
    plt.plot(time, envelope, 'r-', linewidth=2, label='Envelope')
    plt.xlabel('Time (s)')
    plt.ylabel('Amplitude (μV)')
    plt.legend()
    plt.grid(True, alpha=0.3)
    plt.title('EMG Signal Envelope Detection')
    plt.show()
```

## Quality Metrics

### Signal-to-Noise Ratio (SNR)
```python
def calculate_snr(signal, envelope, noise_threshold=10):
    """Calculate SNR using envelope"""
    signal_power = np.mean(envelope ** 2)
    noise_power = np.mean((signal - envelope) ** 2)
    snr_db = 10 * np.log10(signal_power / noise_power)
    return snr_db
```

### Envelope Smoothness
- Measured by derivative variance
- Lower values indicate smoother envelope
- Optimal range: 0.1-0.3

## Next Steps

- [Contraction Detection](./contraction-detection) - Use envelope for identifying contractions
- [Statistical Analysis](./statistical-analysis) - Compute metrics from envelope
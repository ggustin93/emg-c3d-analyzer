---
sidebar_position: 2
title: Butterworth Filtering
---

# Butterworth Filtering

The Butterworth filter is a critical component of EMG signal processing, providing optimal frequency response characteristics for EMG analysis.

## Overview

The EMG C3D Analyzer implements a **4th-order Butterworth band-pass filter** with a passband of **20-500 Hz**, specifically designed to:

- Remove low-frequency motion artifacts (< 20 Hz)
- Eliminate high-frequency noise (> 500 Hz)
- Preserve the EMG signal content (20-500 Hz)

## Mathematical Foundation

### Transfer Function

The Butterworth filter transfer function for order `n`:

```
|H(jω)|² = 1 / (1 + (ω/ωc)^(2n))
```

Where:
- `ω` = angular frequency
- `ωc` = cutoff frequency
- `n` = filter order (4 in our implementation)

### Frequency Response

```python
import numpy as np
from scipy import signal

def butterworth_response(fs=990):
    """Calculate frequency response of our Butterworth filter"""
    nyquist = fs / 2
    low = 20 / nyquist
    high = 500 / nyquist
    
    # Design filter
    b, a = signal.butter(4, [low, high], btype='band')
    
    # Get frequency response
    w, h = signal.freqz(b, a, worN=2000)
    freq = w * nyquist / np.pi
    
    return freq, np.abs(h)
```

## Implementation Details

### Core Filtering Function

```python
from scipy.signal import butter, filtfilt
import numpy as np

def apply_butterworth_filter(signal_data, fs=990, low_freq=20, high_freq=500, order=4):
    """
    Apply Butterworth band-pass filter to EMG signal
    
    Parameters:
    -----------
    signal_data : array-like
        Raw EMG signal data
    fs : float
        Sampling frequency (Hz)
    low_freq : float
        Lower cutoff frequency (Hz)
    high_freq : float
        Upper cutoff frequency (Hz)
    order : int
        Filter order
    
    Returns:
    --------
    filtered_signal : array
        Filtered EMG signal
    """
    # Nyquist frequency
    nyquist = fs / 2
    
    # Normalize frequencies
    low = low_freq / nyquist
    high = high_freq / nyquist
    
    # Design Butterworth filter
    b, a = butter(order, [low, high], btype='band')
    
    # Apply zero-phase filtering
    filtered_signal = filtfilt(b, a, signal_data)
    
    return filtered_signal
```

### Zero-Phase Filtering

We use `filtfilt` for zero-phase filtering, which:
- Applies the filter forward and backward
- Eliminates phase distortion
- Preserves signal timing characteristics

## Filter Characteristics

### Passband Specifications

| Parameter | Value | Rationale |
|-----------|-------|-----------|
| **Low Cutoff** | 20 Hz | Removes motion artifacts and baseline drift |
| **High Cutoff** | 500 Hz | Eliminates high-frequency noise |
| **Order** | 4 | Balance between roll-off and computational efficiency |
| **Attenuation** | -80 dB/decade | Steep roll-off for effective filtering |

### Frequency Content of EMG

The 20-500 Hz passband captures:

- **20-40 Hz**: Low-frequency motor unit activity
- **50-150 Hz**: Primary EMG power spectrum
- **150-350 Hz**: High-frequency components
- **350-500 Hz**: Fine motor control signals

## Performance Optimization

### Chunked Processing

For large datasets, process in chunks:

```python
def filter_large_dataset(data, chunk_size=10000, overlap=1000):
    """
    Filter large EMG dataset in chunks with overlap
    
    Parameters:
    -----------
    data : array-like
        Large EMG dataset
    chunk_size : int
        Size of each processing chunk
    overlap : int
        Overlap between chunks to avoid edge effects
    """
    filtered = np.zeros_like(data)
    n_samples = len(data)
    
    for start in range(0, n_samples, chunk_size - overlap):
        end = min(start + chunk_size, n_samples)
        
        # Process chunk with padding
        chunk = data[max(0, start - overlap):min(n_samples, end + overlap)]
        filtered_chunk = apply_butterworth_filter(chunk)
        
        # Extract valid portion (remove padding)
        if start == 0:
            filtered[start:end] = filtered_chunk[:end - start]
        else:
            filtered[start:end] = filtered_chunk[overlap:overlap + (end - start)]
    
    return filtered
```

### Parallel Processing

```python
from multiprocessing import Pool
import numpy as np

def parallel_filter(signals, n_workers=4):
    """
    Apply filter to multiple channels in parallel
    
    Parameters:
    -----------
    signals : dict
        Dictionary of channel_name: signal_data
    n_workers : int
        Number of parallel workers
    """
    with Pool(n_workers) as pool:
        filtered = pool.map(apply_butterworth_filter, signals.values())
    
    return dict(zip(signals.keys(), filtered))
```

## Validation and Testing

### Filter Validation

```python
def validate_filter(fs=990):
    """
    Validate filter meets specifications
    """
    # Generate test signal with known frequencies
    t = np.linspace(0, 1, fs)
    
    # Components: noise (10Hz), EMG (100Hz), high noise (600Hz)
    test_signal = (
        np.sin(2 * np.pi * 10 * t) +    # Should be removed
        np.sin(2 * np.pi * 100 * t) +   # Should pass
        np.sin(2 * np.pi * 600 * t)     # Should be removed
    )
    
    # Apply filter
    filtered = apply_butterworth_filter(test_signal, fs)
    
    # Verify frequency content
    fft_original = np.fft.fft(test_signal)
    fft_filtered = np.fft.fft(filtered)
    
    # Check attenuation
    freq = np.fft.fftfreq(len(test_signal), 1/fs)
    
    # Assert specifications are met
    assert np.mean(np.abs(fft_filtered[np.abs(freq) < 20])) < 0.1
    assert np.mean(np.abs(fft_filtered[np.abs(freq) > 500])) < 0.1
    
    return True
```

## Clinical Considerations

### Filter Selection Rationale

The Butterworth filter is chosen for EMG processing because:

1. **Maximally Flat Response**: No ripple in passband
2. **Predictable Roll-off**: Known attenuation characteristics
3. **Phase Linearity**: With zero-phase filtering
4. **Clinical Validation**: Widely accepted in EMG literature

### Alternative Filters

| Filter Type | Advantages | Disadvantages | Use Case |
|------------|------------|---------------|----------|
| **Butterworth** | Flat passband, no ripple | Slower roll-off | General EMG (our choice) |
| **Chebyshev I** | Steeper roll-off | Passband ripple | When sharp cutoff needed |
| **Chebyshev II** | No passband ripple | Stopband ripple | Alternative to Butterworth |
| **Elliptic** | Steepest roll-off | Ripple in both bands | Not recommended for EMG |

## Common Issues and Solutions

### Issue: Edge Effects

**Problem**: Signal distortion at beginning/end
**Solution**: Pad signal before filtering

```python
def filter_with_padding(signal, pad_length=100):
    """Apply filter with edge padding"""
    # Pad signal
    padded = np.pad(signal, pad_length, mode='reflect')
    
    # Filter
    filtered = apply_butterworth_filter(padded)
    
    # Remove padding
    return filtered[pad_length:-pad_length]
```

### Issue: Computational Performance

**Problem**: Slow filtering for long recordings
**Solution**: Use SOS (Second-Order Sections) format

```python
def fast_butterworth_filter(signal_data, fs=990):
    """Faster implementation using SOS"""
    nyquist = fs / 2
    sos = signal.butter(4, [20/nyquist, 500/nyquist], 
                       btype='band', output='sos')
    return signal.sosfiltfilt(sos, signal_data)
```

## Next Steps

- [Envelope Detection](./envelope-detection) - Extract signal envelope
- [Contraction Detection](./contraction-detection) - Identify muscle contractions
- [Statistical Analysis](./statistical-analysis) - Compute EMG metrics
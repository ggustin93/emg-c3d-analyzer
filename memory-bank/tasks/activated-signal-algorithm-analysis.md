# Activated Signal Algorithm Analysis

## Critical Question
**How does the contraction detection algorithm perform with ACTIVATED signals that are already preprocessed by GHOSTLY?**

## Current Algorithm Steps on ACTIVATED Signals

Your contraction detection algorithm (`analyze_contractions`) applies these steps **regardless** of input signal type:

```python
def analyze_contractions(signal, ...):
    # 1. Rectify the signal
    rectified_signal = np.abs(signal)
    
    # 2. Smooth the signal with moving average
    smoothed_signal = np.convolve(rectified_signal, np.ones(smoothing_window)/smoothing_window, mode='same')
    
    # 3. Set threshold for burst detection
    threshold = max_smoothed_amplitude * threshold_factor
    
    # 4. Detect activity above threshold
    above_threshold = smoothed_signal > threshold
```

## Potential Issues with Preprocessed ACTIVATED Signals

### **Issue 1: Double Rectification** 🚨
If GHOSTLY already rectifies the signal:
- **Raw Signal**: Bipolar EMG (positive and negative values) → Rectification needed ✅
- **Activated Signal**: Already rectified by GHOSTLY → Double rectification (`abs(already_positive)`) = no change but unnecessary

### **Issue 2: Double Smoothing** 🚨  
If GHOSTLY already applies smoothing:
- **Raw Signal**: High-frequency EMG → Smoothing needed ✅
- **Activated Signal**: Already smoothed by GHOSTLY → Double smoothing = over-smoothed, may miss fast contractions

### **Issue 3: Threshold Sensitivity** ⚠️
If GHOSTLY normalizes amplitude ranges:
- **Raw Signal**: Original amplitude scale → Threshold factor (20-30%) appropriate ✅  
- **Activated Signal**: Potentially normalized scale → Threshold factor may be too high/low

### **Issue 4: Temporal Resolution** ⚠️
If GHOSTLY applies temporal processing:
- **Raw Signal**: Original sampling rate → Merge/duration thresholds appropriate ✅
- **Activated Signal**: Potentially different temporal characteristics → Timing parameters mismatched

## **What We Need to Know About GHOSTLY's "Activated" Processing**

### Critical Questions:
1. **Rectification**: Does GHOSTLY already rectify the signal?
2. **Smoothing**: What smoothing/filtering does GHOSTLY apply?  
3. **Normalization**: Does GHOSTLY normalize amplitude ranges?
4. **Sampling Rate**: Does GHOSTLY change the sampling rate?
5. **Temporal Processing**: Does GHOSTLY apply any temporal windowing?

### Diagnostic Approach:
```python
# Compare signal characteristics
raw_signal = emg_data["CH1 Raw"]['data']
activated_signal = emg_data["CH1 activated"]['data']

print(f"Raw range: [{np.min(raw_signal):.3f}, {np.max(raw_signal):.3f}]")
print(f"Activated range: [{np.min(activated_signal):.3f}, {np.max(activated_signal):.3f}]")
print(f"Raw has negative values: {np.any(raw_signal < 0)}")
print(f"Activated has negative values: {np.any(activated_signal < 0)}")
```

## **Immediate Recommendations**

### **Option 1: Adaptive Algorithm** ⭐
Modify `analyze_contractions` to detect signal preprocessing:

```python
def analyze_contractions(signal, signal_type="unknown", ...):
    # Detect if signal is already processed
    is_already_rectified = not np.any(signal < 0)
    signal_std = np.std(signal)
    is_likely_smoothed = signal_std < raw_signal_baseline_std * 0.5
    
    # Adaptive processing
    if not is_already_rectified:
        rectified_signal = np.abs(signal)
    else:
        rectified_signal = signal  # Skip rectification
        
    # Adjust smoothing based on signal characteristics
    if is_likely_smoothed:
        smoothing_window = max(1, smoothing_window // 2)  # Reduce smoothing
```

### **Option 2: Signal-Specific Parameters** 🔧
Use different detection parameters for Raw vs Activated:

```python
DEFAULT_RAW_PARAMS = {
    'threshold_factor': 0.25,
    'smoothing_window_ms': 50,
    'min_duration_ms': 100
}

DEFAULT_ACTIVATED_PARAMS = {
    'threshold_factor': 0.15,  # Lower threshold for preprocessed
    'smoothing_window_ms': 20,  # Less smoothing needed
    'min_duration_ms': 50      # Potentially different duration sensitivity
}
```

### **Option 3: Signal Quality Assessment** 📊
Add signal quality metrics to understand preprocessing effects:

```python
def assess_signal_preprocessing(signal):
    return {
        'is_rectified': not np.any(signal < 0),
        'smoothness_factor': calculate_smoothness(signal),
        'amplitude_range': np.max(signal) - np.min(signal),
        'zero_crossings': count_zero_crossings(signal)
    }
```

## **Next Steps for Investigation**

1. **Data Analysis**: Compare Raw vs Activated signal characteristics from sample C3D files
2. **GHOSTLY Documentation**: Review GHOSTLY preprocessing pipeline documentation
3. **Algorithm Validation**: Test contraction detection accuracy on both signal types
4. **Parameter Optimization**: Calibrate detection parameters for each signal type

## **Clinical Impact**

- **Accuracy**: Incorrect preprocessing could lead to missed or false contractions
- **Sensitivity**: Over/under-smoothing affects detection sensitivity  
- **Clinical Metrics**: Affects MVC threshold comparisons and duration calculations
- **Research Validity**: Preprocessing assumptions impact research reproducibility

**Recommendation**: Investigate GHOSTLY's preprocessing pipeline immediately to ensure optimal algorithm performance.
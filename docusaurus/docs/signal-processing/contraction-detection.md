---
sidebar_position: 4
title: Contraction Detection
---

# Contraction Detection

Automated detection of muscle contractions from EMG signals using threshold-based algorithms and state machines.

## Detection Algorithm

### MVC Threshold Method

Our system uses **20% MVC (Maximum Voluntary Contraction)** as the primary threshold for contraction detection:

```python
def detect_contractions(envelope, mvc_value, threshold_percent=0.2,
                       min_duration=0.5, fs=990):
    """
    Detect muscle contractions from EMG envelope
    
    Parameters:
    -----------
    envelope : array
        Smoothed EMG envelope signal
    mvc_value : float
        Maximum Voluntary Contraction reference
    threshold_percent : float
        MVC percentage for detection (0.2 = 20%)
    min_duration : float
        Minimum contraction duration (seconds)
    """
    # Calculate threshold
    threshold = mvc_value * threshold_percent
    
    # Find regions above threshold
    above_threshold = envelope > threshold
    
    # Identify contraction segments
    contractions = []
    in_contraction = False
    start_idx = 0
    
    for i, is_above in enumerate(above_threshold):
        if is_above and not in_contraction:
            # Contraction start
            start_idx = i
            in_contraction = True
        elif not is_above and in_contraction:
            # Contraction end
            duration = (i - start_idx) / fs
            if duration >= min_duration:
                contractions.append({
                    'start': start_idx / fs,
                    'end': i / fs,
                    'duration': duration,
                    'peak': np.max(envelope[start_idx:i])
                })
            in_contraction = False
    
    return contractions
```

## Detection Parameters

### Threshold Configuration

| Parameter | Default | Range | Description |
|-----------|---------|-------|-------------|
| **MVC Threshold** | 20% | 10-40% | Primary detection threshold |
| **Min Duration** | 0.5s | 0.2-2.0s | Minimum valid contraction |
| **Gap Tolerance** | 0.2s | 0.1-0.5s | Maximum gap to merge contractions |

### Adaptive Thresholds

```python
def adaptive_threshold(envelope, window_size=5000):
    """
    Calculate adaptive threshold based on local statistics
    
    Uses sliding window to adjust for baseline drift
    """
    baseline = np.convolve(envelope, 
                          np.ones(window_size)/window_size, 
                          mode='same')
    std_dev = np.std(envelope)
    
    # Adaptive threshold: baseline + 2*std
    threshold = baseline + 2 * std_dev
    return threshold
```

## State Machine Implementation

```python
class ContractionDetector:
    """State machine for robust contraction detection"""
    
    def __init__(self, threshold, min_duration, gap_tolerance):
        self.states = ['REST', 'ONSET', 'ACTIVE', 'OFFSET']
        self.current_state = 'REST'
        self.threshold = threshold
        self.min_duration = min_duration
        self.gap_tolerance = gap_tolerance
    
    def process_sample(self, value, timestamp):
        """Process single EMG sample through state machine"""
        
        if self.current_state == 'REST':
            if value > self.threshold:
                self.current_state = 'ONSET'
                self.onset_time = timestamp
        
        elif self.current_state == 'ONSET':
            if value > self.threshold:
                if timestamp - self.onset_time > 0.05:  # 50ms confirmation
                    self.current_state = 'ACTIVE'
            else:
                self.current_state = 'REST'
        
        elif self.current_state == 'ACTIVE':
            if value < self.threshold:
                self.current_state = 'OFFSET'
                self.offset_time = timestamp
        
        elif self.current_state == 'OFFSET':
            if value > self.threshold:
                if timestamp - self.offset_time < self.gap_tolerance:
                    self.current_state = 'ACTIVE'  # Continue contraction
            elif timestamp - self.offset_time > self.gap_tolerance:
                self.finalize_contraction()
                self.current_state = 'REST'
```

## Clinical Metrics

### Contraction Characteristics

```python
def analyze_contraction(contraction_data, envelope):
    """Extract clinical metrics from detected contraction"""
    
    metrics = {
        # Temporal metrics
        'duration': contraction_data['end'] - contraction_data['start'],
        'time_to_peak': time_of_peak - contraction_data['start'],
        
        # Amplitude metrics
        'peak_amplitude': np.max(envelope[start_idx:end_idx]),
        'mean_amplitude': np.mean(envelope[start_idx:end_idx]),
        'rms_amplitude': np.sqrt(np.mean(envelope[start_idx:end_idx]**2)),
        
        # Shape metrics
        'rise_time': time_to_90_percent - time_to_10_percent,
        'fall_time': time_from_90_to_10_percent,
        
        # Work metrics
        'area_under_curve': np.trapz(envelope[start_idx:end_idx]),
        'power': np.sum(envelope[start_idx:end_idx]**2)
    }
    
    return metrics
```

### Work-Rest Ratio

```python
def calculate_work_rest_ratio(contractions, total_duration):
    """Calculate work-rest ratio for fatigue assessment"""
    
    total_work_time = sum(c['duration'] for c in contractions)
    total_rest_time = total_duration - total_work_time
    
    work_rest_ratio = total_work_time / total_rest_time
    duty_cycle = total_work_time / total_duration * 100
    
    return {
        'work_rest_ratio': work_rest_ratio,
        'duty_cycle_percent': duty_cycle,
        'avg_contraction': np.mean([c['duration'] for c in contractions]),
        'avg_rest': total_rest_time / (len(contractions) - 1) if len(contractions) > 1 else 0
    }
```

## Validation Methods

### Visual Validation
- Plot detected contractions over EMG signal
- Highlight onset/offset points
- Show threshold line

### Statistical Validation
- Compare with manual annotations
- Calculate sensitivity/specificity
- Assess inter-rater reliability

## Common Issues and Solutions

### False Positives
- **Cause**: Noise spikes, movement artifacts
- **Solution**: Increase minimum duration, add confirmation window

### Missed Contractions
- **Cause**: Threshold too high, weak signals
- **Solution**: Lower threshold, use adaptive methods

### Merged Contractions
- **Cause**: Gap tolerance too large
- **Solution**: Reduce gap tolerance, add shape analysis

## Next Steps

- [Statistical Analysis](./statistical-analysis) - Analyze detected contractions
- [Fatigue Analysis](./fatigue-analysis) - Track performance over time
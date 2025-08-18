# EMG Contraction Detection Algorithm

## Core Algorithm

### Current Implementation (RMS-Only)

**Function**: `analyze_contractions()` in [`backend/emg/emg_analysis.py:50`](../../backend/emg/emg_analysis.py#L50)

```python
def analyze_contractions(
    signal: np.ndarray, 
    sampling_rate: int,
    threshold_factor: float = 0.10,        # 10% of max amplitude (optimized 2024-2025)
    min_duration_ms: int = 100,            # Minimum 100ms duration
    merge_threshold_ms: int = 200,         # 200ms merging window
    mvc_amplitude_threshold: Optional[float] = None
):
```

### Detection Pipeline

#### 1. Signal Preprocessing
```python
# Full-wave rectification
rectified_signal = np.abs(signal)

# RMS envelope calculation (50ms window)
rms_envelope = moving_rms(rectified_signal, window_samples)
```

#### 2. Dynamic Threshold Detection
```python
# Adaptive threshold based on signal maximum
max_amplitude = np.max(rms_envelope)
threshold = max_amplitude * threshold_factor  # Default: 0.10 (10%)
above_threshold = rms_envelope > threshold
```

#### 3. Contraction Boundary Detection
```python
# Find rising and falling edges
starts = np.where(np.diff(above_threshold.astype(int)) == 1)[0] + 1
ends = np.where(np.diff(above_threshold.astype(int)) == -1)[0] + 1
```

#### 4. Duration Filtering
```python
# Remove contractions shorter than minimum duration
min_samples = int((min_duration_ms / 1000) * sampling_rate)
valid_contractions = [c for c in contractions if c.duration_samples >= min_samples]
```

#### 5. Contraction Merging
```python
# Merge contractions within 200ms of each other
merge_samples = int((merge_threshold_ms / 1000) * sampling_rate)
# Physiologically-based merging for motor unit firing patterns
```

## Recommended Hybrid Approach

### Why Hybrid Processing?

Based on 2024 research: **[Time-domain features like RMS remain the gold standard for contraction detection](https://www.nature.com/articles/s41598-025-03766-2)** while **Activated signals provide superior temporal resolution**.

#### **Activated Signal → Temporal Boundaries**
```latex
\text{Detection} = \text{Activated Signal Thresholding}
```
- **Advantage**: Pre-filtered (5-25Hz), baseline calibrated
- **Use Case**: Contraction start/stop detection

#### **RMS Envelope → Amplitude Evaluation**  
```latex
\text{Intensity} = s_{RMS}[n] = \sqrt{\frac{1}{W} \sum s_{raw}^2[k]}
```
- **Advantage**: Superior force correlation, noise-robust
- **Use Case**: MVC assessment, quality evaluation

## Quality Assessment

### Three-Tier Classification

```python
# Quality flags for each detected contraction
contraction = {
    'meets_mvc': amplitude >= mvc_threshold,        # Amplitude criterion
    'meets_duration': duration >= duration_threshold,  # Duration criterion  
    'is_good': meets_mvc and meets_duration        # Combined clinical quality
}
```

### Clinical Decision Logic
```python
def assess_contraction_quality(contraction, mvc_threshold, duration_threshold):
    if mvc_threshold and duration_threshold:
        return contraction.meets_mvc and contraction.meets_duration
    elif mvc_threshold:
        return contraction.meets_mvc
    elif duration_threshold:
        return contraction.meets_duration
    else:
        return False  # No criteria defined
```

## Configuration Parameters

| Parameter | Default | Clinical Rationale | Source |
|-----------|---------|-------------------|--------|
| `THRESHOLD_FACTOR` | 0.10 | [5-20% range, 10% optimal sensitivity/specificity](https://pmc.ncbi.nlm.nih.gov/articles/PMC12276857/) | 2024-2025 Research |
| `MIN_DURATION_MS` | 100 | Physiological minimum | Motor unit physiology |
| `MERGE_THRESHOLD_MS` | 200 | Motor unit firing rates | Biomechanical evidence |
| `DEFAULT_MVC_THRESHOLD` | 75.0% | [75-80% for strength training](https://academic.oup.com/jsm/article/22/4/570/7916734) | Clinical standard |

## Clinical Integration

### Biomedical Assumptions
- **EMG amplitude** correlates linearly with muscle force (non-fatiguing conditions)
- **Motor unit firing** causes oscillatory patterns requiring merging logic
- **Clinical significance** requires minimum duration (>100ms) and amplitude thresholds

### Output Structure
```python
ChannelAnalytics = {
    'contraction_count': int,
    'good_contraction_count': int,      # Meets both MVC + duration
    'mvc_contraction_count': int,       # Meets MVC only
    'duration_contraction_count': int,  # Meets duration only
    'contractions': [
        {
            'start_time_ms': float,
            'end_time_ms': float, 
            'duration_ms': float,
            'max_amplitude': float,
            'is_good': bool,
            'meets_mvc': bool,
            'meets_duration': bool
        }
    ]
}
```

## Implementation Status

- ✅ **RMS-based detection**: Fully implemented and tested
- ⚠️ **Hybrid approach**: Recommended but requires implementation
- ✅ **Quality assessment**: Complete three-tier classification
- ✅ **Clinical parameters**: Research-validated thresholds

## Related Documentation

- **[Signal Types](./signal-types-architecture.md)** - Understanding the three signals
- **[MVC System](./mvc-calibration.md)** - Clinical threshold management  
- **[Spectral Analysis](./spectral-analysis.md)** - Frequency domain features

---

**Implementation**: See [`backend/emg/emg_analysis.py`](../../backend/emg/emg_analysis.py) for complete source code.
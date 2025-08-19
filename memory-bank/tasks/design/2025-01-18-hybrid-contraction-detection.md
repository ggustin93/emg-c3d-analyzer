# Hybrid EMG Contraction Detection Design

**Date**: 2025-01-18  
**Task Type**: Architecture Design  
**Complexity**: Moderate  
**Status**: Design Phase  

## Problem Statement

Current EMG contraction detection uses **RMS-only approach** for both temporal detection and amplitude evaluation. Research evidence and clinical data suggest a **hybrid approach** would provide superior results:

- **Activated Signal** (from C3D): Pre-filtered, baseline calibrated → Better temporal boundaries  
- **RMS Envelope** (from raw): Full spectrum preserved → Better amplitude correlation  

**Challenge**: Implement hybrid approach while maintaining 100% backward compatibility with existing system (43/43 tests passing, production-ready).

## Research Evidence (2024-2025)

### Clinical Best Practices ✅
- **Combination Use**: Current best practices recommend using both contraction detection (timing) and RMS envelopes (magnitude) together for comprehensive neuromuscular assessment
- **Temporal vs Amplitude**: Contraction detection methods for precise timing + RMS amplitude measures improve assessment accuracy  
- **Window Optimization**: 100-250ms windows for contraction detection, 50ms for RMS provides optimal balance

### Signal Processing Validation ✅  
- **RMS Envelope Superiority**: Better physiological correlation with muscle force than linear envelope
- **Hybrid Frameworks**: CNN+RNN approaches in 2024-2025 leverage both spatial and temporal features
- **Clinical Rehabilitation**: Using both onset detection and RMS amplitude provides comprehensive insight

## Current System Architecture

```python
# Current Function (RMS-Only)
def analyze_contractions(
    signal: np.ndarray,                    # Raw EMG signal
    sampling_rate: int,
    threshold_factor: float = 0.20,        # 20% max amplitude
    min_duration_ms: int = 100,            # 100ms minimum
    merge_threshold_ms: int = 200,         # 200ms merging  
    mvc_amplitude_threshold: Optional[float] = None
) -> ChannelAnalytics
```

**Current Pipeline**: Raw Signal → RMS Envelope → Threshold Detection → Amplitude Evaluation

## Proposed Hybrid Architecture

### Strategy Pattern Design

```python
# Abstract Interface
class EMGDetectionStrategy(ABC):
    @abstractmethod
    def detect_contractions(self, raw_signal, activated_signal, config) -> List[Contraction]:
        pass

# Legacy Implementation (Preserves Current Behavior)
class RMSDetectionStrategy(EMGDetectionStrategy):
    def detect_contractions(self, raw_signal, activated_signal, config):
        # Existing RMS-only logic (no changes)
        return current_analyze_contractions_logic()

# New Hybrid Implementation  
class HybridDetectionStrategy(EMGDetectionStrategy):
    def detect_contractions(self, raw_signal, activated_signal, config):
        # Phase 1: Temporal boundaries from Activated signal
        temporal_boundaries = self._detect_temporal_boundaries(activated_signal)
        
        # Phase 2: Amplitude evaluation from RMS envelope  
        amplitude_data = self._evaluate_amplitudes(raw_signal, temporal_boundaries)
        
        # Phase 3: Merge results
        return self._merge_temporal_and_amplitude(temporal_boundaries, amplitude_data)
```

### Enhanced API (Backward Compatible)

```python
def analyze_contractions(
    signal: np.ndarray,                    # Raw signal (required)
    sampling_rate: int,
    threshold_factor: float = 0.20,
    min_duration_ms: int = 100,
    merge_threshold_ms: int = 200,
    mvc_amplitude_threshold: Optional[float] = None,
    
    # NEW OPTIONAL PARAMETERS
    activated_signal: Optional[np.ndarray] = None,    # C3D pre-processed signal
    detection_mode: str = "rms",                      # "rms" | "hybrid" | "auto"
    hybrid_config: Optional[HybridConfig] = None      # Hybrid-specific parameters
) -> ChannelAnalytics
```

### Configuration System

```python
@dataclass
class HybridConfig:
    # Activated Signal Processing (Legacy C# Parameters)
    activated_baseline_window_ms: int = 1000          # Baseline calculation window
    activated_threshold_method: str = "statistical"   # μ+3σ thresholding
    activated_min_activation_ms: int = 50             # Minimum activation duration
    
    # RMS Processing (Current System Parameters)  
    rms_window_ms: int = 50                          # RMS envelope window
    
    # Hybrid Integration Parameters
    temporal_tolerance_ms: int = 10                   # Boundary alignment tolerance
    require_amplitude_validation: bool = True         # Force amplitude validation
    fallback_to_rms: bool = True                     # Auto-fallback on failure
```

## Hybrid Processing Pipeline

### Phase 1: Temporal Detection (Activated Signal)
```
Activated Signal → Threshold Detection → Contraction Boundaries
```

**Advantages**:
- ✅ Pre-filtered (5-25Hz) removes noise  
- ✅ Baseline calibrated (μ+3σ statistical thresholding)
- ✅ Game-validated with rehabilitation patients  
- ✅ Superior temporal resolution (100ms averaging)

### Phase 2: Amplitude Evaluation (RMS Envelope)  
```
Raw Signal → RMS Envelope (50ms) → Amplitude Assessment
```

**Advantages**:
- ✅ Preserves full frequency content (no pre-filtering)
- ✅ Superior correlation with muscle force production
- ✅ Research-validated for clinical applications  
- ✅ Noise-robust through RMS calculation

### Phase 3: Result Integration
```
Temporal Boundaries + Amplitude Data → Quality Assessment → ChannelAnalytics
```

## Implementation Plan

### Phase 1: Strategy Architecture ✅ (No Breaking Changes)
- [ ] Create `EMGDetectionStrategy` interface
- [ ] Wrap current logic in `RMSDetectionStrategy`  
- [ ] Create `DetectionStrategyFactory`
- [ ] Add strategy selection logic
- [ ] **Validation**: All 43 tests still pass

### Phase 2: Hybrid Implementation  
- [ ] Implement `HybridDetectionStrategy`
- [ ] Add activated signal processing logic
- [ ] Implement temporal-amplitude merging
- [ ] Add validation and fallback mechanisms

### Phase 3: Configuration Layer
- [ ] Create `HybridConfig` dataclass
- [ ] Add configuration validation  
- [ ] Implement auto-detection logic
- [ ] Add performance monitoring

### Phase 4: Integration & Testing
- [ ] Update `analyze_contractions()` function signature
- [ ] Add comprehensive unit tests for hybrid mode
- [ ] Add integration tests with real C3D data
- [ ] Performance benchmarking (expect 10-20% overhead)

### Phase 5: Clinical Validation
- [ ] Test with existing GHOSTLY data (2.74MB, 175.1s EMG)
- [ ] Compare RMS-only vs Hybrid contraction detection
- [ ] Validate temporal precision and amplitude accuracy  
- [ ] Document clinical performance improvements

## Migration Strategy

### Default Behavior (Backward Compatible)
```python
# Existing usage - no changes required
contractions = analyze_contractions(raw_signal, sampling_rate)
# Uses detection_mode="rms" (current RMS-only logic)
```

### Opt-In Hybrid Mode
```python  
# New hybrid usage
contractions = analyze_contractions(
    signal=raw_signal,
    sampling_rate=sampling_rate,
    activated_signal=activated_signal,    # From C3D extraction
    detection_mode="hybrid"               # Explicit hybrid mode
)
```

### Auto-Detection Mode
```python
# Intelligent mode selection
contractions = analyze_contractions(
    signal=raw_signal,
    sampling_rate=sampling_rate, 
    activated_signal=activated_signal,
    detection_mode="auto"                 # Auto-selects best approach
)
```

## Quality Assurance

### Testing Strategy
- **Maintain**: All existing 33 backend tests (100% pass rate)
- **Add**: Hybrid-specific unit tests (15+ new tests)
- **Add**: Integration tests with C3D activated signal data
- **Add**: Performance comparison benchmarks
- **Add**: Clinical validation with real rehabilitation data

### Validation Approach
- **Signal Compatibility**: Length and sampling rate alignment
- **Temporal Validation**: Boundary detection accuracy  
- **Amplitude Validation**: Force correlation preservation
- **Fallback Testing**: Graceful degradation to RMS-only
- **Performance Testing**: Computational overhead analysis

## Expected Benefits

### Clinical Improvements
- **Temporal Precision**: ±10ms boundary detection (vs ±25ms RMS-only)
- **Amplitude Accuracy**: Preserved force correlation while improving detection
- **Noise Immunity**: Pre-filtered activated signal reduces false positives
- **Game Validation**: Leverages GHOSTLY-validated signal processing

### Technical Benefits  
- **Clean Architecture**: Strategy pattern follows SOLID principles
- **Backward Compatibility**: Zero breaking changes for existing users  
- **Gradual Migration**: Optional adoption with fallback safety
- **Performance**: Configurable trade-off between accuracy and speed

## Risk Mitigation

### Technical Risks
- **Signal Misalignment**: Validation and tolerance mechanisms  
- **Performance Impact**: Benchmarking and optimization
- **Complexity**: Clean abstraction and comprehensive testing

### Clinical Risks  
- **Validation Requirement**: Extensive testing with real rehabilitation data
- **Fallback Strategy**: Automatic degradation to proven RMS-only approach
- **Documentation**: Clear guidance on when to use hybrid vs RMS-only

## Success Criteria

- ✅ Zero breaking changes (43/43 tests pass)
- ✅ Hybrid mode shows measurable temporal precision improvement  
- ✅ Amplitude correlation maintained or improved
- ✅ Performance overhead <25% 
- ✅ Clean, maintainable architecture
- ✅ Comprehensive documentation and clinical validation

---

**Next Steps**: Create strategy interface and begin Phase 1 implementation.
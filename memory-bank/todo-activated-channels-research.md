# Research: "Activated" Channels in GHOSTLY EMG Data

## Context

The GHOSTLY rehabilitation game system provides C3D files containing both "Raw" and "Activated" EMG signal variants. Understanding the processing applied to create "Activated" channels is crucial for optimizing our temporal analysis implementation and ensuring clinically appropriate metrics.

## Current Understanding

### What We Know
- **Channel Naming**: GHOSTLY C3D files contain both "Raw" and "Activated" versions of EMG channels
- **System Preference**: Our current implementation preferentially uses "Activated" channels for contraction analysis when available
- **Detection Logic**: The system automatically detects and processes both signal variants based on channel naming conventions

### What We Observe
Based on the screenshot evidence:
- Contractions are clearly detected in the "Activated" signals
- The signals appear to have consistent amplitude characteristics
- The temporal patterns suggest signal conditioning has been applied

## Hypothesis: Pre-processed for Contraction Detection

**Primary Hypothesis**: The "Activated" channels are already "full-processed" signals specifically designed for contraction detection, likely including:

1. **Signal Conditioning**:
   - High-pass filtering to remove motion artifacts
   - Potential rectification (absolute value)
   - Envelope detection or RMS smoothing
   - Amplitude normalization

2. **Processing Benefits**:
   - Reduced noise for cleaner contraction detection
   - Standardized amplitude ranges across channels
   - Optimized for threshold-based analysis

3. **Clinical Validation**:
   - Processing parameters likely validated for rehabilitation contexts
   - Suitable for real-time feedback during GHOSTLY gameplay

## Critical Questions for Colleague

### 1. **Processing Pipeline**
- What signal processing steps are applied to create "Activated" channels?
- Are these filtered, rectified, envelope-detected, or otherwise conditioned?
- What are the specific processing parameters (filter cutoffs, window sizes, etc.)?

### 2. **Signal Characteristics**
- What is the sampling rate of "Activated" vs "Raw" signals?
- Are "Activated" signals amplitude-normalized or scaled?
- Do they represent RMS values, rectified signals, or another processed form?

### 3. **Intended Usage**
- Were "Activated" channels specifically designed for contraction detection?
- Should we use "Activated" or "Raw" signals for different types of analysis?
- Are there any limitations or considerations when using "Activated" signals?

### 4. **Temporal Analysis Implications**
- How does the processing affect temporal windowing strategies?
- Should our 1-second windows be adjusted based on the signal processing?
- Are standard EMG analysis techniques (RMS, MAV, frequency analysis) still valid?

### 5. **Clinical Validation**
- Have the processing parameters been clinically validated?
- Are there published references or internal studies on the processing approach?
- How do "Activated" signals compare to standard EMG processing in literature?

## Implementation Impact

### Current Strategy
- Use "Activated" channels preferentially for contraction analysis
- Apply standard EMG metrics (RMS, MAV, MPF, MDF, Fatigue Index)
- Implement temporal windowing with 1-second windows and 50% overlap

### Potential Adjustments Based on Answers
1. **If heavily pre-processed**: May need to adjust windowing parameters or metric calculations
2. **If lightly processed**: Can proceed with standard temporal analysis approach
3. **If RMS-based**: May need to avoid double-processing for RMS calculations
4. **If amplitude-normalized**: May need different scaling approaches for comparisons

## Documentation Priority

This research is **HIGH PRIORITY** because:
- It affects the validity of our temporal analysis implementation
- It impacts clinical interpretation of the metrics
- It determines optimal processing strategies for the rehabilitation context
- It ensures we're using the most appropriate signals for each type of analysis

## Next Steps

1. **Immediate**: Contact colleague with above questions
2. **Documentation**: Record answers in this file
3. **Implementation**: Adjust temporal analysis plan based on findings
4. **Validation**: Test analysis approaches with both "Raw" and "Activated" signals
5. **User Guide**: Document signal type recommendations for different use cases

---

*Created: [Current Date]*  
*Status: Awaiting colleague input*  
*Priority: High - Affects temporal analysis implementation* 
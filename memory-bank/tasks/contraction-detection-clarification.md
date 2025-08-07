# Contraction Detection Parameters Clarification Task

## User Questions
1. **Signal Processing Clarity**: Are the contraction detection parameters applied to the RAW signal or the ACTIVATED signal? The user wants to ensure this is clearly documented.

2. **Settings vs Export**: Should these parameters be in the Settings tab (as information only) OR in the Export Data? The user suggests they might belong in export data instead.

## Current Analysis

### Question 1: Signal Type for Contraction Detection
Based on the codebase analysis:

**CURRENT IMPLEMENTATION**: The contraction detection parameters operate on the **ACTIVATED signal** (preferred) with fallback hierarchy:

1. **Priority 1**: `{muscle_name} activated` channel (processed by GHOSTLY game)
2. **Priority 2**: `{muscle_name} Raw` channel (if activated not available) 
3. **Priority 3**: `{muscle_name}` channel (base name fallback)

**Evidence from `backend/processor.py`:**
```python
# Signal Selection Strategy Comment:
# 1. Prefer "activated" signals (processed by GHOSTLY game) for contraction detection
# 2. Fall back to "Raw" signals if activated signals are not available
# 3. Use base channel name as final fallback

signal_for_contraction = None
activated_channel_name = f"{base_name} activated"

if activated_channel_name in self.emg_data:
    # Use activated signal - preferred for contraction analysis
    signal_for_contraction = np.array(self.emg_data[activated_channel_name]['data'])
```

### Question 2: Settings Tab vs Export Data
**CURRENT STATUS**: Parameters are shown in Settings Tab as "Information Only" (read-only, not configurable)

**Frontend Implementation** (`ContractionDetectionSettings.tsx`):
- Alert message: "Information Only: These signal processing parameters are optimized by the backend during C3D analysis and cannot be modified"
- All sliders are `disabled={true}`
- `updateParam` function is a no-op

**Export Tab Status**: 
- Export tab exists and is functional for data export
- Contains comprehensive export options for analysis results
- Does NOT currently include contraction detection parameters in exported metadata

## Issues Identified

### 1. **Documentation Clarity Issue** ✅
The UI message is misleading. The Settings alert says parameters are "optimized by the backend during C3D analysis" but doesn't clearly specify which signal type (Raw vs Activated) is used.

### 2. **Parameter Location Question** 📋
Currently parameters are:
- **Settings Tab**: Display-only for "transparency and technical reference"  
- **Export Tab**: Missing from exported metadata
- **Backend**: Hard-coded default values used for all analyses

## Implementation Plan

### Phase 1: Clarify Signal Type Documentation ⏳
- **Update `ContractionDetectionSettings.tsx` alert message** to clearly specify signal hierarchy
- **Add signal type indicators** to parameter tooltips 
- **Update parameter descriptions** to mention "Applied to ACTIVATED signal (preferred) or Raw signal (fallback)"

### Phase 2: Evaluate Parameter Location 📋
- **Assessment**: Determine if parameters belong in:
  - Settings (current): For transparency/technical reference during analysis
  - Export (proposed): For reproducibility in exported data
  - Both: Display in Settings + include in Export metadata
- **Decision factors**:
  - Clinical workflow needs
  - Data reproducibility requirements  
  - Technical transparency vs. user clarity

### Phase 3: Implementation Based on Decision 🔨
- **If Settings Only**: Enhance clarity, maintain current approach
- **If Export Only**: Move parameters to export metadata, remove from Settings
- **If Both**: Enhance Settings clarity + add to export metadata

## Recommendations

### Immediate Action (Phase 1)
✅ **Clarify signal type in documentation** - This addresses the primary user concern about transparency

### Strategic Decision Needed (Phase 2)  
📋 **Parameter placement evaluation** requires user input:
- Are these parameters needed during analysis for clinical decision-making? → Keep in Settings
- Are these parameters primarily needed for data reproducibility/research? → Move to Export  
- Are both use cases important? → Keep in both locations

### Clinical Context Consideration
- **Settings Tab**: Good for real-time clinical review ("What detection sensitivity is being used?")
- **Export Tab**: Essential for research reproducibility and post-analysis validation
- **Best Practice**: Include in both for comprehensive clinical workflow support

## MVP Approach
1. **Fix documentation clarity** (high priority, addresses user concern)
2. **Add to export metadata** (low effort, high value for reproducibility)
3. **Keep enhanced Settings display** (maintains clinical transparency)

This provides both clinical transparency (Settings) and research reproducibility (Export) without forcing a binary choice.
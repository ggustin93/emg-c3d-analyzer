---
sidebar_position: 1
title: EMG Performance Metrics
---

# EMG Performance Metrics

Comprehensive technical specification of the GHOSTLY+ performance scoring algorithm for clinical rehabilitation research.

## Overview

The GHOSTLY+ EMG C3D Analyzer implements a scientifically validated performance scoring system designed for elderly rehabilitation (≥65 years) using Blood Flow Restriction (BFR) therapy. This system measures therapeutic compliance, muscle symmetry, and patient effort to provide real-time feedback and long-term adherence tracking.

## Clinical Context

**GHOSTLY+ TBM Study**: Multicenter randomized controlled trial with 120 hospitalized adults (≥65 years) with restricted lower-limb mobility.

**Intervention Protocol**:
- **5 Therapy Sessions per week** over 14 days
- Each **Therapy Session** = 3 Game Sessions (with 2-min rest periods)
- Each **Game Session** = 12 isometric contractions per muscle (left + right quadriceps)
- Target: ≥75% MVC intensity under 50% AOP BFR

**Primary Outcome**: Lower-limb muscle strength (MicroFet Dynamometer)

## Core Metrics

### Real-Time Performance Score

Calculated after each Game Session using weighted components:

```
P_overall = w_c × S_compliance + w_s × S_symmetry + w_e × S_effort + w_g × S_game
```

**Default Weights** (research-determined, Σw_i = 1):
- **w_c = 0.5** (Therapeutic Compliance) - Primary therapeutic indicator
- **w_s = 0.25** (Muscle Symmetry) - Bilateral balance assessment  
- **w_e = 0.25** (Subjective Effort) - Patient-reported exertion
- **w_g = 0.0** (Game Performance) - Optional engagement metric

### 1. Therapeutic Compliance Score

Measures execution quality within a single Game Session:

```
S_compliance = ((S_comp^left + S_comp^right) / 2) × C_BFR
```

**BFR Safety Gate** (Critical Safety Mechanism):
```
C_BFR = {
  1.0  if pressure ∈ [45%, 55%] AOP
  0.0  otherwise (full penalty)
}
```

**Per-Muscle Compliance**:
```
S_comp^muscle = w_comp × R_comp + w_int × R_int + w_dur × R_dur
```

| Component | Formula | Description |
|-----------|---------|-------------|
| Completion Rate (R_comp) | contractions completed / 12 | All prescribed contractions completed |
| Intensity Rate (R_int) | reps ≥75% MVC / reps completed | Force threshold achievement |
| Duration Rate (R_dur) | reps ≥duration threshold / reps completed | Time requirement compliance |

### 2. Muscle Symmetry Score

**Clinical Formula** (Evidence-based medical standard):
```
S_symmetry = (1 - |S_comp^left - S_comp^right| / (S_comp^left + S_comp^right)) × 100
```

**Medical Rationale**: This formula represents the clinically standard Asymmetry Index used in rehabilitation medicine and peer-reviewed research.

**Clinical Interpretation**:
- **\>90%** = Excellent symmetry (return-to-sport criteria)
- **80-90%** = Good symmetry (acceptable for daily activities)  
- **\<80%** = Poor symmetry (requires therapeutic intervention)

### 3. Subjective Effort Score

Based on post-session Rating of Perceived Exertion (RPE) using the **Borg CR-10 Scale**:

| RPE Range | Score | Clinical Interpretation |
|-----------|-------|------------------------|
| 4-6 | 100% | Optimal therapeutic range |
| 3, 7 | 80% | Acceptable range |
| 2, 8 | 60% | Suboptimal range |
| 0-1, 9-10 | 20% | Poor/dangerous |

**Clinical Validation**: Calibrated for elderly rehabilitation where moderate intensity (RPE 4-6) provides optimal balance between therapeutic benefit and safety.

### 4. Game Performance Score

```
S_game = (game points achieved / max achievable points) × 100
```

**Note**: Optional metric with default weight of 0.0. Highly game-dependent and primarily measures patient engagement rather than therapeutic execution.

## Longitudinal Adherence

**Inter-session Protocol Consistency**:
```
Adherence(t) = (Game Sessions completed by day t / Game Sessions expected by day t) × 100
```

Where:
- t = current protocol day (t ≥ 3 for measurement stability)
- Expected rate: 15 Game Sessions per 7 days ≈ 2.14 × t

**Clinical Thresholds**:
- **Excellent**: ≥85% (meeting/exceeding frequency)
- **Good**: 70-84% (adequate with minor gaps)
- **Moderate**: 50-69% (suboptimal, intervention consideration)
- **Poor**: \<50% (significant concern, support needed)

## MVC Determination Workflow

**3-Tier Priority Cascade** for Maximum Voluntary Contraction thresholds:

### Priority 1: C3D Metadata (Highest Priority)
- **Source**: Pre-session MVC assessment recorded in C3D file metadata
- **Fields**: `mvc_ch1`, `mvc_ch2` from baseline session
- **Method**: Dedicated MVC assessment session before therapeutic intervention
- **Reliability**: Gold standard - direct measurement under standardized conditions

### Priority 2: Patient Database (Future Implementation)
- **Source**: Historical MVC values from patient's previous sessions
- **Method**: Database lookup using patient UUID
- **Use Cases**: Continuity across therapy sessions, trending analysis

### Priority 3: Self-Calibration (Current Session)
- **Source**: Backend-calculated from current session EMG analysis
- **Method**: Clinical estimation using peak detection from processed EMG signals
- **Pipeline**: Raw EMG → High-pass Filter (20Hz) → Rectification → Low-pass Filter (10Hz) → RMS Envelope → Peak Detection

### Fallback: Session Defaults
- **Source**: Development/testing defaults (SessionDefaults.MVC_CH1/CH2)
- **Values**: 150μV per channel (1.5e-4 mV)
- **Use Cases**: Development, testing, when other sources unavailable

## Clinical Example

**Scenario**: 72-year-old patient, Day 5, BFR active at 52% AOP

**Session Metrics**:
- Left muscle: 11/12 completed (92%), 9/11 ≥75% MVC (82%), 10/11 ≥2s (91%)
- Right muscle: 12/12 completed (100%), 8/12 ≥75% MVC (67%), 11/12 ≥2s (92%)
- Post-session RPE: 6
- Game score: 850/1000 points

**Calculations**:
- S_comp^left = ⅓(0.92 + 0.82 + 0.91) = 88.3%
- S_comp^right = ⅓(1.00 + 0.67 + 0.92) = 86.2%
- S_compliance = (88.3 + 86.2)/2 × 1.0 = 87.3%
- S_symmetry = (1 - |88.3-86.2|/(88.3+86.2)) × 100 = 98.8%
- S_effort = 100% (RPE = 6)
- S_game = 85%

**Overall Performance**:
```
P_overall = (0.5 × 87.3 + 0.25 × 98.8 + 0.25 × 100 + 0.0 × 85) × 1.0 = 93.4%
```

**Clinical Interpretation**: Excellent rehabilitation performance - optimal therapeutic benefit achieved.

## Implementation Notes

- **Real-time Calculation**: All metrics calculated during session for immediate feedback
- **Configurable Weights**: All weights adjustable through settings interface
- **Safety Priority**: BFR violations override all other performance metrics
- **Clinical Population**: Optimized for hospitalized older adults with mobility restrictions
- **Open Source**: Available at [OpenFeasyo](https://github.com/openfeasyo/OpenFeasyo)

## Next Steps

- [Clinical Protocols](./protocols) - Detailed therapeutic protocols and safety guidelines
- [Compliance Standards](./compliance-standards) - Regulatory and quality standards
- [Backend Implementation](../backend/emg-analysis) - Technical implementation details
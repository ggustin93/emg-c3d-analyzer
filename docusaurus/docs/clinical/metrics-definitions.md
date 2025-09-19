---
sidebar_position: 1
title: EMG Performance Metrics
---

# EMG Performance Metrics

Clinical scoring algorithms for GHOSTLY+ rehabilitation therapy.

## Overview

Performance scoring system for elderly rehabilitation (≥65 years) with Blood Flow Restriction (BFR) therapy.

## Study Protocol

**GHOSTLY+ TBM Study**: 120 hospitalized adults (≥65 years)

**Intervention**:
- 5 therapy sessions/week × 14 days
- Each session = 3 game sessions (2-min rest)
- Each game = 12 contractions per muscle (left + right quadriceps)
- Target: ≥75% MVC intensity under 50% AOP BFR

## Performance Score Formula

$$P_{\text{overall}} = w_c \times S_{\text{compliance}} + w_s \times S_{\text{symmetry}} + w_e \times S_{\text{effort}} + w_g \times S_{\text{game}}$$

**Default Weights** ($\sum w_i = 1$):
- $w_c = 0.5$ (Therapeutic Compliance)
- $w_s = 0.25$ (Muscle Symmetry)  
- $w_e = 0.25$ (Subjective Effort)
- $w_g = 0.0$ (Game Performance)

## 1. Therapeutic Compliance

$$S_{\text{compliance}} = \frac{S_{\text{comp}}^{\text{left}} + S_{\text{comp}}^{\text{right}}}{2} \times C_{\text{BFR}}$$

**BFR Safety Gate**:
$$C_{BFR} = \begin{cases}
1.0 & \text{if pressure} \in [45\%, 55\%] \text{ AOP} \\
0.0 & \text{otherwise}
\end{cases}$$

**Per-Muscle Compliance**:
$$S_{\text{comp}}^{\text{muscle}} = w_{\text{comp}} \times R_{\text{comp}} + w_{\text{int}} \times R_{\text{int}} + w_{\text{dur}} \times R_{\text{dur}}$$

| Component | Formula | Description |
|-----------|---------|-------------|
| Completion Rate ($R_{comp}$) | $\frac{\text{contractions completed}}{12}$ | All prescribed contractions |
| Intensity Rate ($R_{int}$) | $\frac{\text{reps} \geq 75\% \text{MVC}}{\text{reps completed}}$ | Force threshold achievement |
| Duration Rate ($R_{dur}$) | $\frac{\text{reps} \geq \text{duration threshold}}{\text{reps completed}}$ | Time requirement compliance |

## 2. Muscle Symmetry

**Clinical Formula** (Asymmetry Index):
$$S_{\text{symmetry}} = \left(1 - \frac{|S_{\text{comp}}^{\text{left}} - S_{\text{comp}}^{\text{right}}|}{S_{\text{comp}}^{\text{left}} + S_{\text{comp}}^{\text{right}}}\right) \times 100$$

**Clinical Interpretation**:
- **>90%** = Excellent symmetry (return-to-sport criteria)
- **80-90%** = Good symmetry (acceptable for daily activities)  
- **<80%** = Poor symmetry (requires therapeutic intervention)

## 3. Subjective Effort Score

Based on post-session **Borg CR-10 Scale**:

| RPE Range | Score | Clinical Interpretation |
|-----------|-------|------------------------|
| 4-6 | 100% | Optimal therapeutic range |
| 3, 7 | 80% | Acceptable range |
| 2, 8 | 60% | Suboptimal range |
| 0-1, 9-10 | 20% | Poor/dangerous |

## 4. Game Performance Score

$$S_{\text{game}} = \frac{\text{game points achieved}}{\text{max achievable points}} \times 100$$

**Note**: Optional metric (default weight = 0.0)

## MVC Determination Priority

**3-Tier Cascade** for Maximum Voluntary Contraction thresholds:

### Priority 1: C3D Metadata (Highest Priority)
- **Source**: Pre-session MVC assessment in C3D file metadata
- **Fields**: `mvc_ch1`, `mvc_ch2` from baseline session
- **Reliability**: Gold standard - direct measurement

### Priority 2: Patient Database (Future Implementation)
- **Source**: Historical MVC values from patient's previous sessions
- **Method**: Database lookup using patient UUID

### Priority 3: Self-Calibration (Default)
- **Source**: Backend-calculated from current session EMG analysis
- **Pipeline**: Raw EMG → High-pass Filter (20Hz) → Rectification → Low-pass Filter (10Hz) → RMS Envelope → Peak Detection

## Clinical Example

**Scenario**: 72-year-old patient, Day 5, BFR at 52% AOP

**Session Metrics**:
- Left muscle: 11/12 completed (92%), 9/11 ≥75% MVC (82%), 10/11 ≥2s (91%)
- Right muscle: 12/12 completed (100%), 8/12 ≥75% MVC (67%), 11/12 ≥2s (92%)
- Post-session RPE: 6
- Game score: 850/1000 points

**Calculations**:
- $S_{\text{comp}}^{\text{left}} = \frac{1}{3}(0.92 + 0.82 + 0.91) = 88.3\%$
- $S_{\text{comp}}^{\text{right}} = \frac{1}{3}(1.00 + 0.67 + 0.92) = 86.2\%$
- $S_{\text{compliance}} = \frac{88.3 + 86.2}{2} \times 1.0 = 87.3\%$
- $S_{\text{symmetry}} = \left(1 - \frac{|88.3-86.2|}{88.3+86.2}\right) \times 100 = 98.8\%$
- $S_{\text{effort}} = 100\%$ (RPE = 6)

**Overall Performance**:
$$P_{\text{overall}} = 0.5 \times 87.3 + 0.25 \times 98.8 + 0.25 \times 100 = 93.4\%$$

**Clinical Interpretation**: Excellent rehabilitation performance - optimal therapeutic benefit achieved.
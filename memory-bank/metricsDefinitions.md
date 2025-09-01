# GHOSTLY+ Performance Metrics: Technical Specification

**Objective**: Concise technical specification of the GHOSTLY+ performance scoring algorithm for clinical trial validation.

---

## 1. Clinical Trial Context

**GHOSTLY+ TBM** - Multicenter RCT with 120 hospitalized adults (≥65 years) with restricted lower-limb mobility.

**Intervention Protocol**:
- **5 Therapy Sessions per week** over 14 days
- Each **Therapy Session** = 3 Game Sessions (with 2-min rest periods)
- Each **Game Session** = 12 isometric contractions per muscle (left + right quadriceps)
- Target: ≥75% MVC intensity under 50% AOP BFR

**Primary Outcome**: Lower-limb muscle strength (MicroFet Dynamometer)

---

## 2. Scoring Terminology

**🟢 Compliance** (*"How well?"*): Intra-session metric quantifying execution quality within a single Game Session. Assesses whether contractions met force (≥75% MVC) and duration (≥2s) targets.

**🔵 Adherence** (*"How often?"*): Inter-session metric quantifying protocol consistency over multiple days. Measures completion of prescribed sessions (5 Therapy Sessions/week).

---

## 3. Real-Time Performance Score

Core performance score calculated after each **Game Session**:

$$P_{overall} = w_c \cdot S_{compliance} + w_s \cdot S_{symmetry} + w_e \cdot S_{effort} + w_g \cdot S_{game}$$

**Default Weights** (research-determined, $\sum w_i = 1$):
- $w_c = 0.5$ (Therapeutic Compliance)
- $w_s = 0.25$ (Muscle Symmetry) 
- $w_e = 0.25$ (Subjective Effort)
- $w_g = 0.0$ (Game Performance) *Default weight = 0.00 because it dependse*

### 3.1 Therapeutic Compliance Score

$$S_{compliance} = \left(\frac{S_{comp}^{left} + S_{comp}^{right}}{2}\right) \times C_{BFR}$$

**BFR Safety Gate** (Applied to Overall Score):
$$P_{overall} = \left(w_c \cdot S_{compliance} + w_s \cdot S_{symmetry} + w_e \cdot S_{effort} + w_g \cdot S_{game}\right) \times C_{BFR}$$

$$C_{BFR} = \begin{cases}
1.0 & \text{if pressure} \in [45\%, 55\%] \text{ AOP} \\
\textcolor{red}{0.0} & \text{otherwise (full penalty)}
\end{cases}$$

**Per-Muscle Compliance**:
$$S_{comp}^{muscle} = w_{comp} \cdot R_{comp} + w_{int} \cdot R_{int} + w_{dur} \cdot R_{dur}$$

| Component | Symbol | Weight | Formula | Description |
|-----------|--------|--------|---------|-------------|
| Completion Rate | $R_{comp}$ | $w_{comp}$ | $\frac{\text{contractions completed}}{12}$ | All prescribed contractions completed |
| Intensity Rate | $R_{int}$ | $w_{int}$ | $\frac{\text{reps} \ge 75\% \text{MVC}}{\text{reps completed}}$ | Force threshold achievement |
| Duration Rate | $R_{dur}$ | $w_{dur}$ | $\frac{\text{reps} \ge \text{duration threshold}}{\text{reps completed}}$ | Time requirement compliance |

*Note: Weights ($w_{comp}, w_{int}, w_{dur}$) are configurable, defaulting to 1/3 each. The duration threshold is adaptive.*

### 3.2 Muscle Symmetry Score

$$S_{symmetry} = \left(1 - \frac{|S_{comp}^{left} - S_{comp}^{right}|}{S_{comp}^{left} + S_{comp}^{right}}\right) \times 100$$

**Medical Rationale & Evidence Base**:

This formula represents the **clinically standard Asymmetry Index** widely used in rehabilitation medicine and peer-reviewed research. Based on extensive medical literature review (December 2025), this approach is superior to alternative formulas for several clinical reasons:

**✅ Evidence-Based Medicine**:
- Standard formula in rehabilitation research and clinical practice
- Used extensively in EMG bilateral muscle assessment studies
- Established in peer-reviewed journals for muscle balance evaluation
- Consistent with Limb Symmetry Index (LSI) principles in sports medicine

**✅ Clinical Interpretation**:
- **Normalized to Total Performance**: Denominator `(left + right)` provides meaningful context relative to total bilateral capability
- **Percentage-Based**: Results directly correlate to established clinical thresholds:
  - **>90%** = Excellent symmetry (return-to-sport criteria)
  - **80-90%** = Good symmetry (acceptable for daily activities)  
  - **<80%** = Poor symmetry (requires therapeutic intervention)

**✅ Superior to Min/Max Approach**:
The alternative formula `min(left, right) / max(left, right) × 100` has clinical limitations:
- Penalizes high unilateral performance (artificially lowers symmetry when one side excels)
- Less sensitive to clinically significant differences in bilateral low performance
- Not established in medical literature for rehabilitation assessment

**Clinical Example**:
- Patient: Left = 60%, Right = 80%
- **Medical formula**: `(1 - |60-80|/(60+80)) × 100 = 85.7%` → *Good symmetry, minor intervention*
- **Min/Max formula**: `60/80 × 100 = 75%` → *Poor symmetry, major intervention* (overly pessimistic)

**Implementation**: Both backend (`performance_scoring_service.py`) and frontend (`useEnhancedPerformanceMetrics.ts`) use this medically validated formula for consistent clinical assessment.

### 3.3 Subjective Effort Score

Based on post-session Rating of Perceived Exertion (RPE) on 0-10 scale:

$$S_{effort} = \begin{cases}
100\% & \text{if } \text{RPE}_{post} \in [4, 6] \text{ (optimal therapeutic range)} \\
80\% & \text{if } \text{RPE}_{post} \in \{3, 7\} \text{ (acceptable range)} \\
60\% & \text{if } \text{RPE}_{post} \in \{2, 8\} \text{ (suboptimal range)} \\
20\% & \text{if } \text{RPE}_{post} \in \{0, 1, 9, 10\} \text{ (poor/dangerous)}
\end{cases}$$

### 3.4 Game Performance Score

$$S_{game} = \frac{\text{game points achieved}}{\text{max achievable points (current difficulty)}} \times 100$$

*Note: Game performance score is optional and highly game-dependent. Default weight is 0.00 when game scoring data is unavailable or unreliable. Maximum achievable points adapt via Dynamic Difficulty Adjustment (DDA) system.*
Description
Measures patient performance in the gamified environment, normalized
against the max possible score, which is adapted by DDA system.
Important Consideration
This score is an optional proxy for patient engagement. Its clinical
relevance is highly game-dependent. The score in the Maze game
reflects performance smoothness, while in other games it is not
directly linked to therapeutic execution.
Therefore, by default, its weight (wg) in the Overall Performance
Score is set to zero.

---

## 4. Longitudinal Adherence Score

$$\text{Adherence}(t) = \frac{\text{Game Sessions completed by day } t}{\text{Game Sessions expected by day } t} \times 100$$

Where:
- $t$ = current protocol day ($t \geq 3$ for measurement stability)
- Expected rate: 15 Game Sessions per 7 days ≈ $2.14 \times t$
- **Starting Day**: Adherence calculation begins from day 3 onwards to ensure stable baseline

**Clinical Thresholds**:
- **Excellent**: ≥85% (meeting/exceeding frequency)
- **Good**: 70-84% (adequate with minor gaps)
- **Moderate**: 50-69% (suboptimal, intervention consideration)
- **Poor**: <50% (significant concern, support needed)

---

## 5. Clinical Example

**Scenario**: 72-year-old, Day 5, BFR active at 52% AOP

**Metrics**:
- Left muscle: 11/12 completed (92%), 9/11 ≥75% MVC (82%), 10/11 ≥2s (91%)
- Right muscle: 12/12 completed (100%), 8/12 ≥75% MVC (67%), 11/12 ≥2s (92%)
- Post-session RPE: 6
- Game score: 850/1000 points

**Calculations**:
- $S_{comp}^{left} = \frac{1}{3}(0.92 + 0.82 + 0.91) = 88.3\%$
- $S_{comp}^{right} = \frac{1}{3}(1.00 + 0.67 + 0.92) = 86.2\%$
- $S_{compliance} = \frac{88.3 + 86.2}{2} \times 1.0 = 87.3\%$
- $S_{symmetry} = \left(1 - \frac{|88.3 - 86.2|}{88.3 + 86.2}\right) \times 100 = 98.8\%$
- $S_{effort} = 100\%$ (RPE = 6)
- $S_{game} = 85\%$

**Overall Performance** (with BFR safety gate):
$$P_{overall} = \left(0.40 \times 87.3 + 0.25 \times 98.8 + 0.20 \times 100 + 0.15 \times 85\right) \times 1.0 = 91.6\%$$

**Clinical Interpretation**: Excellent rehabilitation performance - optimal therapeutic benefit achieved.

---

## 6. Primary Validation Objectives

This framework requires experimental validation to determine:

1. **Optimal Weightings ($w_i$)**: Via regression modeling against MicroFet strength data and 30s-STS outcomes
2. **Clinical Validity of RPE Mapping**: Correlate with physiological data (EMG fatigue index) and patient-reported outcomes
3. **Parameter Thresholds**: Systematically tune MVC%, duration, and BFR window thresholds
4. **DDA Algorithm Efficacy**: Evaluate therapeutic challenge maintenance across treatment course

---

## 7. MVC Workflow and Priority System

**Technical Specification**: The system implements a 3-tier priority cascade for MVC threshold determination, ensuring clinical accuracy through personalized assessment workflows.

### 7.1 MVC Priority Cascade

**Priority 1 - C3D Metadata (Highest Priority)**:
- **Source**: Pre-session MVC assessment recorded in C3D file metadata
- **Data Fields**: `mvc_ch1`, `mvc_ch2` from baseline session
- **Clinical Method**: Dedicated MVC assessment session before therapeutic intervention
- **Personalization**: Patient-specific values from controlled assessment conditions
- **Reliability**: Gold standard - direct measurement from patient under standardized conditions

**Priority 2 - Patient Database (Future Implementation)**:
- **Source**: Historical MVC values from patient's previous sessions
- **Method**: Database lookup using patient UUID
- **Use Cases**: Continuity across multiple therapy sessions, trending analysis
- **Status**: Planned for future implementation with patient baseline management

**Priority 3 - Self-Calibration (Current Session Analysis)**:
- **Source**: Backend-calculated from current session EMG analysis
- **Method**: Clinical estimation using peak detection from processed EMG signals
- **Signal Processing Pipeline**:
  ```
  Raw EMG → High-pass Filter (20Hz) → Rectification → Low-pass Filter (10Hz) → RMS Envelope → Peak Detection
  ```
- **Calculation**: `mvc_threshold_actual_value / 0.75` (reverse-engineer from 75% threshold)
- **Use Cases**: Fallback when no pre-session assessment available

**Fallback - Session Defaults**:
- **Source**: Development/testing defaults (`SessionDefaults.MVC_CH1/CH2`)
- **Values**: 150μV per channel (1.5e-4 mV)
- **Use Cases**: Development, testing, or when all other sources unavailable

### 7.2 Clinical Rationale

**Pre-Session MVC Assessment Priority**:
Each C3D file contains a pre-session MVC assessment recorded before the therapeutic game session. This assessment provides the most accurate personalized MVC values because:

- **Controlled Conditions**: Standardized assessment protocol without game distractions
- **Fresh State**: Patient not fatigued from therapeutic exercise
- **Clinical Supervision**: Therapist-guided maximum voluntary contractions
- **Bilateral Assessment**: Independent CH1 and CH2 measurements for asymmetry detection

**Signal Processing Standards**:
- **High-pass Filter (20Hz)**: Eliminates baseline drift and motion artifacts
- **Full-wave Rectification**: Converts bipolar EMG to unipolar amplitude signal
- **Low-pass Filter (10Hz)**: Creates smooth envelope suitable for peak detection
- **RMS Smoothing (50ms)**: Clinical standard for EMG envelope processing

**Therapeutic Threshold Calculation**:
- **Standard Protocol**: 75% of determined MVC value
- **Clinical Basis**: Optimal balance between therapeutic challenge and patient safety
- **Personalization**: Adapts to individual patient capabilities and muscle condition

### 7.3 Implementation Details

**Database Storage**:
- **MVC Source Tracking**: `processing_parameters.mvc_source` field records priority level used
- **Algorithm Configuration**: `processing_parameters.algorithm_config` stores immutable processing parameters
- **Session Traceability**: Full audit trail of MVC determination method for each session

**Source Values**:
- `"c3d_metadata"` - Priority 1: Pre-session assessment from C3D file
- `"patient_database"` - Priority 2: Historical patient values (future)
- `"self_calibration"` - Priority 3: Backend-calculated from current session
- `"session_defaults"` - Fallback: Development/testing defaults

**Per-Channel Flexibility**:
- **Independent Assessment**: CH1 and CH2 can have different MVC values
- **Muscle-Specific**: Accounts for bilateral strength differences
- **Therapeutic Targeting**: Enables asymmetry-aware rehabilitation protocols

### 7.4 Workflow Integration

The MVC priority cascade integrates seamlessly with the therapeutic targeting system:

1. **Session Initialization**: Determine MVC values using priority cascade
2. **Therapeutic Targets**: Apply per-channel contraction targets (flexible CH1 ≠ CH2)
3. **Real-time Analysis**: Use determined MVC values for contraction quality assessment
4. **Performance Scoring**: Calculate compliance metrics using personalized thresholds
5. **Session Documentation**: Record MVC source and values for clinical tracking

This workflow ensures that therapeutic interventions are personalized to each patient's actual capabilities while maintaining clinical rigor and traceability.

---

## 8. Implementation Notes

- **Real-time Calculation**: All metrics calculated during session for immediate feedback
- **Configurable Weights**: All weights adjustable through settings interface
- **Safety Priority**: BFR violations override all other performance metrics
- **Clinical Population**: Optimized for hospitalized older adults with mobility restrictions
- **MVC Data Quality**: Backend calculations preferred for clinical accuracy
- **Open Source**: Available at https://github.com/openfeasyo/OpenFeasyo
# GHOSTLY+ Performance Metrics Definitions

---
## Table of Contents

1. **[Overall Performance Score](#1-overall-performance-score)** - Weighted composite assessment
2. **[Therapeutic Compliance Score](#2-therapeutic-compliance-score)** - Exercise execution quality  
   - 2.1 **[BFR Safety Compliance](#21-blood-flow-restriction-bfr-safety-compliance)** - Safety multiplier system
3. **[Muscle Symmetry Score](#3-muscle-symmetry-score)** - Bilateral balance assessment
4. **[Subjective Effort Score](#4-subjective-effort-score)** - RPE-based exertion evaluation
5. **[Game Performance Score](#5-game-performance-score)** - Normalized engagement metric
6. **[Clinical Scenarios](#complete-clinical-scenarios)** - Worked examples and case studies
7. **[Adherence Score](#6-adherence-score-cross-session-protocol-following)** - Cross-session participation tracking
8. **[Baseline Assessment & DDA](#7-baseline-assessment-and-dynamic-difficulty-adjustment-dda)** - Progressive difficulty system
9. **[Research Team Notes](#notes-for-research-team)** - Implementation and validation considerations
10. **[Clinical Reference](#clinical-reference-compliance-vs-adherence)** - Compliance vs. Adherence distinction

---


## 1. Overall Performance Score

### Clinical Context

The GHOSTLY+ Overall Performance Score provides **real-time, objective assessment** of rehabilitation effectiveness during game-based therapy sessions. This composite metric addresses the critical clinical need for immediate feedback on exercise quality, safety, and patient engagement in hospitalized older adults with restricted mobility.

**Key Clinical Benefits:**
- **Immediate therapeutic feedback** during 10-minute rehabilitation sessions
- **Safety monitoring** with BFR protocol compliance validation  
- **Evidence-based assessment** combining objective EMG analysis with validated clinical scales
- **Progress tracking** across multiple therapy sessions for outcome measurement

The comprehensive rehabilitation score combines four evidence-based dimensions using a weighted linear model:

$$P_{overall} = w_1 \cdot S_{compliance} + w_2 \cdot S_{symmetry} + w_3 \cdot S_{effort} + w_4 \cdot S_{game}$$

**Default Clinical Weights** (research-validated for hospitalized older adults):

| Component | Weight | Priority | Clinical Focus |
|-----------|--------|----------|----------------|
| Therapeutic Compliance ($w_1$) | 40% | Primary | Exercise execution quality |
| Muscle Symmetry ($w_2$) | 25% | Safety | Bilateral balance, injury prevention |
| Subjective Effort ($w_3$) | 20% | Tolerance | Patient-reported exertion appropriateness |
| Game Performance ($w_4$) | 15% | Engagement | Motivation and adherence support |

**Complete Example Calculation:**
Patient achieves: Compliance 85%, Symmetry 92%, Effort 100%, Game 78%
$$P_{overall} = 0.40 \times 85 + 0.25 \times 92 + 0.20 \times 100 + 0.15 \times 78 = 34.0 + 23.0 + 20.0 + 11.7 = 88.7\%$$

**Clinical Interpretation:**

| Score Range | Performance Level | Clinical Action | Therapeutic Outcome |
|-------------|------------------|-----------------|-------------------|
| ≥90% | Excellent | Continue current protocol | Optimal therapeutic benefit |
| 80-89% | Good | Minor adjustments | Effective therapy, minor improvements needed |
| 70-79% | Moderate | Monitor closely | Therapeutic benefit achieved |
| 60-69% | Fair | Intervention adjustments | Protocol modifications recommended |
| <60% | Poor | Comprehensive review | Immediate therapy review required |

Where:
- $P_{overall}$ = Overall performance score (0-100%)
- $w_i$ = Weight for component $i$ (configurable, sum to 1.0)
- $S_{compliance}$ = Therapeutic compliance score (detailed below)
- $S_{symmetry}$ = Muscle symmetry score (bilateral balance assessment)
- $S_{effort}$ = Subjective effort score (RPE-based evaluation)
- $S_{game}$ = Normalized game performance score (engagement metric)

## 2. Therapeutic Compliance Score

**Compliance** = *"How well"* - Measures the quality of exercise execution within each session.

Therapeutic compliance evaluates whether exercises were performed correctly with proper intensity, duration, and completion:

$$S_{compliance} = \left(\frac{S_{compliance}^{left} + S_{compliance}^{right}}{2}\right) \times C_{BFR}$$

For each muscle (left/right):

$$S_{compliance}^{muscle} = w_{comp} \cdot R_{completion} + w_{intensity} \cdot R_{intensity} + w_{dur} \cdot R_{duration}$$

Where:
- $R_{completion}$ = Completion rate = $\frac{\text{contractions completed}}{\text{contractions expected}}$
- $R_{intensity}$ = Intensity quality rate = $\frac{\text{contractions} \geq \text{75\% MVC}}{\text{total contractions}}$
- $R_{duration}$ = Duration quality rate = $\frac{\text{contractions} \geq \text{duration threshold}}{\text{total contractions}}$
- $C_{BFR}$ = BFR safety compliance (1.0 if within therapeutic range, 0.0 otherwise)

### 2.1 Blood Flow Restriction (BFR) Safety Compliance

When Blood Flow Restriction is active, the compliance score includes a critical safety multiplier that can override all other exercise quality metrics:

$$C_{BFR} = \begin{cases}
1.0 & \text{if pressure} \in [45\%, 55\%] \text{ AOP} \\
0.0 & \text{otherwise}
\end{cases}$$

**GHOSTLY+ Protocol Therapeutic Range:**

| Parameter | Value | Clinical Rationale |
|-----------|--------|-------------------|
| **Target pressure** | 50% AOP | Optimal therapeutic benefit |
| **Tolerance range** | 45-55% AOP | ±5% safety margin |
| **Compliance scoring** | Binary (1.0 or 0.0) | Safety-first approach |
| **Population adjustment** | Conservative vs. 70-80% AOP | Hospitalized older adults safety |

**Clinical Safety Rationale:**
The binary scoring system ensures that any pressure deviation immediately flags the session as non-compliant, as BFR outside therapeutic ranges can cause:
- **Below 45% AOP**: Insufficient occlusion, reduced therapeutic benefit
- **Above 55% AOP**: Excessive occlusion risk, potential vascular compromise in older adults

Any deviation from BFR therapeutic range compromises exercise safety and effectiveness, warranting immediate compliance score reduction to zero regardless of exercise execution quality.

**Component Weights:**

| Component         | Symbol          | Weight | Clinical Focus                |
| ----------------- | --------------- | ------ | ----------------------------- |
| Completion        | $w_{comp}$      | 33%    | Exercise adherence            |
| Intensity Quality | $w_{intensity}$ | 34%    | MVC threshold achievement     |
| Duration Quality  | $w_{dur}$       | 33%    | Contraction time requirements |

**Clinical Thresholds:**
- Expected contractions per muscle: 12
- MVC threshold: ≥75% of maximum voluntary contraction
- Duration threshold: ≥2000ms (adaptive, increases with patient progress)
- BFR range: 50% ± 5% AOP (45%-55% Arterial Occlusion Pressure)

**Real Clinical Example:**
Left muscle: 11/12 contractions completed (92%), 9/11 above 75% MVC (82%), 10/11 above 2s duration (91%)
Right muscle: 12/12 contractions completed (100%), 8/12 above 75% MVC (67%), 11/12 above 2s duration (92%)
BFR maintained at 52% AOP (within range)

Calculations:
- $S_{compliance}^{left} = 0.33 \times 0.92 + 0.34 \times 0.82 + 0.33 \times 0.91 = 0.304 + 0.279 + 0.300 = 88.3\%$
- $S_{compliance}^{right} = 0.33 \times 1.00 + 0.34 \times 0.67 + 0.33 \times 0.92 = 0.330 + 0.228 + 0.304 = 86.2\%$
- $S_{compliance} = \left(\frac{88.3 + 86.2}{2}\right) \times 1.0 = 87.3\%$

## 3. Muscle Symmetry Score

**Symmetry** = Bilateral balance assessment to prevent compensation patterns and ensure equal therapeutic benefit to both sides.

$$S_{symmetry} = \left(1 - \frac{|S_{left} - S_{right}|}{S_{left} + S_{right}}\right) \times 100$$

Where:
- $S_{left}$ = Left muscle compliance score (from Therapeutic Compliance calculation)
- $S_{right}$ = Right muscle compliance score (from Therapeutic Compliance calculation)

**Worked Examples:**
1. **Balanced Performance**: Left muscle: 85%, Right muscle: 78%
   $S_{symmetry} = \left(1 - \frac{|85 - 78|}{85 + 78}\right) \times 100 = \left(1 - \frac{7}{163}\right) \times 100 = 95.7\%$

2. **Significant Imbalance**: Left muscle: 90%, Right muscle: 45%
   $S_{symmetry} = \left(1 - \frac{|90 - 45|}{90 + 45}\right) \times 100 = \left(1 - \frac{45}{135}\right) \times 100 = 66.7\%$

**Clinical Interpretation:**
- 100% = Perfect bilateral balance
- 90-99% = Excellent balance (typical healthy range)
- 70-89% = Minor imbalance (monitor for progression)
- <70% = Significant imbalance (intervention recommended)

## 4. Subjective Effort Score

**Effort** = Patient-reported exertion appropriateness based on Rate of Perceived Exertion (RPE) change during session, ensuring therapeutic stimulus without overexertion.

$$S_{effort} = \begin{cases}
20\% & \text{if } \Delta RPE \leq 0 \text{ (no fatigue - insufficient stimulus)} \\
60\% & \text{if } \Delta RPE = 1 \text{ (minimal effort)} \\
100\% & \text{if } \Delta RPE \in [2, 3] \text{ (optimal therapeutic window)} \\
80\% & \text{if } \Delta RPE = 4 \text{ (high but acceptable)} \\
60\% & \text{if } \Delta RPE = 5 \text{ (approaching overexertion)} \\
40\% & \text{if } \Delta RPE \geq 6 \text{ (excessive - risk of overexertion)}
\end{cases}$$

**Examples**: 
- Pre: 3, Post: 5 → ΔRPE = 2 → **100%** (optimal therapeutic stimulus)
- Pre: 2, Post: 5 → ΔRPE = 3 → **100%** (optimal therapeutic stimulus)
- Pre: 4, Post: 5 → ΔRPE = 1 → **60%** (minimal - increase intensity?)
- Pre: 3, Post: 3 → ΔRPE = 0 → **20%** (no fatigue - insufficient workout)
- Pre: 2, Post: 8 → ΔRPE = 6 → **40%** (excessive - reduce intensity)

Where:
- $\Delta RPE = RPE_{post} - RPE_{pre}$
- RPE scale: 0-10 (Borg CR10)

**Clinical Rationale:**
- **No fatigue (≤0)**: Insufficient therapeutic stimulus - exercise too easy
- **Optimal zone (+2 to +3)**: Ideal therapeutic workload for adaptation
- **High effort (+4 to +5)**: Effective but monitor for sustainability
- **Excessive (+6 or more)**: Risk of overexertion and poor recovery

## 5. Game Performance Score

**Game Performance** = Normalized engagement metric that maintains motivation while accounting for progressive difficulty increases through Dynamic Difficulty Adjustment.

$$S_{game} = \frac{\text{game points}}{\text{max achievable points}} \times 100$$

**Dynamic Difficulty Adjustment (DDA) Integration:**
- **Baseline calibration**: Initial session establishes patient-specific MVC values and contraction thresholds
- **Progressive difficulty**: Game difficulty and maximum achievable points increase as patient improves
- **Adaptive normalization**: Score calculation adjusts to maintain 0-100% scale across all difficulty levels
- **Clinical validity**: Ensures 85% score means "excellent performance" regardless of current difficulty

**Example**: If player scores 850 points and max achievable is 1000 points:
$S_{game} = \frac{850}{1000} \times 100 = 85\%$

---

## Complete Clinical Scenarios

### Scenario A: Excellent Session Performance
**Patient Context**: 72-year-old, Day 5 of treatment, BFR protocol active

**Individual Metrics:**
- **Compliance**: 87.3% (from detailed calculation above)
- **Symmetry**: 95.7% (balanced bilateral performance)  
- **Effort**: 100% (optimal RPE change: Pre=3, Post=5, ΔRPE=2)
- **Game**: 85% (850/1000 points with current difficulty)

**Overall Performance Calculation:**
$$P_{overall} = 0.40 \times 87.3 + 0.25 \times 95.7 + 0.20 \times 100 + 0.15 \times 85$$
$$P_{overall} = 34.9 + 23.9 + 20.0 + 12.8 = 91.6\%$$

**Clinical Interpretation**: Excellent rehabilitation performance - optimal therapeutic benefit achieved.

### Scenario B: BFR Safety Violation
**Patient Context**: Same patient, but BFR pressure drifts to 60% AOP during session

**Individual Metrics:**
- **Compliance**: 0% (excellent exercise execution negated by BFR safety violation)
- **Symmetry**: 95.7% (unchanged)
- **Effort**: 100% (unchanged)  
- **Game**: 85% (unchanged)

**Overall Performance Calculation:**
$$P_{overall} = 0.40 \times 0 + 0.25 \times 95.7 + 0.20 \times 100 + 0.15 \times 85$$
$$P_{overall} = 0 + 23.9 + 20.0 + 12.8 = 56.7\%$$

**Clinical Interpretation**: Poor performance due to safety violation - immediate intervention required despite good bilateral balance and effort.

---

## 6. Adherence Score (Cross-Session Protocol Following)

**Adherence** = *"How often"* - Measures consistency of participation across sessions.

**Simple Dynamic Adherence Formula**:
$$\text{Adherence}(t) = \frac{\text{game sessions detected by day } t}{\text{expected game sessions by day } t} \times 100, \quad t \geq 3$$

Where:
- **Expected game sessions by day t**: $\frac{15 \times t}{7} = 2.14 \times t$
- **Game session = 1 C3D file** (technical mapping: 1 file = 1 game session ≈ 2 minutes)

**Examples**:
- **Day 3**: Expected = 6.4 game sessions → If 4 game sessions detected → Adherence(3) = 62.5%
- **Day 5**: Expected = 10.7 game sessions → If 8 game sessions detected → Adherence(5) = 74.8%  
- **Day 7**: Expected = 15.0 game sessions → If 12 game sessions detected → Adherence(7) = 80.0%

**Confidence Level by Time Window**:
*Note: Expected values rounded to nearest whole number for clinical interpretation*

| Day       | Expected Game Sessions | Confidence | Clinical Interpretation                 |
| --------- | ---------------------- | ---------- | --------------------------------------- |
| **Day 3** | 6                      | 60%        | Emerging pattern, preliminary trend     |
| **Day 4** | 9                      | 70%        | Developing pattern, moderate confidence |
| **Day 5** | 11                     | 80%        | Reliable trend, good confidence         |
| **Day 6** | 13                     | 90%        | Strong trend, high confidence           |
| **Day 7** | 15                     | 95%        | Weekly complete, definitive assessment  |

**Clinical Thresholds**:
- **Excellent**: ≥85% (meeting/exceeding expected exercise frequency)
- **Good**: 70-84% (adequate exercise frequency with minor gaps)
- **Moderate**: 50-69% (suboptimal frequency, intervention consideration)
- **Poor**: <50% (significant adherence concern, support needed)

Based on the GHOSTLY+ multicenter RCT protocol specifications:

## 7. Baseline Assessment and Dynamic Difficulty Adjustment (DDA)

**Baseline Session Protocol:**
The initial session establishes patient-specific parameters that evolve throughout treatment:

$$\text{Baseline MVC}_{muscle} = \max(\text{voluntary contraction amplitude during calibration})$$

$$\text{Initial Duration Threshold} = \text{patient capability assessment (typically 2-3 seconds)}$$

**Dynamic Difficulty Adjustment Algorithm:**
Parameters adapt based on patient progress over multiple sessions:

$$\text{Adaptive MVC Threshold} = \text{Baseline MVC} \times \text{Progress Factor}$$

$$\text{Adaptive Duration} = \text{Initial Duration} + (\text{Session Number} \times \text{Progression Rate})$$

Where:
- **Progress Factor**: Calculated from recent session performance (range: 0.75-1.25)
- **Progression Rate**: Patient-specific advancement in contraction duration (10-50ms/session)
- **Maximum Score Adjustment**: Scales with difficulty to maintain normalization validity

**DDA Impact on Metrics:**
- **Game Score Normalization**: Maximum achievable points scale with current difficulty level
- **Duration Threshold**: Increases progressively (3s → 10s over treatment course)
- **MVC Quality**: Maintains relative intensity while accounting for strength improvements
- **Clinical Relevance**: Ensures metrics remain therapeutically meaningful as patient progresses

## Notes for Research Team

1. **Hierarchical Structure Evolution**: The current linear equation will evolve into a hierarchical model where Therapeutic Compliance becomes a composite metric containing multiple sub-components.

2. **Weight Customization**: All weights are configurable through the settings interface to allow for research variations and patient-specific adjustments.

3. **Real-time Calculation**: All metrics are calculated in real-time during the session to provide immediate feedback.

4. **Clinical Validation**: Thresholds and weights are based on pilot data and will be refined through the multicenter RCT.

5. **BFR Integration**: BFR status is tracked per muscle and will influence compliance calculations when the full BFR monitoring system is implemented.

6. **DDA Clinical Rationale**: Dynamic difficulty adjustment ensures therapeutic challenge remains optimal as patient capabilities improve, preventing plateau effects while maintaining safety margins.

7. **Baseline Session Importance**: The initial calibration session is critical for establishing accurate patient-specific baselines that inform all subsequent difficulty adjustments and score normalizations.

8. **GHOSTLY+ Study Context**: This system is being validated in a multicenter RCT (UZ Brussel, UZA, UZ Leuven Pellenberg) with 120 hospitalized older adults (≥65 years) with restricted lower-limb mobility.

9. **Target Population**: Non-weight-bearing or support-restricted patients who cannot engage in traditional high-load dynamic strength exercises, requiring alternative rehabilitation approaches.

10. **Implementation Framework**: Uses Hybrid Type 1 design to evaluate therapeutic effectiveness while gathering implementation data, following Proctor's Framework for acceptability, adoption, fidelity, feasibility, penetration, and sustainability.

11. **Study Outcomes**: Primary outcome is muscle strength loss at hospital discharge (MicroFet), with secondary outcomes including muscle mass (ultrasound), functional capacity (30-second sit-to-stand), therapy adherence, user experience, and hospital length of stay.

12. **Open Science Approach**: GHOSTLY+ system is developed as open-source software (https://github.com/openfeasyo/OpenFeasyo) to maximize impact and accessibility within the healthcare community on a non-profit basis.

---

## Clinical Reference: Compliance vs Adherence

### Essential Clinical Distinction

**COMPLIANCE** = *"How well"* - Quality of exercise execution
- **Definition**: Measures the quality of protocol execution within each session
- **Key Question**: "Did the patient perform exercises correctly?"
- **Clinical Examples**: 
  - Intensity: Did they reach ≥75% MVC threshold?
  - Duration: Did contractions last ≥2 seconds?
  - Completion: Did they finish all 12 repetitions per muscle?
- **Time Frame**: Single session (10 minutes)
- **Clinical Impact**: Determines therapeutic effectiveness and safety

**ADHERENCE** = *"How often"* - Consistency of participation  
- **Definition**: Measures attendance to prescribed treatment schedule
- **Key Question**: "Did the patient show up and participate?"
- **Clinical Examples**:
  - Weekly: Did they complete 12/15 expected game sessions this week?
  - Daily: Did they perform any therapy session today?
  - Protocol: Did they complete 25/30 sessions over 2 weeks?
- **Time Frame**: Multiple days/weeks
- **Clinical Impact**: Predicts long-term outcomes and engagement

### Quick Reference Table

| Aspect | **COMPLIANCE** | **ADHERENCE** |
|--------|----------------|---------------|
| **Focus** | *How well* (Quality) | *How often* (Frequency) |
| **Scope** | Within single session | Across multiple sessions |
| **Time Frame** | 10 minutes | Days to weeks |
| **Key Question** | "Did they do it right?" | "Did they show up?" |
| **Measurement** | Exercise quality metrics | Session completion rate |
| **Clinical Goal** | Therapeutic effectiveness | Treatment engagement |
| **Example Metric** | 85% intensity compliance | 80% weekly adherence |
| **Poor Score Indicates** | Incorrect exercise execution | Missed appointments/sessions |

### Memory Aid
- **Compliance** = Quality (*within* session) → "How well did they exercise?"
- **Adherence** = Attendance (*across* sessions) → "How often did they participate?"
# GHOSTLY+ TBM Performance Scoring System - Implementation Plan

## Executive Summary

This document outlines the comprehensive implementation plan for a clinically-relevant, two-tier performance scoring system for the GHOSTLY+ TBM clinical trial. The system separates protocol compliance from patient performance, ensuring data quality while providing meaningful rehabilitation metrics.

## Clinical Trial Context

### GHOSTLY+ TBM Study Overview
- **Population**: Hospitalized older adults (≥65 years) with restricted lower-limb mobility
- **Design**: Multicenter RCT (UZ Brussel, UZA, UZ Leuven Pellenberg)
- **Duration**: 2 weeks minimum, 5 sessions/week
- **Primary Outcome**: Lower-limb muscle strength at discharge
- **Secondary Outcomes**: Muscle mass, functional capacity, therapy adherence, user experience

### BFR Protocol Specifications
- **Target Pressure**: 50% of Arterial Occlusion Pressure (AOP)
- **Exercise Protocol**: 3 sets × 12 repetitions
- **MVC Target**: 75% of Maximum Voluntary Contraction
- **Safety Range**: 40-60% AOP (outside range = protocol violation)

## Two-Tier Scoring Architecture

### Tier 1: Protocol Compliance Score (Pass/Fail)
**Purpose**: Ensure clinical trial protocol adherence and data quality

**Components**:
1. **BFR Compliance**: 50% AOP ± 5% tolerance (45-55% range)
2. **Exercise Protocol**: 3 sets × 12 reps completed
3. **MVC Calibration**: 75% MVC target achieved
4. **Session Frequency**: Minimum 5 sessions/week requirement met
5. **Safety Monitoring**: No adverse events recorded

**Scoring Logic**:
- **PASS**: All components met → Patient Performance Score calculated
- **FAIL**: Any component failed → Overall score = 0, performance data flagged as invalid

### Tier 2: Patient Performance Score (0-100)
**Purpose**: Assess patient rehabilitation progress within valid protocol sessions

**Components & Weights**:
1. **Contraction Achievement (25%)**: Count vs target
2. **Contraction Quality (25%)**: Good vs poor ratio (≥75% MVC)
3. **Muscle Symmetry (20%)**: Left/right balance
4. **Fatigue Management (20%)**: Exertion appropriateness + EMG fatigue indices
5. **Therapy Adherence (10%)**: Session completion rate

## Detailed Component Analysis

### 1. Protocol Compliance Components

#### A. BFR Compliance
- **Measurement**: Applied pressure / AOP × 100
- **Therapeutic Range**: 40-60% AOP
- **Trial Target**: 50% AOP
- **Tolerance**: ±5% (45-55% acceptable)
- **Validation**: Measured AOP required for accurate assessment

#### B. Exercise Protocol
- **Target**: 3 sets × 12 repetitions
- **Measurement**: Actual sets/reps completed
- **Tolerance**: ±1 rep per set acceptable
- **Tracking**: EMG contraction detection

#### C. MVC Calibration
- **Target**: 75% of individual MVC
- **Measurement**: Peak contraction amplitude vs MVC baseline
- **Validation**: Pre-session MVC assessment required
- **Quality Control**: Minimum 3 valid contractions for MVC determination

#### D. Session Frequency
- **Requirement**: 5 sessions/week minimum
- **Measurement**: Completed sessions / prescribed sessions
- **Tracking**: Session logs and timestamps
- **Compliance**: Weekly assessment

#### E. Safety Monitoring
- **Tracking**: Adverse event reporting
- **Documentation**: Incident logs and severity assessment
- **Validation**: Clinical staff review required

### 2. Patient Performance Components

#### A. Contraction Achievement (25%)
**Clinical Relevance**: Measures therapy adherence and exercise volume completion

- **Calculation**: (Actual contractions / Target contractions) × 100
- **Target**: 36 contractions per session (3 sets × 12 reps)
- **Scoring**: Linear scale 0-100%
- **Display**: Progress bar with L/R breakdown

#### B. Contraction Quality (25%)
**Clinical Relevance**: Ensures proper muscle activation and prevents compensation

- **Measurement**: Contractions ≥75% MVC / Total contractions
- **Threshold**: 75% of individual MVC (protocol-specified)
- **Scoring**: Percentage of good contractions
- **Display**: Quality ratio with visual indicators

#### C. Muscle Symmetry (20%)
**Clinical Relevance**: Prevents compensation patterns and ensures balanced rehabilitation

- **Calculation**: min(L_score, R_score) / max(L_score, R_score) × 100
- **Score Components**: (Count achievement × Quality) per side
- **Interpretation**: 
  - >90%: Excellent symmetry
  - 80-89%: Good symmetry
  - 70-79%: Moderate asymmetry
  - <70%: Significant asymmetry (clinical concern)
- **Display**: Balance scale visualization

#### D. Fatigue Management (20%)
**Clinical Relevance**: Validates therapeutic challenge and monitors fatigue progression

**Sub-components**:
1. **Subjective Exertion (50% of fatigue score)**
   - **Measurement**: Post-session RPE - Pre-session RPE
   - **Optimal Range**: +2 to +4 points
   - **Scoring**:
     - +2 to +4: 100% (optimal therapeutic challenge)
     - +1 or +5: 80% (acceptable)
     - 0 or +6: 60% (suboptimal)
     - Negative or >+6: 40% (concerning)

2. **Objective Fatigue Indices (50% of fatigue score)**
   - **Dimitrov's FI_nsm5**: Spectral compression index
   - **MPF/MDF Slope**: Frequency shift during session
   - **RMS Progression**: Amplitude changes indicating fatigue
   - **Scoring**: Normalized against clinical reference ranges

#### E. Therapy Adherence (10%)
**Clinical Relevance**: Measures overall engagement and protocol compliance

- **Measurement**: Completed sessions / Prescribed sessions
- **Tracking**: Weekly and overall adherence rates
- **Minimum**: 5 sessions/week for protocol compliance
- **Scoring**: Percentage completion

## Visual Design Specifications

### Protocol Compliance Display
```
┌─────────────────────────────────────────┐
│        GHOSTLY+ TBM Protocol            │
│         Compliance: ✓ PASSED            │
│                                         │
│  ✓ BFR Pressure: 50% AOP (✓ Valid)     │
│  ✓ Exercise: 3×12 reps (✓ Complete)    │
│  ✓ MVC Target: 75% (✓ Achieved)        │
│  ✓ Session Freq: 5/week (✓ Met)        │
│  ✓ Safety: No adverse events           │
└─────────────────────────────────────────┘
```

### Patient Performance Display
```
┌─────────────────────────────────────────┐
│       Patient Performance Score         │
│              84/100 [Good]              │
│                                         │
│  Contraction Achievement (25%) [21/25]  │
│  ████████████████████░░░                │
│  Target: 36/36 reps (100%)             │
│                                         │
│  Contraction Quality (25%)     [19/25]  │
│  ████████████████░░░░                   │
│  Good: 28/36 (78% ≥75% MVC)            │
│                                         │
│  Muscle Symmetry (20%)         [16/20]  │
│  ████████████████░░░░                   │
│  L/R Balance: 82%                       │
│                                         │
│  Fatigue Management (20%)      [18/20]  │
│  ██████████████████░░                   │
│  RPE: +3 (optimal) | FI: 0.15 (good)   │
│                                         │
│  Therapy Adherence (10%)       [10/10]  │
│  ████████████████████                   │
│  Sessions: 5/5 completed                │
└─────────────────────────────────────────┘
```

### BFR Pressure Visualization
```
┌─────────────────────────────────────────┐
│         BFR Pressure Monitor            │
│                                         │
│     ┌─────────────────────────┐        │
│     │  ████████████░░░░░░░░░  │ 50%    │
│     └─────────────────────────┘        │
│              of AOP                     │
│                                         │
│  Applied pressure: 90 mmHg              │
│  ─────────────────────────              │
│  Full occlusion (AOP): 180 mmHg        │
│                                         │
│  Status: ✓ Within therapeutic range     │
│          (40-60% of AOP)                │
└─────────────────────────────────────────┘
```

## Technical Implementation

### 1. Type Definitions
```typescript
// Protocol compliance parameters
interface GhostlyTBMProtocol {
  target_aop_percentage: 50;
  exercise_sets: 3;
  exercise_reps: 12;
  target_mvc_percentage: 75;
  required_sessions_per_week: 5;
  adverse_events: string[];
}

// BFR parameters
interface BFRParameters {
  aop_measured: number;          // mmHg
  target_percentage: number;     // 50%
  applied_pressure: number;      // mmHg
  protocol_sets: number;         // 3
  protocol_reps: number;         // 12
  rest_duration_seconds: number; // Between sets
}

// Performance weights
interface PerformanceWeights {
  contraction_achievement: number;  // 25%
  contraction_quality: number;      // 25%
  muscle_symmetry: number;          // 20%
  fatigue_management: number;       // 20%
  therapy_adherence: number;        // 10%
}

// Fatigue assessment
interface FatigueAssessment {
  pre_session_rpe: number;
  post_session_rpe: number;
  emg_fatigue_indices: {
    fi_nsm5: number;
    mpf_slope: number;
    mdf_slope: number;
    rms_progression: number;
  };
}
```

### 2. Component Architecture
```
Settings Components:
├── ProtocolComplianceSettings.tsx
├── PerformanceWeightsSettings.tsx
├── BFRParametersSettings.tsx
├── FatigueAssessmentSettings.tsx
└── TrialProtocolSettings.tsx

Display Components:
├── ProtocolComplianceCard.tsx
├── PatientPerformanceCard.tsx
├── BFRPressureVisualization.tsx
├── ContractionAchievementCard.tsx
├── ContractionQualityCard.tsx
├── MuscleSymmetryCard.tsx
├── FatigueManagementCard.tsx
└── TherapyAdherenceCard.tsx

Hooks:
├── useProtocolCompliance.ts
├── usePerformanceMetrics.ts (updated)
├── useBFRValidation.ts
└── useFatigueAssessment.ts
```

### 3. Tab Structure
```typescript
const tabs = [
  "Signal Plots",
  "Protocol Compliance",     // Trial protocol adherence
  "Patient Performance",     // Performance metrics (if compliant)
  "BFR Monitoring",         // Pressure visualization and safety
  "Fatigue Assessment",     // RPE and EMG fatigue indices
  "Game Stats",
  "Raw Data"
];
```

## Clinical Validation

### 1. Protocol Compliance Validation
- **BFR Pressure**: Automated validation against AOP measurements
- **Exercise Protocol**: EMG-based contraction counting
- **MVC Calibration**: Pre-session validation required
- **Safety Monitoring**: Integration with adverse event reporting

### 2. Performance Metrics Validation
- **Contraction Quality**: Validated against clinical MVC standards
- **Symmetry Assessment**: Comparison with published asymmetry thresholds
- **Fatigue Indices**: Validated against EMG fatigue literature
- **RPE Scaling**: Borg CR10 scale validation

### 3. Clinical Relevance Mapping
- **Primary Outcome**: Contraction quality → muscle strength
- **Secondary Outcomes**: 
  - Symmetry → functional capacity
  - Fatigue management → therapy adherence
  - Adherence → user experience
  - Protocol compliance → data quality

## Implementation Priority

### Phase 1: Core Infrastructure (High Priority)
1. Add BFR parameters to GameSessionParameters type
2. Create BFR pressure visualization component
3. Update usePerformanceMetrics hook with BFR validation
4. Create ProtocolComplianceCard component

### Phase 2: Performance Scoring (High Priority)
1. Implement fatigue assessment component
2. Create PerformanceScoreSettings component
3. Update scoring logic with new weights
4. Add trial-specific validation

### Phase 3: UI Enhancement (Medium Priority)
1. Split MusclePerformanceCard into separate components
2. Update OverallPerformanceCard with new breakdown
3. Enhance MuscleSymmetryCard with visual indicators
4. Update game-session-tabs structure

### Phase 4: Clinical Integration (Low Priority)
1. Add trial data export functionality
2. Create clinical reporting templates
3. Implement longitudinal tracking
4. Add outcome measure correlations

## Success Criteria

### Technical Success
- [ ] Protocol compliance automatically validated
- [ ] Performance scoring accurately reflects clinical outcomes
- [ ] BFR pressure monitoring ensures safety
- [ ] Fatigue assessment integrates objective and subjective measures
- [ ] Settings allow customization for different protocols

### Clinical Success
- [ ] Scores correlate with trial primary outcomes
- [ ] Protocol violations immediately flagged
- [ ] Patient performance tracks rehabilitation progress
- [ ] System supports clinical decision-making
- [ ] Data quality maintained for research purposes

## Future Enhancements

### Short-term (3-6 months)
- Multi-session trend analysis
- Predictive performance modeling
- Automated protocol adjustment recommendations
- Integration with hospital EHR systems

### Long-term (6-12 months)
- Machine learning for personalized thresholds
- Real-time coaching based on performance metrics
- Comparative effectiveness research tools
- Integration with wearable sensors

## Conclusion

This performance scoring system provides a comprehensive, clinically-relevant framework for the GHOSTLY+ TBM trial. By separating protocol compliance from patient performance, the system ensures data quality while providing meaningful rehabilitation metrics that directly support the trial's primary and secondary outcomes.

The two-tier approach protects against protocol violations while maintaining detailed performance tracking, supporting both clinical care and research objectives. The modular design allows for future enhancements and adaptation to other rehabilitation protocols.

---

*Document Version: 1.0*  
*Date: July 17, 2025*  
*Author: Claude (Anthropic)*  
*Project: GHOSTLY+ TBM EMG C3D Analyzer*  
*Status: Implementation Plan - Ready for Development*
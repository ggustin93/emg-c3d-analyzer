# EMG C3D Analyzer - Database Population Guide

## 🎯 Overview

Complete guide for populating the EMG C3D Analyzer database with realistic clinical rehabilitation data.

**Target Result**: Fully populated database with 65+ patients, 400+ therapy sessions, comprehensive EMG analysis, and GHOSTLY+ performance scoring.

## 📋 Prerequisites

- **Schema v2.1** deployed (clean schema + scoring normalization)
- **Supabase CLI** authenticated and configured
- **Empty or existing database** (scripts handle conflicts gracefully)

## 🚀 Quick Start

### Option 1: Automatic Execution (Recommended)
```bash
cd database/population/
./run_all_population.sh
```

### Option 2: Manual Step-by-Step

## 🚀 Execution Sequence

### Step 1: Core Data Population
**File**: `01_core_data_population.sql`

**Content**:
- ✅ 5 User profiles (therapists, researchers, admin)
- ✅ 65 Patients with diverse pathologies
- ✅ 30 Patient PII records (representative sample)
- ✅ 400+ Therapy sessions with clinical progression

**Execution**:
```bash
psql "$DATABASE_URL" -f 01_core_data_population.sql
```

**Expected Output**:
```
PHASE 1 COMPLETE: Users, Patients & Sessions Created! 🎉
user_profiles: 5
patients: 65
therapy_sessions: 400+
completed_sessions: 380+
```

### Step 2: EMG Analysis & Performance Scores
**File**: `02_emg_performance_population.sql`

**Content**:
- ✅ EMG statistics (bilateral CH1+CH2 patterns)
- ✅ GHOSTLY+ performance scores with constraint fixes
- ✅ Pathology-specific performance factors
- ✅ Session progression improvements

**Key Fixes**:
- **Symmetry Score Bounds**: `LEAST(100.0, ...)` prevents constraint violations
- **Bilateral Analysis**: 85% sessions have CH1+CH2 data
- **Clinical Realism**: Stroke asymmetry patterns, MS variability, ACL progression

**Execution**:
```bash
psql "$DATABASE_URL" -f 02_emg_performance_population.sql
```

**Expected Output**:
```
PHASE 5 COMPLETE: EMG Statistics & Performance Scores! 🎯
emg_records: 300+
sessions_with_emg: 200+
performance_scores: 200+
avg_overall_score: 65-75
```

### Step 3: Technical Metadata
**File**: `03_technical_metadata_population.sql`

**Content**:
- ✅ C3D technical data (sampling rates, durations, channels)
- ✅ Processing parameters (EMG filters, RMS windows)
- ✅ Session settings (pathology-specific thresholds)
- ✅ BFR monitoring (safety compliance tracking)

**Technical Specs**:
- **Sampling Rates**: 500Hz, 1kHz, 2kHz (clinical standards)
- **Session Durations**: 2-6 minutes (pathology-specific)
- **EMG Filters**: 20-500Hz bandpass, 4th order Butterworth
- **BFR Safety**: 95% compliance, 40-60% AOP

**Execution**:
```bash
psql "$DATABASE_URL" -f 03_technical_metadata_population.sql
```

**Expected Output**:
```
PHASE 6 COMPLETE: All Technical Data Populated! 🚀
c3d_records: 200+
processing_params: 200+
session_settings: 200+
bfr_measurements: 150+
```

### Step 4: Validation & Summary
**File**: `04_validation_and_summary.sql`

**Content**:
- ✅ Data integrity validation
- ✅ Population statistics
- ✅ Clinical analysis summary
- ✅ Quality metrics assessment

**Validation Checks**:
- User role distribution
- Patient pathology spread
- EMG coverage (bilateral vs unilateral)
- Performance score distributions
- Data completeness percentages

**Execution**:
```bash
psql "$DATABASE_URL" -f 04_validation_and_summary.sql
```

## 📊 Expected Final Results

### Database Population
| Table | Records | Coverage | Status |
|-------|---------|----------|--------|
| **user_profiles** | 5 | Therapists + Admin | ✅ Complete |
| **patients** | 65 | 15 pathology categories | ✅ Complete |
| **patient_pii** | 30 | Representative sample | ✅ Complete |
| **therapy_sessions** | 400+ | Multi-pathology | ✅ Complete |
| **emg_statistics** | 300+ | 85% bilateral | ✅ Complete |
| **performance_scores** | 200+ | GHOSTLY+ compliant | ✅ Complete |
| **c3d_technical_data** | 200+ | Realistic acquisition | ✅ Complete |
| **processing_parameters** | 200+ | EMG standards | ✅ Complete |
| **session_settings** | 200+ | Pathology-specific | ✅ Complete |
| **bfr_monitoring** | 150+ | 95% safety compliant | ✅ Complete |

### Clinical Distribution
| Pathology | Patients | Avg Performance | Clinical Focus |
|-----------|----------|-----------------|---------------|
| **Stroke Rehabilitation** | ~20 | 65-70% | Hemiparesis, asymmetry |
| **Multiple Sclerosis** | ~8 | 60-65% | Fatigue, variability |
| **Parkinson Disease** | ~6 | 70-75% | Bradykinesia, tremor |
| **Orthopedic Knee** | ~12 | 80-85% | Post-surgical strength |
| **Spinal Cord Injury** | ~6 | 55-60% | Severe motor impairment |
| **Other Conditions** | ~13 | 70-80% | Mixed rehabilitation |

### Quality Metrics
| Metric | Target | Expected | Status |
|--------|--------|----------|--------|
| **EMG Data Coverage** | >80% | 85-90% | ✅ Excellent |
| **Performance Scoring** | >80% | 85-90% | ✅ Excellent |
| **Bilateral EMG** | >75% | 85% | ✅ Excellent |
| **Signal Quality** | >75% | 78-82% | ✅ High Quality |
| **BFR Safety** | >90% | 95% | ✅ Excellent |

## 🔧 Troubleshooting

### Common Issues

**1. Constraint Violations**
```
ERROR: violates check constraint "performance_scores_symmetry_score_check"
```
**Solution**: Use `performance_scores_generation_fixed.sql` with proper bounds

**2. Foreign Key Errors**
```
ERROR: violates foreign key constraint "user_profiles_id_fkey"
```
**Solution**: Ensure `realistic_data_population.sql` runs first with existing auth.users

**3. Duplicate Data**
```
ERROR: duplicate key value violates unique constraint
```
**Solution**: Scripts include `ON CONFLICT DO NOTHING` and existence checks

### Performance Tips

- **Batch Processing**: Scripts process data in batches (50-200 records)
- **Transaction Safety**: All wrapped in BEGIN/COMMIT transactions
- **Existence Checks**: Prevent duplicate population on re-runs
- **Progress Monitoring**: `RAISE NOTICE` statements show progress

## 🎯 Clinical Realism Features

### Pathology-Specific Patterns
- **Stroke**: Hemiparesis asymmetry, affected side performance reduction
- **Multiple Sclerosis**: Fatigue patterns, session-to-session variability
- **Parkinson's**: Bradykinesia effects, medication timing influences
- **Orthopedic**: Post-surgical progression, strength recovery patterns
- **Spinal Cord**: Functional level limitations, adaptation strategies

### Therapeutic Progression
- **Session Improvement**: 1.5-2% improvement per session
- **Compliance Growth**: Better adherence with experience
- **Pathology Factors**: Condition-specific performance ceilings
- **Age Adjustments**: Realistic performance expectations by age group

### GHOSTLY+ Compliance
- **Scoring Weights**: 40% compliance, 25% symmetry, 20% effort, 15% game
- **Clinical Thresholds**: 75% MVC threshold, 2.0s duration targets
- **BFR Safety**: 40-60% AOP, blood pressure monitoring
- **Performance Bounds**: All scores properly constrained 0-100%

## 📝 Script Maintenance

### Adding New Pathologies
1. Update `pathology_categories` array in `realistic_data_population.sql`
2. Add pathology-specific factors in performance calculations
3. Update clinical notes templates

### Modifying Performance Factors
1. Edit pathology factor calculations in `performance_scores_generation_fixed.sql`
2. Adjust improvement progression rates
3. Update GHOSTLY+ scoring weights in scoring_configuration

### Scaling Patient Counts
1. Modify loop limits in DO blocks
2. Adjust therapist-to-patient ratios
3. Update expected session counts per pathology

## 🚀 Next Steps

1. **Execute Scripts**: Follow execution sequence above
2. **Validate Results**: Run master validation script
3. **Test Application**: Verify frontend integration
4. **Performance Testing**: Load test with populated data
5. **Backup Database**: Create backup after successful population

---

## 📁 File Summary

| File | Purpose | Records Created | Dependencies |
|------|---------|-----------------|--------------|
| `01_core_data_population.sql` | Core data population | Users, Patients, Sessions | auth.users table |
| `02_emg_performance_population.sql` | EMG analysis & scoring | EMG stats, Performance scores | Therapy sessions |
| `03_technical_metadata_population.sql` | Technical metadata | C3D data, Parameters, Settings | Sessions, EMG stats |
| `04_validation_and_summary.sql` | Validation & summary | Validation queries | All previous data |
| `run_all_population.sh` | Automated execution | All above scripts | All SQL files |

**Total Population**: ~1,500+ records across 10 tables with realistic clinical patterns

**Execution Time**: ~2-5 minutes for complete population (depending on system performance)

**Database Size**: ~50-100MB with full population and indexes

**Status**: Production-ready for development, testing, and demonstration 🎉
-- =====================================================================================
-- Migration 009: Enhanced MVP Schema with Performance Scoring Fields
-- =====================================================================================
-- 
-- 🎯 PRAGMATIC DATABASE ENGINEERING - Enhanced MVP with Future-Proofing
-- 
-- PURPOSE:
-- 1. Create simplified PROCESSING_PARAMETERS table (11 essential columns)
-- 2. Add missing fields to existing tables for performance_scoring_service.py
-- 3. Ensure webhook integration can populate all required data
--
-- PHILOSOPHY:
-- - Build what we NEED now (processing parameters)
-- - Add fields we WILL need soon (RPE, game scores, expected contractions)
-- - Keep it simple and explicit (KISS principle)
-- =====================================================================================

BEGIN;

-- =====================================================================================
-- STEP 1: Create PROCESSING_PARAMETERS Table (MVP - 11 Essential Columns)
-- =====================================================================================

CREATE TABLE processing_parameters (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    session_id UUID REFERENCES therapy_sessions(id) ON DELETE CASCADE,
    
    -- Core Signal Processing (Essential Only)
    sampling_rate_hz DOUBLE PRECISION NOT NULL,
    filter_low_cutoff_hz DOUBLE PRECISION NOT NULL DEFAULT 20.0,
    filter_high_cutoff_hz DOUBLE PRECISION NOT NULL DEFAULT 500.0,
    filter_order INTEGER NOT NULL DEFAULT 4,
    
    -- RMS Envelope Parameters (Clinical Essential)
    rms_window_ms DOUBLE PRECISION NOT NULL DEFAULT 50.0,
    rms_overlap_percent DOUBLE PRECISION NOT NULL DEFAULT 50.0,
    
    -- MVC Detection (Therapy Essential)
    mvc_window_seconds DOUBLE PRECISION NOT NULL DEFAULT 3.0,
    mvc_threshold_percentage DOUBLE PRECISION NOT NULL DEFAULT 75.0,
    
    -- Processing Metadata
    processing_version TEXT NOT NULL DEFAULT '1.0',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Constraints (Explicit Validation)
    CONSTRAINT valid_sampling_rate CHECK (sampling_rate_hz > 0),
    CONSTRAINT valid_filter_cutoffs CHECK (
        filter_low_cutoff_hz > 0 AND 
        filter_high_cutoff_hz > filter_low_cutoff_hz AND
        filter_high_cutoff_hz <= (sampling_rate_hz / 2)
    ),
    CONSTRAINT valid_rms_window CHECK (rms_window_ms > 0),
    CONSTRAINT valid_rms_overlap CHECK (rms_overlap_percent >= 0 AND rms_overlap_percent < 100),
    CONSTRAINT valid_mvc_window CHECK (mvc_window_seconds > 0),
    CONSTRAINT valid_mvc_threshold CHECK (mvc_threshold_percentage > 0 AND mvc_threshold_percentage <= 100)
);

-- Essential index for processing parameters
CREATE INDEX idx_processing_parameters_session ON processing_parameters(session_id);

-- Self-documenting comment
COMMENT ON TABLE processing_parameters IS 'MVP processing parameters - essential EMG signal processing settings only';

-- =====================================================================================
-- STEP 2: Enhance EMG_STATISTICS for Performance Scoring Service
-- =====================================================================================

-- Add fields needed by performance_scoring_service.py
ALTER TABLE emg_statistics ADD COLUMN IF NOT EXISTS mvc_contraction_count INTEGER;
ALTER TABLE emg_statistics ADD COLUMN IF NOT EXISTS duration_contraction_count INTEGER;

-- Update existing records with reasonable defaults (good_contractions as fallback)
UPDATE emg_statistics 
SET 
    mvc_contraction_count = COALESCE(mvc_contraction_count, good_contractions),
    duration_contraction_count = COALESCE(duration_contraction_count, good_contractions)
WHERE mvc_contraction_count IS NULL OR duration_contraction_count IS NULL;

-- =====================================================================================
-- STEP 3: Enhance PERFORMANCE_SCORES for Complete Scoring Algorithm
-- =====================================================================================

-- Add fields used by performance_scoring_service.py (if they don't exist)
ALTER TABLE performance_scores ADD COLUMN IF NOT EXISTS effort_score DOUBLE PRECISION;
ALTER TABLE performance_scores ADD COLUMN IF NOT EXISTS game_score DOUBLE PRECISION;
ALTER TABLE performance_scores ADD COLUMN IF NOT EXISTS left_muscle_compliance DOUBLE PRECISION;
ALTER TABLE performance_scores ADD COLUMN IF NOT EXISTS right_muscle_compliance DOUBLE PRECISION;

-- Detailed compliance rate components
ALTER TABLE performance_scores ADD COLUMN IF NOT EXISTS completion_rate_left DOUBLE PRECISION;
ALTER TABLE performance_scores ADD COLUMN IF NOT EXISTS completion_rate_right DOUBLE PRECISION;
ALTER TABLE performance_scores ADD COLUMN IF NOT EXISTS intensity_rate_left DOUBLE PRECISION;
ALTER TABLE performance_scores ADD COLUMN IF NOT EXISTS intensity_rate_right DOUBLE PRECISION;
ALTER TABLE performance_scores ADD COLUMN IF NOT EXISTS duration_rate_left DOUBLE PRECISION;
ALTER TABLE performance_scores ADD COLUMN IF NOT EXISTS duration_rate_right DOUBLE PRECISION;

-- BFR monitoring fields (already exist from Migration 008)
-- bfr_compliant BOOLEAN DEFAULT true (already exists)
ALTER TABLE performance_scores ADD COLUMN IF NOT EXISTS bfr_pressure_aop DOUBLE PRECISION;

-- Subjective data fields for RPE and game performance
ALTER TABLE performance_scores ADD COLUMN IF NOT EXISTS rpe_post_session INTEGER;
ALTER TABLE performance_scores ADD COLUMN IF NOT EXISTS game_points_achieved INTEGER;
ALTER TABLE performance_scores ADD COLUMN IF NOT EXISTS game_points_max INTEGER;

-- Scoring weights (used by performance_scoring_service.py)
ALTER TABLE performance_scores ADD COLUMN IF NOT EXISTS weight_compliance DOUBLE PRECISION DEFAULT 0.40;
ALTER TABLE performance_scores ADD COLUMN IF NOT EXISTS weight_symmetry DOUBLE PRECISION DEFAULT 0.25;
ALTER TABLE performance_scores ADD COLUMN IF NOT EXISTS weight_effort DOUBLE PRECISION DEFAULT 0.20;
ALTER TABLE performance_scores ADD COLUMN IF NOT EXISTS weight_game DOUBLE PRECISION DEFAULT 0.15;
ALTER TABLE performance_scores ADD COLUMN IF NOT EXISTS weight_completion DOUBLE PRECISION DEFAULT 0.333;
ALTER TABLE performance_scores ADD COLUMN IF NOT EXISTS weight_intensity DOUBLE PRECISION DEFAULT 0.333;
ALTER TABLE performance_scores ADD COLUMN IF NOT EXISTS weight_duration DOUBLE PRECISION DEFAULT 0.334;

-- Add constraints for new fields
ALTER TABLE performance_scores ADD CONSTRAINT IF NOT EXISTS valid_rpe CHECK (rpe_post_session IS NULL OR (rpe_post_session >= 0 AND rpe_post_session <= 10));
ALTER TABLE performance_scores ADD CONSTRAINT IF NOT EXISTS valid_game_score CHECK (game_score IS NULL OR (game_score >= 0.0 AND game_score <= 100.0));
ALTER TABLE performance_scores ADD CONSTRAINT IF NOT EXISTS valid_effort_score CHECK (effort_score IS NULL OR (effort_score >= 0.0 AND effort_score <= 100.0));
ALTER TABLE performance_scores ADD CONSTRAINT IF NOT EXISTS valid_bfr_pressure CHECK (bfr_pressure_aop IS NULL OR (bfr_pressure_aop >= 0 AND bfr_pressure_aop <= 100));

-- =====================================================================================
-- STEP 4: Enhance SESSION_SETTINGS for Expected Contractions
-- =====================================================================================

-- Add expected contractions field used by performance_scoring_service.py
ALTER TABLE session_settings ADD COLUMN IF NOT EXISTS expected_contractions_per_muscle INTEGER NOT NULL DEFAULT 12;

-- Add constraint
ALTER TABLE session_settings ADD CONSTRAINT IF NOT EXISTS valid_expected_contractions CHECK (expected_contractions_per_muscle > 0);

-- =====================================================================================
-- STEP 5: Enhance BFR_MONITORING for Detailed Measurements
-- =====================================================================================

-- Add detailed BFR measurement fields that may be extracted from future C3D data
ALTER TABLE bfr_monitoring ADD COLUMN IF NOT EXISTS measurement_timestamp TIMESTAMPTZ;
ALTER TABLE bfr_monitoring ADD COLUMN IF NOT EXISTS cuff_pressure_mmhg DOUBLE PRECISION;
ALTER TABLE bfr_monitoring ADD COLUMN IF NOT EXISTS systolic_bp_mmhg DOUBLE PRECISION;
ALTER TABLE bfr_monitoring ADD COLUMN IF NOT EXISTS diastolic_bp_mmhg DOUBLE PRECISION;
ALTER TABLE bfr_monitoring ADD COLUMN IF NOT EXISTS measurement_method TEXT DEFAULT 'automatic';

-- Add constraints for new BFR fields
ALTER TABLE bfr_monitoring ADD CONSTRAINT IF NOT EXISTS valid_cuff_pressure CHECK (cuff_pressure_mmhg IS NULL OR cuff_pressure_mmhg > 0);
ALTER TABLE bfr_monitoring ADD CONSTRAINT IF NOT EXISTS valid_systolic_bp CHECK (systolic_bp_mmhg IS NULL OR (systolic_bp_mmhg > 0 AND systolic_bp_mmhg <= 300));
ALTER TABLE bfr_monitoring ADD CONSTRAINT IF NOT EXISTS valid_diastolic_bp CHECK (diastolic_bp_mmhg IS NULL OR (diastolic_bp_mmhg > 0 AND diastolic_bp_mmhg <= 200));
ALTER TABLE bfr_monitoring ADD CONSTRAINT IF NOT EXISTS valid_measurement_method CHECK (measurement_method IN ('automatic', 'manual', 'estimated'));

-- =====================================================================================
-- STEP 6: Create Additional Indexes for Performance Queries
-- =====================================================================================

-- Performance-critical indexes for scoring service
CREATE INDEX IF NOT EXISTS idx_performance_scores_rpe ON performance_scores(rpe_post_session) WHERE rpe_post_session IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_performance_scores_game ON performance_scores(game_points_achieved) WHERE game_points_achieved IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_bfr_monitoring_pressure ON bfr_monitoring(actual_pressure_aop);
CREATE INDEX IF NOT EXISTS idx_emg_statistics_channel_type ON emg_statistics(channel_name) WHERE channel_name LIKE '%left%' OR channel_name LIKE '%right%';

-- =====================================================================================
-- STEP 7: Update Table Comments (Self-Documenting Schema)
-- =====================================================================================

COMMENT ON COLUMN emg_statistics.mvc_contraction_count IS 'Number of contractions meeting MVC threshold for intensity scoring';
COMMENT ON COLUMN emg_statistics.duration_contraction_count IS 'Number of contractions meeting duration threshold for timing scoring';

COMMENT ON COLUMN performance_scores.rpe_post_session IS 'Rating of Perceived Exertion (0-10 Borg CR10 scale) collected post-session';
COMMENT ON COLUMN performance_scores.game_points_achieved IS 'Points scored in GHOSTLY game during therapy session';
COMMENT ON COLUMN performance_scores.game_points_max IS 'Maximum possible points for GHOSTLY game session';
COMMENT ON COLUMN performance_scores.bfr_pressure_aop IS 'Blood Flow Restriction pressure as percentage of Arterial Occlusion Pressure';

COMMENT ON COLUMN session_settings.expected_contractions_per_muscle IS 'Target number of contractions per muscle group per session (protocol-defined)';

COMMENT ON COLUMN bfr_monitoring.cuff_pressure_mmhg IS 'Actual cuff pressure in mmHg during BFR therapy';
COMMENT ON COLUMN bfr_monitoring.systolic_bp_mmhg IS 'Systolic blood pressure measurement for AOP calculation';
COMMENT ON COLUMN bfr_monitoring.diastolic_bp_mmhg IS 'Diastolic blood pressure measurement for AOP calculation';

-- =====================================================================================
-- STEP 8: Initialize Default Processing Parameters for Existing Sessions
-- =====================================================================================

-- Insert default processing parameters for existing therapy sessions
INSERT INTO processing_parameters (
    session_id, 
    sampling_rate_hz,
    filter_low_cutoff_hz,
    filter_high_cutoff_hz,
    filter_order,
    rms_window_ms,
    rms_overlap_percent,
    mvc_window_seconds,
    mvc_threshold_percentage,
    processing_version
)
SELECT 
    ts.id as session_id,
    COALESCE(ts.original_sampling_rate, 1000.0) as sampling_rate_hz,
    20.0 as filter_low_cutoff_hz,    -- EMG clinical standard
    500.0 as filter_high_cutoff_hz,  -- EMG clinical standard
    4 as filter_order,               -- Butterworth 4th order standard
    50.0 as rms_window_ms,          -- 50ms RMS window clinical standard
    50.0 as rms_overlap_percent,    -- 50% overlap standard
    3.0 as mvc_window_seconds,      -- 3 second MVC window
    75.0 as mvc_threshold_percentage, -- 75% MVC threshold
    '1.0' as processing_version
FROM therapy_sessions ts
WHERE ts.id NOT IN (
    SELECT session_id FROM processing_parameters WHERE session_id IS NOT NULL
)
AND ts.original_sampling_rate IS NOT NULL;

-- =====================================================================================
-- STEP 9: Update Session Settings with Expected Contractions
-- =====================================================================================

-- Set expected contractions for existing session settings
UPDATE session_settings 
SET expected_contractions_per_muscle = 12 
WHERE expected_contractions_per_muscle IS NULL;

-- =====================================================================================
-- STEP 10: Validation Queries
-- =====================================================================================

-- Verify new table structure
SELECT 
    'processing_parameters' as table_name,
    COUNT(*) as row_count,
    COUNT(DISTINCT session_id) as unique_sessions
FROM processing_parameters
UNION ALL
SELECT 
    'performance_scores_enhanced',
    COUNT(*),
    COUNT(DISTINCT session_id)
FROM performance_scores
UNION ALL
SELECT 
    'bfr_monitoring_enhanced',
    COUNT(*),
    COUNT(DISTINCT session_id)
FROM bfr_monitoring;

-- Verify foreign key relationships
SELECT 
    tc.table_name, 
    kcu.column_name, 
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY' 
    AND tc.table_name IN ('processing_parameters', 'performance_scores', 'emg_statistics', 'bfr_monitoring', 'session_settings')
ORDER BY tc.table_name;

-- Verify processing parameters constraints
SELECT 
    session_id,
    sampling_rate_hz,
    filter_low_cutoff_hz,
    filter_high_cutoff_hz,
    rms_window_ms,
    mvc_threshold_percentage
FROM processing_parameters 
LIMIT 5;

COMMIT;

-- =====================================================================================
-- RESULT: Enhanced MVP Schema Ready for Performance Scoring Service
-- 
-- NEW TABLES:
-- + processing_parameters: 11 columns (essential EMG processing settings)
--
-- ENHANCED EXISTING TABLES:
-- + performance_scores: +15 columns (complete scoring algorithm support)
-- + emg_statistics: +2 columns (MVC and duration contraction counts)
-- + session_settings: +1 column (expected contractions per muscle)
-- + bfr_monitoring: +5 columns (detailed BFR measurements)
--
-- ✅ READY FOR:
-- - Webhook integration with complete data population
-- - performance_scoring_service.py full functionality
-- - Future C3D extraction of RPE, BFR, game data
-- - Clinical scoring algorithm implementation
-- - Export functionality with enhanced data
--
-- ✅ MAINTAINS:
-- - KISS principle (only essential + planned fields)
-- - Database constraints and validation
-- - Foreign key relationships
-- - Performance indexes
-- - Self-documenting schema
-- =====================================================================================
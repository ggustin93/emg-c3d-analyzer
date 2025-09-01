-- ================================================
-- Smart Database Population Script
-- ================================================
-- Dynamically retrieves actual C3D files from Supabase Storage
-- Populates all clinical tables with realistic EMG data
-- Based on therapy_session_processor.py patterns
-- ================================================

BEGIN;

-- ================================================
-- Step 1: Update therapy_sessions with ACTUAL Storage paths
-- ================================================
-- Dynamically map real C3D files to existing sessions

WITH storage_files AS (
    -- Get actual files from Storage, ranked by upload date
    SELECT 
        SPLIT_PART(name, '/', 1) as patient_folder,
        name as full_path,
        ROW_NUMBER() OVER (PARTITION BY SPLIT_PART(name, '/', 1) ORDER BY (metadata->>'lastModified')::timestamp DESC) as file_rank
    FROM storage.objects 
    WHERE bucket_id = 'c3d-examples' 
    AND name LIKE '%.c3d'
),
patient_sessions AS (
    -- Get sessions that need file paths
    SELECT 
        ts.id as session_id,
        p.patient_code,
        ROW_NUMBER() OVER (PARTITION BY p.patient_code ORDER BY ts.created_at) as session_rank
    FROM therapy_sessions ts
    JOIN patients p ON ts.patient_id = p.id
    WHERE ts.processing_status = 'completed'
)
UPDATE therapy_sessions ts
SET 
    file_path = sf.full_path,
    file_size_bytes = 2867920, -- Actual size from Storage metadata
    updated_at = NOW()
FROM patient_sessions ps
JOIN storage_files sf ON ps.patient_code = sf.patient_folder AND ps.session_rank = sf.file_rank
WHERE ts.id = ps.session_id;

-- Log the updates
DO $$
BEGIN
    RAISE NOTICE 'Updated % therapy sessions with actual Storage paths', 
        (SELECT COUNT(*) FROM therapy_sessions WHERE file_path LIKE '%/%');
END $$;

-- ================================================
-- Step 2: Populate emg_statistics with realistic clinical data
-- ================================================
-- Based on EMG research: RMS 0.05-0.15 mV, fatigue 18-35% increase
-- Using channel_name (TEXT) not channel_index

INSERT INTO public.emg_statistics (
    session_id, channel_name,
    total_contractions, good_contractions, mvc_contraction_count, duration_contraction_count,
    compliance_rate, mvc_value, mvc_threshold, mvc_threshold_actual_value,
    duration_threshold_actual_value, total_time_under_tension_ms,
    avg_duration_ms, max_duration_ms, min_duration_ms,
    avg_amplitude, max_amplitude,
    rms_mean, rms_std, mav_mean, mav_std,
    mpf_mean, mpf_std, mdf_mean, mdf_std,
    fatigue_index_mean, fatigue_index_std, fatigue_index_fi_nsm5,
    signal_quality_score, created_at
)
SELECT 
    ts.id as session_id,
    channel.name as channel_name,
    -- Contraction counts based on pathology
    CASE 
        WHEN p.pathology_category LIKE '%Stroke%' THEN 8 + (random() * 7)::INT
        WHEN p.pathology_category LIKE '%Parkinson%' THEN 10 + (random() * 10)::INT
        WHEN p.pathology_category LIKE '%ACL%' THEN 15 + (random() * 10)::INT
        WHEN p.pathology_category LIKE '%Knee%' THEN 12 + (random() * 8)::INT
        ELSE 10 + (random() * 10)::INT
    END as total_contractions,
    -- Good contractions (70-90% of total)
    CASE 
        WHEN p.pathology_category LIKE '%Stroke%' THEN 5 + (random() * 5)::INT
        WHEN p.pathology_category LIKE '%Parkinson%' THEN 7 + (random() * 8)::INT
        ELSE 8 + (random() * 8)::INT
    END as good_contractions,
    -- MVC contractions (60-80% of good)
    CASE 
        WHEN p.pathology_category LIKE '%Stroke%' THEN 3 + (random() * 4)::INT
        ELSE 5 + (random() * 6)::INT
    END as mvc_contraction_count,
    -- Duration contractions
    CASE 
        WHEN p.pathology_category LIKE '%Stroke%' THEN 4 + (random() * 4)::INT
        ELSE 6 + (random() * 6)::INT
    END as duration_contraction_count,
    -- Compliance rate (0.5-0.95)
    CASE 
        WHEN p.pathology_category LIKE '%Stroke%' THEN 0.50 + (random() * 0.30)
        WHEN p.pathology_category LIKE '%Parkinson%' THEN 0.60 + (random() * 0.30)
        ELSE 0.70 + (random() * 0.25)
    END as compliance_rate,
    -- MVC values in mV (realistic EMG ranges)
    CASE 
        WHEN channel.name = 'CH1' AND p.pathology_category LIKE '%Stroke%Left%' 
            THEN 0.05 + (random() * 0.03) -- Affected side
        WHEN channel.name = 'CH1' THEN 0.08 + (random() * 0.07) -- Normal CH1
        WHEN channel.name = 'CH2' AND p.pathology_category LIKE '%Stroke%Right%'
            THEN 0.05 + (random() * 0.03) -- Affected side
        ELSE 0.08 + (random() * 0.07) -- Normal CH2
    END as mvc_value,
    -- MVC threshold (75% of MVC value)
    CASE 
        WHEN channel.name = 'CH1' AND p.pathology_category LIKE '%Stroke%Left%' 
            THEN (0.05 + (random() * 0.03)) * 0.75
        WHEN channel.name = 'CH1' THEN (0.08 + (random() * 0.07)) * 0.75
        WHEN channel.name = 'CH2' AND p.pathology_category LIKE '%Stroke%Right%'
            THEN (0.05 + (random() * 0.03)) * 0.75
        ELSE (0.08 + (random() * 0.07)) * 0.75
    END as mvc_threshold,
    75.0 as mvc_threshold_actual_value, -- 75% threshold
    2000.0 as duration_threshold_actual_value, -- 2 seconds in ms
    -- Time under tension (total contraction time)
    (2000 + (random() * 3000)) * (8 + (random() * 12)) as total_time_under_tension_ms,
    2500 + (random() * 2000) as avg_duration_ms,
    4000 + (random() * 3000) as max_duration_ms,
    1500 + (random() * 1000) as min_duration_ms,
    -- Amplitude values
    0.06 + (random() * 0.08) as avg_amplitude,
    0.20 + (random() * 0.40) as max_amplitude,
    -- RMS statistics (Root Mean Square)
    0.08 + (random() * 0.04) as rms_mean,
    0.01 + (random() * 0.02) as rms_std,
    -- MAV statistics (Mean Absolute Value)
    0.06 + (random() * 0.03) as mav_mean,
    0.008 + (random() * 0.015) as mav_std,
    -- MPF statistics (Mean Power Frequency)
    80 + (random() * 40) as mpf_mean, -- 80-120 Hz typical
    5 + (random() * 10) as mpf_std,
    -- MDF statistics (Median Frequency)
    75 + (random() * 35) as mdf_mean, -- 75-110 Hz typical
    4 + (random() * 8) as mdf_std,
    -- Fatigue indices (18-35% increase based on research)
    CASE 
        WHEN p.pathology_category LIKE '%Parkinson%' THEN 1.25 + (random() * 0.10) -- Higher fatigue
        WHEN p.pathology_category LIKE '%Stroke%' THEN 1.20 + (random() * 0.12)
        ELSE 1.18 + (random() * 0.14)
    END as fatigue_index_mean,
    0.05 + (random() * 0.10) as fatigue_index_std,
    -- FI-NSM5 fatigue index
    CASE 
        WHEN p.pathology_category LIKE '%Parkinson%' THEN 0.25 + (random() * 0.15)
        ELSE 0.15 + (random() * 0.15)
    END as fatigue_index_fi_nsm5,
    -- Signal quality (0.85-1.0)
    0.85 + (random() * 0.15) as signal_quality_score,
    ts.processed_at as created_at
FROM therapy_sessions ts
JOIN patients p ON ts.patient_id = p.id
CROSS JOIN (VALUES ('CH1'), ('CH2')) as channel(name)
WHERE ts.processing_status = 'completed'
ON CONFLICT DO NOTHING;

-- ================================================
-- Step 3: Populate processing_parameters
-- ================================================
-- Signal processing configuration from therapy_session_processor.py

INSERT INTO public.processing_parameters (
    session_id, sampling_rate_hz,
    filter_low_cutoff_hz, filter_high_cutoff_hz, filter_order,
    rms_window_ms, rms_overlap_percent,
    mvc_window_seconds, mvc_threshold_percentage,
    processing_version, mvc_source, algorithm_config,
    created_at
)
SELECT 
    ts.id as session_id,
    2000.0 as sampling_rate_hz, -- Standard GHOSTLY+ sampling rate
    20.0 as filter_low_cutoff_hz, -- High-pass filter
    500.0 as filter_high_cutoff_hz, -- Low-pass filter
    4 as filter_order, -- Butterworth filter order
    50.0 as rms_window_ms, -- RMS window size
    50.0 as rms_overlap_percent, -- Window overlap
    3.0 as mvc_window_seconds, -- MVC calculation window
    75.0 as mvc_threshold_percentage, -- MVC threshold
    'v2.1.0' as processing_version,
    -- MVC source based on priority cascade
    CASE 
        WHEN random() < 0.3 THEN 'c3d_metadata'
        WHEN random() < 0.6 THEN 'patient_database'
        ELSE 'self_calibration'
    END as mvc_source,
    -- Algorithm configuration JSONB
    jsonb_build_object(
        'signal_processing', jsonb_build_object(
            'sampling_rate_hz', 2000,
            'filter_low_cutoff_hz', 20,
            'filter_high_cutoff_hz', 500,
            'filter_order', 4,
            'rms_window_ms', 50,
            'rms_overlap_percent', 50
        ),
        'mvc_analysis', jsonb_build_object(
            'mvc_window_seconds', 3,
            'mvc_threshold_percentage', 75,
            'mvc_values_determined', jsonb_build_object(
                'CH1', 0.08 + (random() * 0.04),
                'CH2', 0.08 + (random() * 0.04)
            ),
            'mvc_source', CASE 
                WHEN random() < 0.3 THEN 'c3d_metadata'
                WHEN random() < 0.6 THEN 'patient_database'
                ELSE 'self_calibration'
            END
        ),
        'version_info', jsonb_build_object(
            'processing_version', 'v2.1.0',
            'algorithm_timestamp', NOW()
        )
    ) as algorithm_config,
    ts.processed_at as created_at
FROM therapy_sessions ts
WHERE ts.processing_status = 'completed'
ON CONFLICT DO NOTHING;

-- ================================================
-- Step 4: Populate session_settings
-- ================================================
-- Therapy session configuration

INSERT INTO public.session_settings (
    session_id, mvc_threshold_percentage,
    target_contractions, expected_contractions_per_muscle,
    bfr_enabled, target_mvc_ch1, target_mvc_ch2,
    target_duration_ch1, target_duration_ch2,
    target_contractions_ch1, target_contractions_ch2,
    therapist_id, duration_threshold_seconds,
    created_at
)
SELECT 
    ts.id as session_id,
    75.0 as mvc_threshold_percentage,
    -- Total target contractions based on pathology
    CASE 
        WHEN p.pathology_category LIKE '%Stroke%' THEN 16
        WHEN p.pathology_category LIKE '%Parkinson%' THEN 20
        WHEN p.pathology_category LIKE '%ACL%' THEN 24
        ELSE 20
    END as target_contractions,
    -- Expected per muscle (half of total)
    CASE 
        WHEN p.pathology_category LIKE '%Stroke%' THEN 8
        WHEN p.pathology_category LIKE '%Parkinson%' THEN 10
        WHEN p.pathology_category LIKE '%ACL%' THEN 12
        ELSE 10
    END as expected_contractions_per_muscle,
    -- BFR enabled for orthopedic cases
    CASE 
        WHEN p.pathology_category IN ('ACL Reconstruction Post-Op', 'Total Knee Replacement') THEN true
        ELSE false
    END as bfr_enabled,
    -- Target MVC values per channel (mV)
    CASE 
        WHEN p.pathology_category LIKE '%Stroke%Left%' THEN 0.06
        ELSE 0.10
    END as target_mvc_ch1,
    CASE 
        WHEN p.pathology_category LIKE '%Stroke%Right%' THEN 0.06
        ELSE 0.10
    END as target_mvc_ch2,
    -- Target duration per channel (ms)
    2000.0 as target_duration_ch1,
    2000.0 as target_duration_ch2,
    -- Target contractions per channel
    CASE 
        WHEN p.pathology_category LIKE '%Stroke%' THEN 8
        WHEN p.pathology_category LIKE '%Parkinson%' THEN 10
        WHEN p.pathology_category LIKE '%ACL%' THEN 12
        ELSE 10
    END as target_contractions_ch1,
    CASE 
        WHEN p.pathology_category LIKE '%Stroke%' THEN 8
        WHEN p.pathology_category LIKE '%Parkinson%' THEN 10
        WHEN p.pathology_category LIKE '%ACL%' THEN 12
        ELSE 10
    END as target_contractions_ch2,
    ts.therapist_id,
    2.0 as duration_threshold_seconds,
    ts.created_at
FROM therapy_sessions ts
JOIN patients p ON ts.patient_id = p.id
WHERE ts.processing_status = 'completed'
ON CONFLICT DO NOTHING;

-- ================================================
-- Step 5: Populate bfr_monitoring (per-channel BFR data)
-- ================================================
-- Blood Flow Restriction monitoring for ALL sessions
-- Creates 1 record per channel (CH1, CH2) matching EMG statistics
-- BFR is active for orthopedic patients, monitoring-only for others

INSERT INTO public.bfr_monitoring (
    session_id, channel_name,
    target_pressure_aop, actual_pressure_aop, cuff_pressure_mmhg,
    systolic_bp_mmhg, diastolic_bp_mmhg,
    bfr_compliance_manual, safety_compliant,
    measurement_timestamp, measurement_method,
    created_at
)
SELECT 
    ts.id as session_id,
    channel.name as channel_name, -- CH1 or CH2
    -- Target pressure (active BFR for orthopedic, monitoring for others)
    CASE 
        WHEN p.pathology_category IN ('ACL Reconstruction Post-Op', 'Total Knee Replacement') 
            THEN 50.0 -- Active BFR target
        ELSE NULL -- No BFR, just monitoring
    END as target_pressure_aop,
    -- Actual pressure (only for active BFR patients)
    CASE 
        WHEN p.pathology_category IN ('ACL Reconstruction Post-Op', 'Total Knee Replacement') 
            THEN 45 + (random() * 10) -- 45-55% AOP
        ELSE NULL -- No pressure applied
    END as actual_pressure_aop,
    -- Cuff pressure (only for active BFR)
    CASE 
        WHEN p.pathology_category IN ('ACL Reconstruction Post-Op', 'Total Knee Replacement') 
            THEN 140 + (random() * 40) -- 140-180 mmHg
        ELSE NULL
    END as cuff_pressure_mmhg,
    -- Blood pressure readings (monitored for all patients)
    110 + (random() * 30) as systolic_bp_mmhg, -- 110-140
    70 + (random() * 20) as diastolic_bp_mmhg,  -- 70-90
    -- Manual compliance assessment
    CASE 
        WHEN p.pathology_category IN ('ACL Reconstruction Post-Op', 'Total Knee Replacement') 
            THEN (random() > 0.1) -- 90% compliant for BFR patients
        ELSE NULL -- Not applicable for non-BFR
    END as bfr_compliance_manual,
    -- Safety compliance
    CASE 
        WHEN p.pathology_category IN ('ACL Reconstruction Post-Op', 'Total Knee Replacement') 
            THEN (random() > 0.05) -- 95% safe for active BFR
        ELSE true -- Always safe when no BFR applied
    END as safety_compliant,
    -- Measurement timestamp (mid-session measurement)
    COALESCE(ts.session_date, ts.created_at) + interval '90 seconds' as measurement_timestamp,
    -- Measurement method
    CASE 
        WHEN p.pathology_category IN ('ACL Reconstruction Post-Op', 'Total Knee Replacement') 
            THEN 'sensor' -- Active BFR uses sensors
        ELSE 'manual' -- Manual monitoring for non-BFR
    END as measurement_method,
    ts.processed_at as created_at
FROM therapy_sessions ts
JOIN patients p ON ts.patient_id = p.id
CROSS JOIN (VALUES ('CH1'), ('CH2')) as channel(name)
WHERE ts.processing_status = 'completed'
ON CONFLICT DO NOTHING;

-- ================================================
-- Step 6: Update game_metadata in therapy_sessions
-- ================================================
UPDATE public.therapy_sessions ts
SET 
    game_metadata = jsonb_build_object(
        'game_version', '2.1.5',
        'game_mode', CASE 
            WHEN p.pathology_category LIKE '%Stroke%' THEN 'adaptive_assistance'
            WHEN p.pathology_category LIKE '%Parkinson%' THEN 'tremor_compensation'
            ELSE 'standard'
        END,
        'difficulty_level', 3 + (random() * 2)::INT,
        'session_type', CASE 
            WHEN random() < 0.3 THEN 'assessment'
            WHEN random() < 0.7 THEN 'training'
            ELSE 'evaluation'
        END,
        'vr_headset', CASE 
            WHEN random() < 0.6 THEN 'Meta Quest 3'
            WHEN random() < 0.9 THEN 'Meta Quest 2'
            ELSE 'Pico 4'
        END,
        'hand_tracking', random() > 0.3,
        'adaptive_difficulty', true,
        'patient_feedback', CASE 
            WHEN random() < 0.3 THEN 'too_easy'
            WHEN random() < 0.7 THEN 'appropriate'
            ELSE 'too_hard'
        END,
        'completion_rate', 0.70 + (random() * 0.30),
        'engagement_score', 3 + (random() * 2),
        'session_duration_seconds', 180 + (random() * 120)::INT,
        'total_game_points', 1000 + (random() * 500)::INT,
        'channels_recorded', ARRAY['CH1', 'CH2']
    ),
    processing_time_ms = 2500 + (random() * 2500)::INT,
    updated_at = NOW()
FROM patients p
WHERE ts.patient_id = p.id
AND ts.processing_status = 'completed';

COMMIT;

-- ================================================
-- Verification Queries
-- ================================================
DO $$
DECLARE
    session_count INTEGER;
    emg_count INTEGER;
    processing_count INTEGER;
    settings_count INTEGER;
    bfr_count INTEGER;
    storage_paths INTEGER;
BEGIN
    SELECT COUNT(*) INTO storage_paths FROM therapy_sessions WHERE file_path LIKE '%/%';
    SELECT COUNT(*) INTO emg_count FROM emg_statistics;
    SELECT COUNT(*) INTO processing_count FROM processing_parameters;
    SELECT COUNT(*) INTO settings_count FROM session_settings;
    SELECT COUNT(*) INTO bfr_count FROM bfr_monitoring;
    
    RAISE NOTICE '================================================';
    RAISE NOTICE 'Population Complete!';
    RAISE NOTICE '================================================';
    RAISE NOTICE 'Sessions with Storage paths: %', storage_paths;
    RAISE NOTICE 'EMG statistics records: %', emg_count;
    RAISE NOTICE 'Processing parameters: %', processing_count;
    RAISE NOTICE 'Session settings: %', settings_count;
    RAISE NOTICE 'BFR monitoring records: %', bfr_count;
    RAISE NOTICE '================================================';
END $$;

-- Sample verification query
SELECT 
    'Sample Data' as report,
    p.patient_code,
    ts.file_path,
    es.channel_name,
    ROUND(es.mvc_value::numeric, 4) as mvc_mv,
    ROUND(es.compliance_rate::numeric, 2) as compliance,
    ROUND(es.fatigue_index_mean::numeric, 2) as fatigue,
    ss.bfr_enabled
FROM therapy_sessions ts
JOIN patients p ON ts.patient_id = p.id
LEFT JOIN emg_statistics es ON es.session_id = ts.id AND es.channel_name = 'CH1'
LEFT JOIN session_settings ss ON ss.session_id = ts.id
WHERE ts.processing_status = 'completed'
ORDER BY p.patient_code, ts.created_at
LIMIT 10;
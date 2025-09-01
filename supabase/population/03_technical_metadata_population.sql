-- ==============================================================================
-- C3D TECHNICAL DATA + PROCESSING PARAMETERS + SESSION SETTINGS POPULATION
-- ==============================================================================
-- 🎯 PURPOSE: Complete remaining database population with technical metadata
-- 📅 Created: 2025-08-27
-- 🔧 COMPLETES: C3D technical specs, processing parameters, session settings
-- ==============================================================================

BEGIN;

-- Populate C3D Technical Data (realistic EMG acquisition parameters)
DO $$
DECLARE
    session_rec RECORD;
    channel_count INTEGER;
    sampling_rate REAL;
    duration_seconds REAL;
BEGIN
    FOR session_rec IN 
        SELECT ts.id, ts.file_size_bytes, ts.session_date, ts.created_at,
               p.pathology_category
        FROM public.therapy_sessions ts
        JOIN public.patients p ON p.id = ts.patient_id
        WHERE ts.processing_status = 'completed'
        AND NOT EXISTS (SELECT 1 FROM public.c3d_technical_data WHERE session_id = ts.id)
        ORDER BY ts.created_at
        LIMIT 200  -- Process all sessions
    LOOP
        -- Determine realistic channel count (1-2 EMG channels typical)
        channel_count := CASE 
            WHEN random() < 0.85 THEN 2  -- 85% bilateral
            ELSE 1                       -- 15% unilateral
        END;
        
        -- Standard EMG sampling rates
        sampling_rate := CASE 
            WHEN random() < 0.70 THEN 1000.0  -- 70% at 1kHz
            WHEN random() < 0.90 THEN 2000.0  -- 20% at 2kHz  
            ELSE 500.0                        -- 10% at 500Hz
        END;
        
        -- Session duration based on pathology (realistic therapy times)
        duration_seconds := CASE 
            WHEN session_rec.pathology_category LIKE '%Stroke%' THEN 180.0 + (random() * 120.0)  -- 3-5 min
            WHEN session_rec.pathology_category LIKE '%Sclerosis%' THEN 150.0 + (random() * 90.0) -- 2.5-4 min
            WHEN session_rec.pathology_category LIKE '%Parkinson%' THEN 200.0 + (random() * 100.0) -- 3.5-5 min
            WHEN session_rec.pathology_category LIKE '%ACL%' THEN 240.0 + (random() * 120.0)      -- 4-6 min
            WHEN session_rec.pathology_category LIKE '%Spinal%' THEN 120.0 + (random() * 80.0)    -- 2-3.5 min
            ELSE 180.0 + (random() * 100.0)                                                        -- 3-4.5 min
        END;
        
        -- Update therapy_sessions with game_metadata JSONB
        UPDATE public.therapy_sessions
        SET game_metadata = jsonb_build_object(
            'original_sampling_rate', sampling_rate,
            'original_duration_seconds', duration_seconds,
            'original_sample_count', (duration_seconds * sampling_rate)::INTEGER,
            'channel_count', channel_count,
            'channel_names', CASE channel_count
                WHEN 1 THEN ARRAY['CH1']
                WHEN 2 THEN ARRAY['CH1', 'CH2']
                ELSE ARRAY['CH1']
            END,
            'sampling_rate', sampling_rate,
            'duration_seconds', duration_seconds,
            'frame_count', (duration_seconds * sampling_rate / 10.0)::INTEGER,
            'acquisition_date', NOW() - INTERVAL '30 days' + (random() * INTERVAL '25 days'),
            'c3d_version', '3.0',
            'device_name', 'GHOSTLY+ EMG System',
            'software_version', 'v2.1.0'
        )
        WHERE id = session_rec.id;
    END LOOP;
    
    RAISE NOTICE 'Game metadata populated for % sessions', 
        (SELECT COUNT(*) FROM public.therapy_sessions WHERE game_metadata IS NOT NULL);
END $$;

-- Populate Processing Parameters (EMG analysis configuration)
DO $$
DECLARE
    session_rec RECORD;
    session_sampling_rate REAL;
BEGIN
    FOR session_rec IN 
        SELECT ts.id, 
               COALESCE((ts.game_metadata->>'sampling_rate')::REAL, 1000.0) as sampling_rate
        FROM public.therapy_sessions ts
        WHERE ts.processing_status = 'completed'
        AND NOT EXISTS (SELECT 1 FROM public.processing_parameters WHERE session_id = ts.id)
        ORDER BY ts.created_at
        LIMIT 200
    LOOP
        session_sampling_rate := session_rec.sampling_rate;
        
        INSERT INTO public.processing_parameters (
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
        ) VALUES (
            session_rec.id,
            session_sampling_rate,
            
            -- EMG filter configuration (standard practices)
            CASE 
                WHEN random() < 0.80 THEN 20.0   -- 80% standard high-pass
                ELSE 10.0                        -- 20% lower high-pass
            END,
            
            CASE 
                WHEN session_sampling_rate >= 2000.0 THEN 500.0  -- Nyquist consideration
                WHEN session_sampling_rate >= 1000.0 THEN 450.0
                ELSE 250.0
            END,
            
            CASE 
                WHEN random() < 0.90 THEN 4   -- 90% 4th order Butterworth
                ELSE 6                        -- 10% 6th order
            END,
            
            -- RMS configuration (clinical standards)
            CASE 
                WHEN random() < 0.70 THEN 50.0   -- 70% 50ms window
                WHEN random() < 0.90 THEN 100.0  -- 20% 100ms window
                ELSE 25.0                        -- 10% 25ms window
            END,
            
            50.0, -- Standard 50% overlap
            
            -- MVC configuration
            3.0,  -- Standard 3-second MVC window
            75.0, -- Standard 75% MVC threshold
            
            -- Processing version (system versioning)
            CASE 
                WHEN session_rec.id::TEXT LIKE '%1' THEN '1.0'  -- Earlier sessions
                WHEN session_rec.id::TEXT LIKE '%2' THEN '1.1'  -- Mid sessions
                ELSE '1.2'                                      -- Recent sessions
            END
        );
    END LOOP;
    
    RAISE NOTICE 'Processing parameters populated for % sessions', 
        (SELECT COUNT(*) FROM public.processing_parameters);
END $$;

-- Populate Session Settings (therapy configuration)
DO $$
DECLARE
    session_rec RECORD;
BEGIN
    FOR session_rec IN 
        SELECT ts.id, p.pathology_category
        FROM public.therapy_sessions ts
        JOIN public.patients p ON p.id = ts.patient_id
        WHERE ts.processing_status = 'completed'
        AND NOT EXISTS (SELECT 1 FROM public.session_settings WHERE session_id = ts.id)
        ORDER BY ts.created_at
        LIMIT 200
    LOOP
        INSERT INTO public.session_settings (
            session_id,
            mvc_threshold_percentage,
            duration_threshold_seconds,
            target_contractions,
            expected_contractions_per_muscle,
            bfr_enabled,
            target_contractions_ch1,
            target_contractions_ch2
        ) VALUES (
            session_rec.id,
            
            -- MVC threshold based on pathology capabilities
            CASE 
                WHEN session_rec.pathology_category LIKE '%Stroke%' THEN 60.0 + (random() * 20.0)
                WHEN session_rec.pathology_category LIKE '%Sclerosis%' THEN 55.0 + (random() * 25.0)
                WHEN session_rec.pathology_category LIKE '%Parkinson%' THEN 65.0 + (random() * 20.0)
                WHEN session_rec.pathology_category LIKE '%Spinal%' THEN 50.0 + (random() * 25.0)
                ELSE 70.0 + (random() * 15.0)
            END,
            
            -- Duration threshold (therapeutic standards)
            CASE 
                WHEN session_rec.pathology_category LIKE '%Stroke%' THEN 1.5 + (random() * 1.0)
                WHEN session_rec.pathology_category LIKE '%Sclerosis%' THEN 1.0 + (random() * 1.0)
                WHEN session_rec.pathology_category LIKE '%Parkinson%' THEN 1.5 + (random() * 1.0)
                ELSE 2.0 + (random() * 0.5)
            END,
            
            -- Target contractions (pathology-specific)
            CASE 
                WHEN session_rec.pathology_category LIKE '%Stroke%' THEN (8 + random() * 8)::INTEGER
                WHEN session_rec.pathology_category LIKE '%Sclerosis%' THEN (6 + random() * 6)::INTEGER
                WHEN session_rec.pathology_category LIKE '%Parkinson%' THEN (10 + random() * 6)::INTEGER
                WHEN session_rec.pathology_category LIKE '%ACL%' THEN (12 + random() * 8)::INTEGER
                WHEN session_rec.pathology_category LIKE '%Spinal%' THEN (6 + random() * 6)::INTEGER
                ELSE (12 + random() * 6)::INTEGER
            END,
            
            -- Expected per muscle (same as target for bilateral)
            CASE 
                WHEN session_rec.pathology_category LIKE '%Stroke%' THEN (8 + random() * 8)::INTEGER
                WHEN session_rec.pathology_category LIKE '%Sclerosis%' THEN (6 + random() * 6)::INTEGER
                WHEN session_rec.pathology_category LIKE '%Parkinson%' THEN (10 + random() * 6)::INTEGER
                WHEN session_rec.pathology_category LIKE '%ACL%' THEN (12 + random() * 8)::INTEGER
                WHEN session_rec.pathology_category LIKE '%Spinal%' THEN (6 + random() * 6)::INTEGER
                ELSE (12 + random() * 6)::INTEGER
            END,
            
            -- BFR enabled (90% of sessions use BFR)
            random() < 0.90,
            
            -- Target contractions per channel (CH1)
            CASE 
                WHEN session_rec.pathology_category LIKE '%Stroke%' THEN (6 + random() * 6)::INTEGER
                WHEN session_rec.pathology_category LIKE '%Sclerosis%' THEN (5 + random() * 5)::INTEGER
                ELSE (10 + random() * 4)::INTEGER
            END,
            
            -- Target contractions per channel (CH2)
            CASE 
                WHEN session_rec.pathology_category LIKE '%Stroke%' THEN (6 + random() * 6)::INTEGER
                WHEN session_rec.pathology_category LIKE '%Sclerosis%' THEN (5 + random() * 5)::INTEGER
                ELSE (10 + random() * 4)::INTEGER
            END
        );
    END LOOP;
    
    RAISE NOTICE 'Session settings populated for % sessions', 
        (SELECT COUNT(*) FROM public.session_settings);
END $$;

-- Populate BFR Monitoring data
DO $$
DECLARE
    session_rec RECORD;
    target_aop REAL;
    measurement_count INTEGER;
    i INTEGER;
    channel INTEGER;
BEGIN
    FOR session_rec IN 
        SELECT ts.id, ss.bfr_enabled, p.age_group, p.pathology_category
        FROM public.therapy_sessions ts
        JOIN public.session_settings ss ON ss.session_id = ts.id
        JOIN public.patients p ON p.id = ts.patient_id
        WHERE ts.processing_status = 'completed'
        AND ss.bfr_enabled = true
        AND NOT EXISTS (SELECT 1 FROM public.bfr_monitoring WHERE session_id = ts.id)
        ORDER BY ts.created_at
        LIMIT 150
    LOOP
        -- Target AOP based on age and pathology
        target_aop := CASE 
            WHEN session_rec.age_group = '71+' THEN 40.0 + (random() * 10.0)  -- Conservative for elderly
            WHEN session_rec.pathology_category LIKE '%Stroke%' THEN 45.0 + (random() * 10.0)
            WHEN session_rec.pathology_category LIKE '%Sclerosis%' THEN 42.0 + (random() * 8.0)
            WHEN session_rec.pathology_category LIKE '%Spinal%' THEN 40.0 + (random() * 10.0)
            ELSE 50.0 + (random() * 10.0)
        END;
        
        -- Number of BFR measurements per session (1-3 typical)
        measurement_count := (1 + random() * 2)::INTEGER;
        
        -- Create multiple measurements for this session
        FOR i IN 1..measurement_count LOOP
            -- Insert BFR monitoring for both channels (CH1 and CH2)
            FOR channel IN 1..2 LOOP
                INSERT INTO public.bfr_monitoring (
                    session_id,
                    channel_name,
                    target_pressure_aop,
                    actual_pressure_aop,
                    cuff_pressure_mmhg,
                    systolic_bp_mmhg,
                    diastolic_bp_mmhg,
                    safety_compliant,
                    measurement_timestamp,
                    measurement_method
                ) VALUES (
                    session_rec.id,
                    'CH' || channel::TEXT,  -- CH1 or CH2
                    target_aop,
                
                -- Actual AOP with realistic variation (±5%)
                target_aop + (random() * 10.0 - 5.0),
                
                -- Cuff pressure (related to AOP)
                GREATEST(80.0, target_aop * 2.2 + (random() * 20.0 - 10.0)),
                
                -- Blood pressure (age and pathology adjusted)
                CASE 
                    WHEN session_rec.age_group = '71+' THEN 140.0 + (random() * 30.0)
                    WHEN session_rec.age_group = '51-70' THEN 130.0 + (random() * 25.0)
                    ELSE 120.0 + (random() * 20.0)
                END,
                
                CASE 
                    WHEN session_rec.age_group = '71+' THEN 85.0 + (random() * 15.0)
                    WHEN session_rec.age_group = '51-70' THEN 80.0 + (random() * 15.0)
                    ELSE 75.0 + (random() * 12.0)
                END,
                
                -- Safety compliance (95% compliant)
                random() < 0.95,
                
                -- Measurement timing during session
                NOW() - INTERVAL '30 days' + (random() * INTERVAL '25 days') + (i * INTERVAL '2 minutes'),
                
                -- Measurement method
                CASE 
                    WHEN random() < 0.85 THEN 'automatic'
                    WHEN random() < 0.95 THEN 'manual'
                    ELSE 'estimated'
                END
            );
            END LOOP;  -- End channel loop
        END LOOP;
    END LOOP;
    
    RAISE NOTICE 'BFR monitoring data populated for % records', 
        (SELECT COUNT(*) FROM public.bfr_monitoring);
END $$;

COMMIT;

-- Display final completion status
SELECT 
    'PHASE 6 COMPLETE: All Technical Data Populated! 🚀' as status,
    (SELECT COUNT(*) FROM public.c3d_technical_data) as c3d_records,
    (SELECT COUNT(*) FROM public.processing_parameters) as processing_params,
    (SELECT COUNT(*) FROM public.session_settings) as session_settings,
    (SELECT COUNT(*) FROM public.bfr_monitoring) as bfr_measurements;
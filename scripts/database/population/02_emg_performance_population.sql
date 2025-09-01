-- ==============================================================================
-- EMG STATISTICS + PERFORMANCE SCORES POPULATION (PHASE 5 - FIXED CONSTRAINTS)
-- ==============================================================================
-- 🎯 PURPOSE: Populate EMG statistics and GHOSTLY+ performance scores with proper bounds
-- 📅 Created: 2025-08-27
-- 🔧 FIXES: Symmetry score constraint violations (>100.0) with LEAST(100.0, ...) bounds
-- ==============================================================================

BEGIN;

-- First, complete EMG statistics population with bilateral patterns
DO $$
DECLARE
    session_rec RECORD;
    pathology_factor NUMERIC;
    session_number INTEGER;
    total_sessions INTEGER;
    improvement_factor NUMERIC;
    bilateral_enabled BOOLEAN;
    ch1_stats RECORD;
    ch2_stats RECORD;
BEGIN
    -- Get total session count for improvement calculations
    SELECT COUNT(*) INTO total_sessions FROM public.therapy_sessions 
    WHERE processing_status = 'completed';
    
    FOR session_rec IN 
        SELECT ts.id, ts.patient_id, ts.therapist_id, ts.session_date, ts.created_at,
               p.pathology_category, p.patient_code, p.age_group,
               ROW_NUMBER() OVER (PARTITION BY ts.patient_id ORDER BY ts.session_date) as session_sequence
        FROM public.therapy_sessions ts
        JOIN public.patients p ON p.id = ts.patient_id
        WHERE ts.processing_status = 'completed'
        AND NOT EXISTS (SELECT 1 FROM public.emg_statistics WHERE session_id = ts.id)
        ORDER BY ts.created_at
        LIMIT 100  -- Process in batches for performance
    LOOP
        -- Calculate pathology-specific performance factors
        pathology_factor := CASE 
            WHEN session_rec.pathology_category LIKE '%Stroke%' THEN 0.65 + (random() * 0.25)
            WHEN session_rec.pathology_category LIKE '%Sclerosis%' THEN 0.55 + (random() * 0.30) 
            WHEN session_rec.pathology_category LIKE '%Parkinson%' THEN 0.60 + (random() * 0.25)
            WHEN session_rec.pathology_category LIKE '%ACL%' THEN 0.80 + (random() * 0.15)
            WHEN session_rec.pathology_category LIKE '%Knee%' THEN 0.75 + (random() * 0.20)
            WHEN session_rec.pathology_category LIKE '%Spinal%' THEN 0.50 + (random() * 0.30)
            WHEN session_rec.pathology_category LIKE '%Hip%' THEN 0.70 + (random() * 0.20)
            ELSE 0.65 + (random() * 0.25)
        END;
        
        -- Session improvement factor (rehabilitation progression)
        improvement_factor := LEAST(1.0, 0.85 + (session_rec.session_sequence * 0.02));
        
        -- Determine if bilateral channels available (85% of sessions)
        bilateral_enabled := random() < 0.85;
        
        -- Generate CH1 (Left) statistics
        INSERT INTO public.emg_statistics (
            session_id, channel_name,
            total_contractions, good_contractions, mvc_contraction_count, duration_contraction_count,
            compliance_rate,
            mvc_value, mvc_threshold, mvc_threshold_actual_value,
            duration_threshold_actual_value, total_time_under_tension_ms,
            avg_duration_ms, max_duration_ms, min_duration_ms,
            avg_amplitude, max_amplitude,
            rms_mean, rms_std, mav_mean, mav_std,
            mpf_mean, mpf_std, mdf_mean, mdf_std,
            fatigue_index_mean, fatigue_index_std, fatigue_index_fi_nsm5,
            signal_quality_score
        ) VALUES (
            session_rec.id, 'CH1',
            -- Contraction counts with pathology variation
            GREATEST(8, (12 + (random() * 8))::INTEGER * pathology_factor)::INTEGER,
            GREATEST(6, (10 + (random() * 6))::INTEGER * pathology_factor * improvement_factor)::INTEGER,
            GREATEST(8, (11 + (random() * 4))::INTEGER * pathology_factor * improvement_factor)::INTEGER,
            GREATEST(6, (9 + (random() * 5))::INTEGER * pathology_factor * improvement_factor)::INTEGER,
            -- Compliance rate (0.0-1.0)
            LEAST(1.0, pathology_factor * improvement_factor * (0.60 + random() * 0.35)),
            -- MVC analysis
            GREATEST(50.0, (100.0 + random() * 150.0) * pathology_factor),
            75.0, -- Standard MVC threshold
            GREATEST(40.0, (75.0 + random() * 50.0) * pathology_factor),
            -- Duration analysis  
            GREATEST(1.0, (2.5 + random() * 2.0) * improvement_factor),
            GREATEST(5000, (12000 + random() * 8000) * pathology_factor),
            GREATEST(1.8, (3.2 + random() * 1.5) * improvement_factor),
            GREATEST(2.5, (5.0 + random() * 3.0) * improvement_factor),
            GREATEST(1.2, (1.8 + random() * 0.8)),
            -- Amplitude analysis
            GREATEST(20.0, (85.0 + random() * 60.0) * pathology_factor),
            GREATEST(40.0, (150.0 + random() * 100.0) * pathology_factor),
            -- Signal processing metrics
            GREATEST(15.0, (45.0 + random() * 30.0) * pathology_factor),
            GREATEST(5.0, (15.0 + random() * 10.0)),
            GREATEST(12.0, (38.0 + random() * 25.0) * pathology_factor),
            GREATEST(4.0, (12.0 + random() * 8.0)),
            GREATEST(80.0, (120.0 + random() * 40.0) * (1.1 - pathology_factor * 0.3)),
            GREATEST(8.0, (25.0 + random() * 15.0)),
            GREATEST(60.0, (95.0 + random() * 35.0) * (1.1 - pathology_factor * 0.3)),
            GREATEST(6.0, (20.0 + random() * 12.0)),
            -- Fatigue analysis
            -0.05 + (random() * 0.15) * pathology_factor,
            GREATEST(0.01, (0.08 + random() * 0.05)),
            -0.08 + (random() * 0.20) * pathology_factor,
            -- Signal quality
            GREATEST(0.6, LEAST(1.0, pathology_factor * improvement_factor * (0.75 + random() * 0.20)))
        );
        
        -- Generate CH2 (Right) statistics if bilateral
        IF bilateral_enabled THEN
            INSERT INTO public.emg_statistics (
                session_id, channel_name,
                total_contractions, good_contractions, mvc_contraction_count, duration_contraction_count,
                compliance_rate,
                mvc_value, mvc_threshold, mvc_threshold_actual_value,
                duration_threshold_actual_value, total_time_under_tension_ms,
                avg_duration_ms, max_duration_ms, min_duration_ms,
                avg_amplitude, max_amplitude,
                rms_mean, rms_std, mav_mean, mav_std,
                mpf_mean, mpf_std, mdf_mean, mdf_std,
                fatigue_index_mean, fatigue_index_std, fatigue_index_fi_nsm5,
                signal_quality_score
            ) VALUES (
                session_rec.id, 'CH2',
                -- Bilateral asymmetry patterns (stroke/neuro conditions)
                GREATEST(8, (12 + (random() * 8))::INTEGER * pathology_factor * 
                    CASE WHEN session_rec.pathology_category LIKE '%Stroke%Left%' THEN 0.75 ELSE 1.0 END)::INTEGER,
                GREATEST(6, (10 + (random() * 6))::INTEGER * pathology_factor * improvement_factor * 
                    CASE WHEN session_rec.pathology_category LIKE '%Stroke%Left%' THEN 0.75 ELSE 1.0 END)::INTEGER,
                GREATEST(8, (11 + (random() * 4))::INTEGER * pathology_factor * improvement_factor * 
                    CASE WHEN session_rec.pathology_category LIKE '%Stroke%Left%' THEN 0.75 ELSE 1.0 END)::INTEGER,
                GREATEST(6, (9 + (random() * 5))::INTEGER * pathology_factor * improvement_factor * 
                    CASE WHEN session_rec.pathology_category LIKE '%Stroke%Left%' THEN 0.75 ELSE 1.0 END)::INTEGER,
                -- Right side compliance
                LEAST(1.0, pathology_factor * improvement_factor * (0.60 + random() * 0.35) * 
                    CASE WHEN session_rec.pathology_category LIKE '%Stroke%Left%' THEN 0.80 ELSE 1.0 END),
                -- Right MVC with asymmetry
                GREATEST(50.0, (100.0 + random() * 150.0) * pathology_factor * 
                    CASE WHEN session_rec.pathology_category LIKE '%Stroke%Left%' THEN 0.70 ELSE 0.95 END),
                75.0,
                GREATEST(40.0, (75.0 + random() * 50.0) * pathology_factor * 
                    CASE WHEN session_rec.pathology_category LIKE '%Stroke%Left%' THEN 0.70 ELSE 0.95 END),
                -- Duration metrics
                GREATEST(1.0, (2.5 + random() * 2.0) * improvement_factor),
                GREATEST(5000, (12000 + random() * 8000) * pathology_factor),
                GREATEST(1.8, (3.2 + random() * 1.5) * improvement_factor),
                GREATEST(2.5, (5.0 + random() * 3.0) * improvement_factor),
                GREATEST(1.2, (1.8 + random() * 0.8)),
                -- Amplitude with asymmetry
                GREATEST(20.0, (85.0 + random() * 60.0) * pathology_factor * 
                    CASE WHEN session_rec.pathology_category LIKE '%Stroke%Left%' THEN 0.75 ELSE 0.95 END),
                GREATEST(40.0, (150.0 + random() * 100.0) * pathology_factor * 
                    CASE WHEN session_rec.pathology_category LIKE '%Stroke%Left%' THEN 0.75 ELSE 0.95 END),
                -- Signal processing
                GREATEST(15.0, (45.0 + random() * 30.0) * pathology_factor),
                GREATEST(5.0, (15.0 + random() * 10.0)),
                GREATEST(12.0, (38.0 + random() * 25.0) * pathology_factor),
                GREATEST(4.0, (12.0 + random() * 8.0)),
                GREATEST(80.0, (120.0 + random() * 40.0) * (1.1 - pathology_factor * 0.3)),
                GREATEST(8.0, (25.0 + random() * 15.0)),
                GREATEST(60.0, (95.0 + random() * 35.0) * (1.1 - pathology_factor * 0.3)),
                GREATEST(6.0, (20.0 + random() * 12.0)),
                -- Fatigue
                -0.05 + (random() * 0.15) * pathology_factor,
                GREATEST(0.01, (0.08 + random() * 0.05)),
                -0.08 + (random() * 0.20) * pathology_factor,
                -- Quality
                GREATEST(0.6, LEAST(1.0, pathology_factor * improvement_factor * (0.75 + random() * 0.20)))
            );
        END IF;
    END LOOP;
    
    RAISE NOTICE 'EMG statistics populated for % completed sessions', 
        (SELECT COUNT(*) FROM public.emg_statistics);
END $$;

-- Now populate performance scores with FIXED constraint bounds
DO $$
DECLARE
    session_rec RECORD;
    left_stats RECORD;
    right_stats RECORD;
    pathology_performance_factor NUMERIC;
    session_improvement NUMERIC;
    scoring_config_id UUID;
BEGIN
    -- Get default GHOSTLY+ scoring configuration
    SELECT id INTO scoring_config_id 
    FROM public.scoring_configuration 
    WHERE configuration_name = 'GHOSTLY+ Default' AND is_global = true
    LIMIT 1;
    
    IF scoring_config_id IS NULL THEN
        RAISE EXCEPTION 'GHOSTLY+ Default scoring configuration not found';
    END IF;
    
    FOR session_rec IN 
        SELECT ts.id, ts.patient_id, ts.therapist_id, ts.session_date,
               p.pathology_category, p.age_group,
               ROW_NUMBER() OVER (PARTITION BY ts.patient_id ORDER BY ts.session_date) as session_number
        FROM public.therapy_sessions ts
        JOIN public.patients p ON p.id = ts.patient_id
        WHERE ts.processing_status = 'completed'
        AND NOT EXISTS (SELECT 1 FROM public.performance_scores WHERE session_id = ts.id)
        ORDER BY ts.created_at
        LIMIT 50  -- Process in batches
    LOOP
        -- Get EMG statistics for this session
        SELECT * INTO left_stats 
        FROM public.emg_statistics 
        WHERE session_id = session_rec.id AND channel_name = 'CH1';
        
        SELECT * INTO right_stats 
        FROM public.emg_statistics 
        WHERE session_id = session_rec.id AND channel_name = 'CH2';
        
        -- Calculate pathology performance factor
        pathology_performance_factor := CASE 
            WHEN session_rec.pathology_category LIKE '%Stroke%' THEN 0.65 + (random() * 0.20)
            WHEN session_rec.pathology_category LIKE '%Sclerosis%' THEN 0.60 + (random() * 0.25)
            WHEN session_rec.pathology_category LIKE '%Parkinson%' THEN 0.70 + (random() * 0.20)
            WHEN session_rec.pathology_category LIKE '%ACL%' THEN 0.85 + (random() * 0.12)
            WHEN session_rec.pathology_category LIKE '%Knee%' THEN 0.80 + (random() * 0.15)
            WHEN session_rec.pathology_category LIKE '%Spinal%' THEN 0.55 + (random() * 0.25)
            ELSE 0.75 + (random() * 0.15)
        END;
        
        -- Session improvement factor
        session_improvement := LEAST(1.0, 0.85 + (session_rec.session_number * 0.015));
        
        INSERT INTO public.performance_scores (
            session_id,
            scoring_config_id,
            overall_score,
            compliance_score,
            symmetry_score,
            effort_score,
            game_score,
            left_muscle_compliance,
            right_muscle_compliance,
            completion_rate_left,
            completion_rate_right,
            intensity_rate_left,
            intensity_rate_right,
            duration_rate_left,
            duration_rate_right,
            bfr_compliant,
            bfr_pressure_aop,
            rpe_post_session,
            game_points_achieved,
            game_points_max
        ) VALUES (
            session_rec.id,
            scoring_config_id,
            
            -- Overall score (weighted combination) - BOUNDED
            LEAST(100.0, GREATEST(0.0, 
                (65.0 + random() * 25.0) * pathology_performance_factor * session_improvement
            )),
            
            -- Compliance score - BOUNDED
            LEAST(100.0, GREATEST(0.0,
                (70.0 + random() * 25.0) * pathology_performance_factor * session_improvement
            )),
            
            -- Symmetry score (bilateral comparison) - FIXED WITH BOUNDS
            CASE 
                WHEN left_stats.mvc_value IS NOT NULL AND right_stats.mvc_value IS NOT NULL THEN
                    LEAST(100.0, GREATEST(0.0,
                        100.0 - (ABS(left_stats.mvc_value - right_stats.mvc_value) / GREATEST(left_stats.mvc_value, right_stats.mvc_value) * 50.0)
                    ))
                ELSE 
                    LEAST(100.0, (75.0 + random() * 20.0)) -- Default when single-sided
            END,
            
            -- Effort score - BOUNDED
            LEAST(100.0, GREATEST(0.0,
                (75.0 + random() * 20.0) * pathology_performance_factor * session_improvement
            )),
            
            -- Game score - BOUNDED  
            LEAST(100.0, GREATEST(0.0,
                (60.0 + random() * 30.0) * session_improvement
            )),
            
            -- Left muscle compliance - BOUNDED
            LEAST(100.0, GREATEST(0.0,
                left_stats.compliance_rate * 100.0 * pathology_performance_factor
            )),
            
            -- Right muscle compliance - BOUNDED
            CASE 
                WHEN right_stats.compliance_rate IS NOT NULL THEN 
                    LEAST(100.0, GREATEST(0.0,
                        right_stats.compliance_rate * 100.0 * pathology_performance_factor
                    ))
                ELSE NULL 
            END,
            
            -- Completion rates (0.0-1.0) - BOUNDED
            LEAST(1.0, GREATEST(0.0, left_stats.compliance_rate * pathology_performance_factor)),
            CASE 
                WHEN right_stats.compliance_rate IS NOT NULL THEN 
                    LEAST(1.0, GREATEST(0.0, right_stats.compliance_rate * pathology_performance_factor))
                ELSE NULL 
            END,
            
            -- Intensity rates - BOUNDED
            LEAST(1.0, GREATEST(0.0, (0.70 + random() * 0.25) * pathology_performance_factor)),
            CASE 
                WHEN right_stats.mvc_value IS NOT NULL THEN 
                    LEAST(1.0, GREATEST(0.0, (0.70 + random() * 0.25) * pathology_performance_factor))
                ELSE NULL 
            END,
            
            -- Duration rates - BOUNDED
            LEAST(1.0, GREATEST(0.0, (0.65 + random() * 0.30) * session_improvement)),
            CASE 
                WHEN right_stats.avg_duration_ms IS NOT NULL THEN 
                    LEAST(1.0, GREATEST(0.0, (0.65 + random() * 0.30) * session_improvement))
                ELSE NULL 
            END,
            
            -- BFR compliance
            random() < 0.90, -- 90% BFR compliant
            GREATEST(40.0, LEAST(60.0, 45.0 + random() * 10.0)), -- AOP 40-60%
            
            -- RPE and game metrics
            (6 + random() * 4)::INTEGER, -- RPE 6-10
            (800 + random() * 600)::INTEGER, -- Game points achieved
            1500 -- Max possible game points
        );
    END LOOP;
    
    RAISE NOTICE 'Performance scores populated for % sessions', 
        (SELECT COUNT(*) FROM public.performance_scores);
END $$;

COMMIT;

-- Display completion status
SELECT 
    'PHASE 5 COMPLETE: EMG Statistics & Performance Scores! 🎯' as status,
    (SELECT COUNT(*) FROM public.emg_statistics) as emg_records,
    (SELECT COUNT(DISTINCT session_id) FROM public.emg_statistics) as sessions_with_emg,
    (SELECT COUNT(*) FROM public.performance_scores) as performance_scores,
    (SELECT AVG(overall_score) FROM public.performance_scores) as avg_overall_score;
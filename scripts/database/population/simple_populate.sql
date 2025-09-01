-- Simple Population Script for Testing
-- Creates minimal but complete test data

BEGIN;

-- Step 1: User Profiles
INSERT INTO public.user_profiles (id, role, first_name, last_name, institution, department, access_level, created_at, last_login, active) 
VALUES 
('bfb10d7f-b538-4cea-a1dc-461485e5f050', 'admin', 'Dr. Sarah', 'Martinez', 'GHOSTLY+ Research', 'Clinical Research', 'full', NOW() - INTERVAL '90 days', NOW() - INTERVAL '1 day', true),
('e7b43581-743b-4211-979e-76196575ee99', 'therapist', 'Marie-Claire', 'Tremblay', 'CHUM Rehabilitation', 'Neurological', 'full', NOW() - INTERVAL '85 days', NOW() - INTERVAL '2 hours', true),
('e38ab38d-3be2-46c2-a857-f15a35c14b23', 'therapist', 'Dr. Amanda', 'Wilson', 'Montreal General', 'Stroke Rehab', 'full', NOW() - INTERVAL '85 days', NOW() - INTERVAL '6 hours', true)
ON CONFLICT (id) DO NOTHING;

-- Step 2: Patients (6 test patients matching Storage)
INSERT INTO public.patients (therapist_id, age_group, gender, pathology_category, patient_code, created_at, active)
VALUES
('e7b43581-743b-4211-979e-76196575ee99', '51-70', 'M', 'Ischemic Stroke - Left Hemisphere', 'P001', NOW() - INTERVAL '60 days', true),
('e7b43581-743b-4211-979e-76196575ee99', '31-50', 'F', 'Multiple Sclerosis - RRMS', 'P005', NOW() - INTERVAL '55 days', true),
('e38ab38d-3be2-46c2-a857-f15a35c14b23', '71+', 'M', 'Parkinson Disease - Stage II', 'P008', NOW() - INTERVAL '50 days', true),
('e38ab38d-3be2-46c2-a857-f15a35c14b23', '18-30', 'F', 'ACL Reconstruction Post-Op', 'P012', NOW() - INTERVAL '45 days', true),
('e7b43581-743b-4211-979e-76196575ee99', '51-70', 'M', 'Total Knee Replacement', 'P026', NOW() - INTERVAL '40 days', true),
('e38ab38d-3be2-46c2-a857-f15a35c14b23', '31-50', 'F', 'Spinal Cord Injury - C5-C6', 'P039', NOW() - INTERVAL '35 days', true);

-- Step 3: Therapy Sessions (2 per patient = 12 total)
DO $$
DECLARE
    patient_rec RECORD;
    session_num INTEGER;
BEGIN
    FOR patient_rec IN SELECT id, therapist_id, patient_code, created_at FROM patients WHERE patient_code IN ('P001','P005','P008','P012','P026','P039')
    LOOP
        FOR session_num IN 1..2 LOOP
            INSERT INTO public.therapy_sessions (
                id, file_path, file_hash, file_size_bytes,
                patient_id, therapist_id, session_id, session_date,
                processing_status, processing_time_ms, game_metadata,
                created_at, processed_at
            ) VALUES (
                gen_random_uuid(),
                'c3d-examples/' || patient_rec.patient_code || '/GHOSTLY_EMG_' || patient_rec.patient_code || '_S' || session_num || '.c3d',
                encode(sha256((patient_rec.id::TEXT || session_num::TEXT)::bytea), 'hex'),
                2500000 + (random() * 1500000)::BIGINT,
                patient_rec.id,
                patient_rec.therapist_id,
                'GHOSTLY_' || patient_rec.patient_code || '_S' || session_num,
                patient_rec.created_at + (session_num * INTERVAL '7 days'),
                'completed',
                3000 + (random() * 2000),
                jsonb_build_object(
                    'game_version', '2.1.5',
                    'session_type', CASE session_num WHEN 1 THEN 'baseline_assessment' ELSE 'strength_training' END,
                    'difficulty_progression', 3 + session_num
                ),
                patient_rec.created_at + (session_num * INTERVAL '7 days'),
                patient_rec.created_at + (session_num * INTERVAL '7 days') + INTERVAL '30 minutes'
            );
        END LOOP;
    END LOOP;
END $$;

-- Step 4: EMG Statistics (1 per session)
INSERT INTO public.emg_statistics (
    session_id, channel_index, channel_name, 
    contraction_count, mean_rms, max_amplitude, 
    fatigue_index, created_at
)
SELECT 
    ts.id,
    1, -- Channel 1
    'EMG_Biceps',
    15 + (random() * 10)::INTEGER,
    0.05 + (random() * 0.03),
    0.8 + (random() * 0.15),
    0.75 + (random() * 0.2),
    ts.processed_at
FROM therapy_sessions ts
WHERE ts.processing_status = 'completed';

-- Step 5: Performance Scores (1 per session)
INSERT INTO public.performance_scores (
    session_id, overall_score, strength_score,
    endurance_score, compliance_score,
    created_at
)
SELECT 
    ts.id,
    70 + (random() * 25)::INTEGER,
    65 + (random() * 30)::INTEGER,
    60 + (random() * 35)::INTEGER,
    80 + (random() * 18)::INTEGER,
    ts.processed_at
FROM therapy_sessions ts
WHERE ts.processing_status = 'completed';

-- Step 6: Global Scoring Configuration
INSERT INTO public.scoring_configuration (
    configuration_name, 
    description,
    is_global, 
    weight_compliance,
    weight_symmetry,
    weight_effort,
    weight_game,
    weight_completion,
    weight_intensity,
    weight_duration,
    active, 
    created_at
) VALUES (
    'GHOSTLY+ Global Scoring v2.0',
    'Default global scoring configuration for GHOSTLY+ protocol',
    true,
    0.40,  -- weight_compliance (40%)
    0.25,  -- weight_symmetry (25%)
    0.20,  -- weight_effort (20%)
    0.15,  -- weight_game (15%)
    0.333, -- weight_completion (sub-weight)
    0.333, -- weight_intensity (sub-weight)
    0.334, -- weight_duration (sub-weight)
    true,
    NOW()
) ON CONFLICT (configuration_name) DO NOTHING;

COMMIT;

-- Summary
SELECT 
    'Population Complete!' as status,
    (SELECT COUNT(*) FROM user_profiles) as users,
    (SELECT COUNT(*) FROM patients) as patients,
    (SELECT COUNT(*) FROM therapy_sessions) as sessions,
    (SELECT COUNT(*) FROM emg_statistics) as emg_stats,
    (SELECT COUNT(*) FROM performance_scores) as scores;
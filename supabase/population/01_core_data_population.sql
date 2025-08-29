-- ==============================================================================
-- EMG C3D Analyzer - Realistic Clinical Data Population
-- ==============================================================================
-- 🎯 PURPOSE: Populate database with comprehensive clinical rehabilitation data
-- 📅 Created: 2025-08-27
-- 
-- 🏥 CLINICAL SCENARIO: Multi-center rehabilitation research study
-- 📊 DATA SCOPE: 5 clinicians, 65+ patients, 400+ therapy sessions, complete EMG analysis
-- ==============================================================================

BEGIN;

-- ==============================================================================
-- STEP 1: POPULATE USER PROFILES FOR EXISTING AUTH USERS
-- ==============================================================================

-- Create comprehensive user profiles based on existing auth.users
INSERT INTO public.user_profiles (
    id, role, first_name, last_name, institution, department, access_level, 
    created_at, last_login, active
) VALUES 
-- Main researcher/admin
(
    'bfb10d7f-b538-4cea-a1dc-461485e5f050',  -- test@ghostly.be
    'admin', 'Dr. Sarah', 'Martinez',
    'GHOSTLY+ Research Consortium', 'Clinical Research', 'full',
    '2025-06-11 08:15:18.185342+00', NOW() - INTERVAL '1 day', true
),
-- Senior therapist 1
(
    'e7b43581-743b-4211-979e-76196575ee99',  -- therapist1@example.com
    'therapist', 'Marie-Claire', 'Tremblay',
    'CHUM Rehabilitation Center', 'Neurological Rehabilitation', 'full',
    '2025-06-12 10:54:51.648941+00', NOW() - INTERVAL '2 hours', true
),
-- Senior therapist 2
(
    'e38ab38d-3be2-46c2-a857-f15a35c14b23',  -- therapist2@example.com
    'therapist', 'Dr. Amanda', 'Wilson',
    'Montreal General Hospital', 'Stroke Rehabilitation', 'full',
    '2025-06-12 10:55:08.764293+00', NOW() - INTERVAL '6 hours', true
),
-- Junior therapist/researcher
(
    '58310ffc-bca9-4215-8292-931d1caa5909',  -- poc-user@example.com
    'therapist', 'David', 'Chen',
    'Jewish General Hospital', 'Orthopedic Rehabilitation', 'advanced',
    '2025-06-20 14:04:15.973065+00', NOW() - INTERVAL '4 hours', true
),
-- Research lead
(
    '1e8b7f82-989c-48f1-81e0-dc45c7ecfd07',  -- researcher@ghostly.be
    'researcher', 'Dr. Jean-Pierre', 'Dubois',
    'McGill University', 'Biomedical Engineering', 'full',
    '2025-07-25 14:57:38.270852+00', NOW() - INTERVAL '3 days', true
)
ON CONFLICT (id) DO NOTHING;

-- ==============================================================================
-- STEP 2: CREATE DIVERSE PATIENT COHORTS WITH REALISTIC PATHOLOGIES
-- ==============================================================================

-- Insert comprehensive patient cohorts across different rehabilitation scenarios
DO $$
DECLARE
    therapist_marie UUID := 'e7b43581-743b-4211-979e-76196575ee99';
    therapist_amanda UUID := 'e38ab38d-3be2-46c2-a857-f15a35c14b23';
    therapist_david UUID := '58310ffc-bca9-4215-8292-931d1caa5909';
    
    pathology_categories TEXT[] := ARRAY[
        'Ischemic Stroke - Left Hemisphere',
        'Hemorrhagic Stroke - Right Hemisphere',
        'Lacunar Stroke - Subcortical',
        'Multiple Sclerosis - Relapsing-Remitting',
        'Spinal Cord Injury - Incomplete C5-C6',
        'Parkinson''s Disease - Hoehn & Yahr Stage II',
        'Traumatic Brain Injury - Moderate',
        'ACL Reconstruction Post-Op',
        'Total Knee Replacement - Bilateral',
        'Rotator Cuff Repair - Full Thickness',
        'Hip Replacement - Primary OA',
        'Chronic Lower Back Pain - Mechanical',
        'Sports Injury - Hamstring Strain',
        'Cerebral Palsy - Spastic Diplegia',
        'Guillain-Barré Syndrome - Recovery Phase'
    ];
    
    age_groups TEXT[] := ARRAY['18-30', '31-50', '51-70', '71+'];
    genders TEXT[] := ARRAY['M', 'F', 'NB', 'NS'];
    
BEGIN
    -- Create 65 patients with realistic distribution
    FOR i IN 1..65 LOOP
        INSERT INTO public.patients (
            therapist_id, age_group, gender, pathology_category,
            created_at, active
        ) VALUES (
            -- Distribute patients among therapists
            CASE 
                WHEN i <= 25 THEN therapist_marie    -- 25 patients for Marie-Claire
                WHEN i <= 45 THEN therapist_amanda   -- 20 patients for Amanda
                ELSE therapist_david                  -- 20 patients for David
            END,
            
            -- Age distribution reflecting clinical reality
            age_groups[
                CASE 
                    WHEN i <= 15 THEN 4  -- 15 elderly (71+)
                    WHEN i <= 35 THEN 3  -- 20 middle-aged (51-70)
                    WHEN i <= 50 THEN 2  -- 15 adults (31-50)
                    ELSE 1               -- 15 young adults (18-30)
                END
            ],
            
            -- Gender distribution (roughly balanced with some NB representation)
            genders[
                CASE 
                    WHEN i % 10 = 0 THEN 3  -- 10% non-binary
                    WHEN i % 2 = 0 THEN 1   -- 45% male
                    ELSE 2                  -- 45% female
                END
            ],
            
            -- Pathology distribution reflecting typical caseloads
            pathology_categories[(i % array_length(pathology_categories, 1)) + 1],
            
            -- Staggered patient intake over 6 months
            '2025-02-01'::TIMESTAMPTZ + (i * INTERVAL '2.5 days') + (random() * INTERVAL '12 hours'),
            true
        );
    END LOOP;

END $$;

-- ==============================================================================
-- STEP 3: ADD REALISTIC PII DATA (Representative Sample)
-- ==============================================================================

-- Populate PII for first 30 patients to demonstrate system capability
DO $$
DECLARE
    patient_rec RECORD;
    first_names TEXT[] := ARRAY['Jean', 'Marie', 'Pierre', 'Sophie', 'Michel', 'Luc', 'Claire', 'Paul', 'Anne', 'David', 'Sarah', 'Julie', 'Martin', 'Lisa', 'Robert', 'Emma', 'Louis', 'Chloe', 'Marc', 'Isabelle', 'François', 'Nathalie', 'André', 'Sylvie', 'Alain', 'Catherine', 'Daniel', 'Louise', 'Gilles', 'Diane'];
    last_names TEXT[] := ARRAY['Tremblay', 'Gagnon', 'Roy', 'Bouchard', 'Gauthier', 'Morin', 'Lavoie', 'Fortin', 'Gagné', 'Ouellet', 'Pelletier', 'Bélanger', 'Lévesque', 'Bergeron', 'Leblanc', 'Paquette', 'Girard', 'Simard', 'Boucher', 'Caron', 'Beaulieu', 'Cloutier', 'Poulin', 'Poirier', 'Thibault', 'Leclerc', 'Lefebvre', 'Côté', 'Dubois', 'Fournier'];
    counter INTEGER := 1;
    
BEGIN
    FOR patient_rec IN 
        SELECT p.id, p.therapist_id, p.age_group, p.gender, p.pathology_category, p.created_at
        FROM patients p 
        ORDER BY p.created_at
        LIMIT 30
    LOOP
        INSERT INTO private.patient_pii (
            patient_id, first_name, last_name, date_of_birth, email, phone,
            medical_notes, emergency_contact, created_by
        ) VALUES (
            patient_rec.id,
            first_names[counter % array_length(first_names, 1) + 1],
            last_names[counter % array_length(last_names, 1) + 1],
            
            -- Realistic birth dates based on age groups
            CASE patient_rec.age_group
                WHEN '18-30' THEN '2005-01-01'::DATE - (random() * INTERVAL '12 years')::INTERVAL
                WHEN '31-50' THEN '1995-01-01'::DATE - (random() * INTERVAL '19 years')::INTERVAL  
                WHEN '51-70' THEN '1975-01-01'::DATE - (random() * INTERVAL '19 years')::INTERVAL
                WHEN '71+' THEN '1955-01-01'::DATE - (random() * INTERVAL '15 years')::INTERVAL
                ELSE '1980-01-01'::DATE
            END::DATE,
            
            -- Realistic Quebec email patterns
            LOWER(first_names[counter % array_length(first_names, 1) + 1]) || '.' || 
            LOWER(last_names[counter % array_length(last_names, 1) + 1]) || 
            (1950 + counter)::TEXT || '@' ||
            CASE counter % 4
                WHEN 0 THEN 'gmail.com'
                WHEN 1 THEN 'hotmail.com' 
                WHEN 2 THEN 'videotron.ca'
                ELSE 'sympatico.ca'
            END,
            
            -- Quebec phone numbers (area codes 418, 514, 450)
            CASE counter % 3
                WHEN 0 THEN '418'
                WHEN 1 THEN '514' 
                ELSE '450'
            END || '-' || (200 + (counter % 800))::TEXT || '-' || (1000 + (counter % 9000))::TEXT,
            
            -- Detailed medical notes based on pathology
            CASE 
                WHEN patient_rec.pathology_category LIKE '%Stroke%' THEN 
                    'Acute stroke rehabilitation patient. ' ||
                    CASE 
                        WHEN patient_rec.pathology_category LIKE '%Left%' THEN 'Right-sided hemiparesis, mild expressive aphasia. '
                        WHEN patient_rec.pathology_category LIKE '%Right%' THEN 'Left-sided hemiparesis, spatial neglect tendencies. '
                        ELSE 'Bilateral coordination deficits. '
                    END ||
                    'NIHSS admission: ' || (5 + random() * 10)::INTEGER || '. Current mRS: ' || (1 + random() * 3)::INTEGER || 
                    '. Goals: Improve UE motor control, enhance ADL independence. Medications: ASA, statin therapy. ' ||
                    'No contraindications for EMG-BFR training. Family highly supportive.'
                    
                WHEN patient_rec.pathology_category LIKE '%Sclerosis%' THEN 
                    'Multiple Sclerosis - RRMS type. Current EDSS: ' || (2.0 + random() * 3.0)::NUMERIC(3,1) || 
                    '. Last relapse: ' || (6 + random() * 18)::INTEGER || ' months ago. ' ||
                    'On disease-modifying therapy (Gilenya/Tecfidera). Heat sensitivity noted - cooling protocols essential. ' ||
                    'Fatigue management priority. Goals: Maintain strength, prevent deconditioning, optimize energy conservation.'
                    
                WHEN patient_rec.pathology_category LIKE '%Parkinson%' THEN 
                    'Parkinson''s Disease diagnosed ' || (2 + random() * 8)::INTEGER || ' years ago. ' ||
                    'Current H&Y Stage: II-III. UPDRS-III: ' || (20 + random() * 25)::INTEGER || 
                    '. On carbidopa-levodopa ' || (3 + random() * 2)::INTEGER || 'x daily. ' ||
                    'Optimal function 1-2h post-medication. Freezing episodes occasional. DBS candidate evaluation pending.'
                    
                WHEN patient_rec.pathology_category LIKE '%ACL%' OR patient_rec.pathology_category LIKE '%Knee%' THEN 
                    'Post-surgical orthopedic rehabilitation. Surgery date: ' || (patient_rec.created_at - INTERVAL '6 weeks')::DATE || 
                    '. Procedure: ' || patient_rec.pathology_category || '. Post-op protocol phase III. ' ||
                    'Current ROM: ' || (90 + random() * 45)::INTEGER || '° flexion. Quad strength ' || (60 + random() * 30)::INTEGER || 
                    '% of contralateral. Pain VAS: ' || (1 + random() * 3)::INTEGER || '/10. RTP timeline: ' || 
                    (12 + random() * 8)::INTEGER || ' weeks.'
                    
                WHEN patient_rec.pathology_category LIKE '%Spinal%' THEN 
                    'Incomplete spinal cord injury ' || CASE WHEN random() < 0.5 THEN 'traumatic' ELSE 'non-traumatic' END || 
                    ' etiology. Neurological level: C5-C6. AIS Classification: C/D. ' ||
                    'Admission FIM: ' || (40 + random() * 60)::INTEGER || '. Current FIM: ' || (80 + random() * 40)::INTEGER || 
                    '. Spasticity managed with baclofen. Autonomic dysreflexia monitoring. Goals: Maximize independence, ' ||
                    'optimize transfers, enhance upper extremity function.'
                    
                ELSE 
                    'Standard rehabilitation patient. Motivated and compliant with therapy protocols. ' ||
                    'Functional status: ' || CASE (counter % 3)
                        WHEN 0 THEN 'Independent with minimal assistance'
                        WHEN 1 THEN 'Modified independent with adaptive equipment'
                        ELSE 'Supervision level for safety'
                    END || 
                    '. Pain management optimized. No contraindications for intensive rehabilitation. ' ||
                    'Excellent family support system and discharge planning underway.'
            END,
            
            -- Emergency contacts
            'Primary: ' || first_names[((counter + 10) % array_length(first_names, 1)) + 1] || ' ' ||
            last_names[((counter + 5) % array_length(last_names, 1)) + 1] || 
            ' (' || CASE counter % 5 
                WHEN 0 THEN 'Spouse'
                WHEN 1 THEN 'Adult Child'  
                WHEN 2 THEN 'Parent'
                WHEN 3 THEN 'Sibling'
                ELSE 'Partner'
            END || ') - ' ||
            CASE (counter + 1) % 3
                WHEN 0 THEN '418'
                WHEN 1 THEN '514'
                ELSE '450' 
            END || '-' || (300 + (counter % 700))::TEXT || '-' || (2000 + (counter % 8000))::TEXT,
            
            patient_rec.therapist_id
        );
        
        counter := counter + 1;
    END LOOP;

END $$;

-- ==============================================================================  
-- STEP 4: CREATE COMPREHENSIVE THERAPY SESSIONS
-- ==============================================================================

-- Generate realistic therapy sessions with clinical progression patterns
DO $$
DECLARE
    patient_rec RECORD;
    session_counter INTEGER := 1;
    session_id_var UUID;
    sessions_per_patient INTEGER;
    session_date TIMESTAMPTZ;
    pathology_sessions_map JSONB := '{
        "Stroke": {"min": 12, "max": 20, "frequency_days": 2.5},
        "Sclerosis": {"min": 8, "max": 15, "frequency_days": 3.0},
        "Parkinson": {"min": 15, "max": 25, "frequency_days": 2.0},
        "ACL": {"min": 16, "max": 24, "frequency_days": 2.0},
        "Knee": {"min": 12, "max": 18, "frequency_days": 2.5},
        "Spinal": {"min": 20, "max": 30, "frequency_days": 2.0},
        "Hip": {"min": 10, "max": 16, "frequency_days": 3.0},
        "Default": {"min": 8, "max": 15, "frequency_days": 3.0}
    }';
    session_config JSONB;
    
BEGIN
    FOR patient_rec IN 
        SELECT p.id, p.therapist_id, p.pathology_category, p.created_at, p.patient_code,
               up.first_name || ' ' || up.last_name as therapist_name
        FROM patients p
        JOIN user_profiles up ON p.therapist_id = up.id
        ORDER BY p.created_at
    LOOP
        -- Determine session parameters based on pathology
        session_config := CASE 
            WHEN patient_rec.pathology_category LIKE '%Stroke%' THEN pathology_sessions_map->'Stroke'
            WHEN patient_rec.pathology_category LIKE '%Sclerosis%' THEN pathology_sessions_map->'Sclerosis'
            WHEN patient_rec.pathology_category LIKE '%Parkinson%' THEN pathology_sessions_map->'Parkinson'
            WHEN patient_rec.pathology_category LIKE '%ACL%' THEN pathology_sessions_map->'ACL'
            WHEN patient_rec.pathology_category LIKE '%Knee%' THEN pathology_sessions_map->'Knee'
            WHEN patient_rec.pathology_category LIKE '%Spinal%' THEN pathology_sessions_map->'Spinal'
            WHEN patient_rec.pathology_category LIKE '%Hip%' THEN pathology_sessions_map->'Hip'
            ELSE pathology_sessions_map->'Default'
        END;
        
        sessions_per_patient := ((session_config->>'min')::INTEGER + 
                               random() * ((session_config->>'max')::INTEGER - (session_config->>'min')::INTEGER))::INTEGER;
        
        -- Generate sessions for this patient
        FOR session_num IN 1..sessions_per_patient LOOP
            session_id_var := gen_random_uuid();
            
            session_date := patient_rec.created_at + 
                          INTERVAL '2 weeks' +  -- Initial assessment period
                          (session_num * ((session_config->>'frequency_days')::NUMERIC * INTERVAL '1 day')) +
                          (random() * INTERVAL '18 hours');  -- Natural scheduling variation
            
            INSERT INTO public.therapy_sessions (
                id, file_path, file_hash, file_size_bytes,
                patient_id, therapist_id, session_id, session_date,
                processing_status, processing_time_ms, game_metadata,
                created_at, processed_at, updated_at
            ) VALUES (
                session_id_var,
                
                -- Realistic institutional file paths
                '/clinical_data/ghostly_emg/' ||
                extract(year from session_date) || '/' ||
                LPAD(extract(month from session_date)::TEXT, 2, '0') || '/' ||
                CASE 
                    WHEN patient_rec.therapist_name LIKE '%Wilson%' THEN 'stroke_rehabilitation'
                    WHEN patient_rec.therapist_name LIKE '%Tremblay%' THEN 'neurological_rehab'
                    WHEN patient_rec.therapist_name LIKE '%Chen%' THEN 'orthopedic_therapy'
                    ELSE 'general_rehabilitation'
                END || '/' ||
                'GHOSTLY_EMG_' || patient_rec.patient_code || '_' ||
                to_char(session_date, 'YYYYMMDD_HH24-MI-SS') || 
                '-S' || LPAD(session_num::TEXT, 2, '0') || '.c3d',
                
                -- Realistic SHA-256 hash
                encode(sha256(
                    (patient_rec.id::TEXT || session_num::TEXT || session_date::TEXT)::bytea
                ), 'hex'),
                
                -- C3D file sizes: 1.5-4.5 MB (typical EMG data)
                (1500000 + (random() * 3000000))::BIGINT,
                
                patient_rec.id,
                patient_rec.therapist_id,
                'GHOSTLY_' || patient_rec.patient_code || '_S' || LPAD(session_num::TEXT, 2, '0'),
                session_date,
                
                -- Processing status distribution
                CASE 
                    WHEN session_date > NOW() - INTERVAL '24 hours' AND random() < 0.15 THEN 'pending'
                    WHEN session_date > NOW() - INTERVAL '3 days' AND random() < 0.08 THEN 'processing' 
                    WHEN random() < 0.02 THEN 'failed'  -- 2% failure rate
                    ELSE 'completed'
                END,
                
                -- Processing time with realistic variation (2-6 seconds)
                2000 + (random() * 4000) + 
                CASE session_num 
                    WHEN 1 THEN 1000  -- First session complexity
                    ELSE GREATEST(0, 500 * (1 - session_num::FLOAT / sessions_per_patient::FLOAT))  -- Efficiency gains
                END,
                
                -- Rich game metadata
                jsonb_build_object(
                    'game_version', '2.1.' || (4 + (session_counter % 3))::TEXT,
                    'session_type', CASE (session_num % 5)
                        WHEN 0 THEN 'baseline_assessment'
                        WHEN 1 THEN 'skill_acquisition'
                        WHEN 2 THEN 'strength_training'
                        WHEN 3 THEN 'endurance_challenge'
                        ELSE 'functional_integration'
                    END,
                    'difficulty_progression', LEAST(10, 3 + session_num + (random() * 2)::INTEGER),
                    'target_muscle_groups', CASE 
                        WHEN patient_rec.pathology_category LIKE '%Stroke%' THEN
                            CASE 
                                WHEN patient_rec.pathology_category LIKE '%Left%' THEN jsonb_build_array('right_biceps', 'right_triceps', 'right_forearm')
                                WHEN patient_rec.pathology_category LIKE '%Right%' THEN jsonb_build_array('left_biceps', 'left_triceps', 'left_forearm')
                                ELSE jsonb_build_array('bilateral_upper_extremity')
                            END
                        WHEN patient_rec.pathology_category LIKE '%Knee%' OR patient_rec.pathology_category LIKE '%ACL%' THEN 
                            jsonb_build_array('quadriceps', 'hamstrings', 'gastrocnemius', 'anterior_tibialis')
                        WHEN patient_rec.pathology_category LIKE '%Hip%' THEN
                            jsonb_build_array('gluteus_maximus', 'gluteus_medius', 'hip_flexors', 'hip_abductors')
                        WHEN patient_rec.pathology_category LIKE '%Spinal%' THEN
                            jsonb_build_array('biceps', 'triceps', 'wrist_extensors', 'finger_flexors')
                        ELSE jsonb_build_array('bilateral_functional_groups')
                    END,
                    'session_objectives', jsonb_build_array(
                        CASE session_num
                            WHEN 1 THEN 'Establish baseline EMG patterns'
                            WHEN 2 THEN 'Introduce BFR protocols'
                            ELSE 'Progress strength and endurance parameters'
                        END,
                        'Monitor patient tolerance and adaptation',
                        'Assess bilateral symmetry and coordination'
                    ),
                    'clinical_notes', jsonb_build_object(
                        'patient_motivation', CASE (session_counter % 4)
                            WHEN 0 THEN 'excellent'
                            WHEN 1 THEN 'good'
                            WHEN 2 THEN 'fair'
                            ELSE 'variable'
                        END,
                        'session_tolerance', CASE 
                            WHEN session_num <= 3 THEN 'adaptation_phase'
                            WHEN session_num <= 8 THEN 'steady_progress'
                            WHEN session_num <= 15 THEN 'plateau_management'
                            ELSE 'discharge_preparation'
                        END,
                        'adverse_events', CASE WHEN random() < 0.05 THEN 'mild_fatigue' ELSE 'none' END
                    ),
                    'environmental_data', jsonb_build_object(
                        'room_temperature_c', ROUND((20 + random() * 4)::NUMERIC, 1),
                        'humidity_percent', (45 + random() * 20)::INTEGER,
                        'noise_level_db', (30 + random() * 15)::INTEGER,
                        'lighting_lux', (300 + random() * 200)::INTEGER
                    )
                ),
                
                session_date - INTERVAL '10 minutes',  -- Created before session start
                CASE 
                    WHEN session_date <= NOW() - INTERVAL '1 day' THEN 
                         session_date + INTERVAL '20 minutes' + ((2000 + random() * 4000) * INTERVAL '1 millisecond')
                    ELSE NULL  -- Recent sessions may still be processing
                END,
                GREATEST(session_date + INTERVAL '2 hours', NOW() - INTERVAL '1 hour')
            );
            
            session_counter := session_counter + 1;
        END LOOP;
    END LOOP;

END $$;

-- Display initial population results
SELECT 
    'PHASE 1 COMPLETE: Users, Patients & Sessions Created! 🎉' as status,
    (SELECT COUNT(*) FROM user_profiles) as user_profiles,
    (SELECT COUNT(*) FROM patients) as patients,
    (SELECT COUNT(*) FROM therapy_sessions) as therapy_sessions,
    (SELECT COUNT(*) FROM therapy_sessions WHERE processing_status = 'completed') as completed_sessions;

COMMIT;
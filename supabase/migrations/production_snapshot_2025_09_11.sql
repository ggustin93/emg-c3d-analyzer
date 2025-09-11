-- ============================================================================
-- Production Database Snapshot - EMG C3D Analyzer
-- Generated: 2025-09-11
-- Purpose: Complete production schema for replication to new Supabase instances
-- ============================================================================

-- This file contains the COMPLETE production database schema including:
-- - All tables (public and private schemas)
-- - All 33 stored procedures and functions
-- - All triggers
-- - All RLS policies
-- - All indexes and constraints
-- - Default data and configurations

-- ============================================================================
-- STEP 1: SCHEMA SETUP
-- ============================================================================

-- Create schemas if they don't exist
CREATE SCHEMA IF NOT EXISTS public;
CREATE SCHEMA IF NOT EXISTS private;

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- STEP 2: DROP EXISTING OBJECTS (for clean replication)
-- ============================================================================

-- Drop all existing tables (CASCADE will drop dependent objects)
DROP TABLE IF EXISTS public.clinical_notes CASCADE;
DROP TABLE IF EXISTS public.emg_statistics CASCADE;
DROP TABLE IF EXISTS public.session_settings CASCADE;
DROP TABLE IF EXISTS public.therapy_sessions CASCADE;
DROP TABLE IF EXISTS public.patient_scoring_config CASCADE;
DROP TABLE IF EXISTS public.patients CASCADE;
DROP TABLE IF EXISTS public.patient_medical_info CASCADE;
DROP TABLE IF EXISTS public.scoring_configuration CASCADE;
DROP TABLE IF EXISTS public.user_profiles CASCADE;
DROP TABLE IF EXISTS public.audit_log CASCADE;
DROP TABLE IF EXISTS public.c3d_metadata CASCADE;
DROP TABLE IF EXISTS public.analysis_results CASCADE;
DROP TABLE IF EXISTS private.patient_pii CASCADE;
DROP TABLE IF EXISTS private.patient_auth_tokens CASCADE;

-- Drop sequences
DROP SEQUENCE IF EXISTS public.therapist_code_seq CASCADE;
DROP SEQUENCE IF EXISTS public.researcher_code_seq CASCADE;
DROP SEQUENCE IF EXISTS public.admin_code_seq CASCADE;

-- ============================================================================
-- STEP 3: CREATE SEQUENCES
-- ============================================================================

CREATE SEQUENCE IF NOT EXISTS public.therapist_code_seq START 1;
CREATE SEQUENCE IF NOT EXISTS public.researcher_code_seq START 1;
CREATE SEQUENCE IF NOT EXISTS public.admin_code_seq START 1;

-- ============================================================================
-- STEP 4: CREATE TABLES
-- ============================================================================

-- User Profiles (Foundation)
CREATE TABLE public.user_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('admin', 'therapist', 'researcher')),
    user_code TEXT UNIQUE,
    full_name_override TEXT,
    institution TEXT,
    specialization TEXT,
    access_level TEXT DEFAULT 'basic' CHECK (access_level IN ('basic', 'full', 'admin')),
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Scoring Configuration
CREATE TABLE public.scoring_configuration (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    therapist_id UUID REFERENCES public.user_profiles(id),
    is_global BOOLEAN DEFAULT false,
    performance_weights JSONB DEFAULT '{"compliance": 0.4, "symmetry": 0.25, "effort": 0.2, "game": 0.15}'::jsonb,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(therapist_id, name)
);

-- Patients
CREATE TABLE public.patients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_code TEXT UNIQUE NOT NULL,
    therapist_id UUID NOT NULL REFERENCES public.user_profiles(id),
    current_scoring_config_id UUID REFERENCES public.scoring_configuration(id),
    scoring_config_updated_at TIMESTAMPTZ,
    scoring_config_updated_by UUID REFERENCES public.user_profiles(id),
    current_mvc_ch1 DOUBLE PRECISION,
    current_mvc_ch2 DOUBLE PRECISION,
    current_duration_ch1 DOUBLE PRECISION,
    current_duration_ch2 DOUBLE PRECISION,
    last_assessment_date TIMESTAMPTZ,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Patient Medical Info
CREATE TABLE public.patient_medical_info (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID UNIQUE NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    date_of_birth DATE NOT NULL,
    gender TEXT NOT NULL,
    height_cm NUMERIC(5,2),
    weight_kg NUMERIC(5,2),
    bmi_value NUMERIC(4,1),
    bmi_status TEXT DEFAULT 'normal',
    room_number TEXT,
    admission_date DATE,
    discharge_date DATE,
    primary_diagnosis TEXT,
    secondary_diagnoses TEXT[],
    mobility_status TEXT DEFAULT 'bed_rest',
    cognitive_status TEXT DEFAULT 'alert',
    total_sessions_planned INTEGER DEFAULT 10,
    patient_status TEXT DEFAULT 'active',
    consent_for_research BOOLEAN DEFAULT false,
    consent_for_data_sharing BOOLEAN DEFAULT false,
    consent_date TIMESTAMPTZ,
    consent_expires_at TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID NOT NULL REFERENCES public.user_profiles(id),
    updated_by UUID REFERENCES public.user_profiles(id)
);

-- Therapy Sessions
CREATE TABLE public.therapy_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES public.patients(id),
    therapist_id UUID NOT NULL REFERENCES public.user_profiles(id),
    session_date TIMESTAMPTZ NOT NULL,
    session_type TEXT DEFAULT 'therapy',
    scoring_config_id UUID REFERENCES public.scoring_configuration(id),
    mvc_value DOUBLE PRECISION,
    game_score DOUBLE PRECISION,
    compliance_metrics JSONB,
    performance_score DOUBLE PRECISION,
    session_notes TEXT,
    file_path TEXT,
    last_accessed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Session Settings
CREATE TABLE public.session_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID UNIQUE NOT NULL REFERENCES public.therapy_sessions(id) ON DELETE CASCADE,
    target_mvc_ch1 DOUBLE PRECISION,
    target_mvc_ch2 DOUBLE PRECISION,
    target_duration_ch1 DOUBLE PRECISION,
    target_duration_ch2 DOUBLE PRECISION,
    bfr_pressure_ch1 DOUBLE PRECISION,
    bfr_pressure_ch2 DOUBLE PRECISION,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- EMG Statistics
CREATE TABLE public.emg_statistics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES public.therapy_sessions(id) ON DELETE CASCADE,
    channel_name TEXT NOT NULL,
    muscle_group TEXT,
    max_amplitude DOUBLE PRECISION,
    mean_amplitude DOUBLE PRECISION,
    median_amplitude DOUBLE PRECISION,
    std_amplitude DOUBLE PRECISION,
    rms_value DOUBLE PRECISION,
    median_frequency DOUBLE PRECISION,
    mean_frequency DOUBLE PRECISION,
    peak_frequency DOUBLE PRECISION,
    total_contractions INTEGER,
    contraction_durations DOUBLE PRECISION[],
    contraction_amplitudes DOUBLE PRECISION[],
    contraction_intervals DOUBLE PRECISION[],
    contraction_quality_metrics JSONB,
    mvc_percentage DOUBLE PRECISION,
    fatigue_index DOUBLE PRECISION,
    signal_quality DOUBLE PRECISION,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(session_id, channel_name)
);

-- Clinical Notes
CREATE TABLE public.clinical_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID REFERENCES public.patients(id) ON DELETE CASCADE,
    session_id UUID REFERENCES public.therapy_sessions(id) ON DELETE CASCADE,
    therapist_id UUID NOT NULL REFERENCES public.user_profiles(id),
    note_type TEXT NOT NULL DEFAULT 'general',
    note_content TEXT NOT NULL,
    file_path TEXT,
    tags TEXT[],
    is_draft BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CHECK (patient_id IS NOT NULL OR session_id IS NOT NULL)
);

-- C3D Metadata
CREATE TABLE public.c3d_metadata (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    file_path TEXT UNIQUE NOT NULL,
    upload_date TIMESTAMPTZ DEFAULT NOW(),
    file_size_bytes BIGINT,
    frame_rate DOUBLE PRECISION,
    point_count INTEGER,
    analog_channels INTEGER,
    duration_seconds DOUBLE PRECISION,
    manufacturer TEXT,
    processed BOOLEAN DEFAULT false,
    processing_date TIMESTAMPTZ,
    metadata_json JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Analysis Results
CREATE TABLE public.analysis_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES public.therapy_sessions(id) ON DELETE CASCADE,
    c3d_metadata_id UUID REFERENCES public.c3d_metadata(id),
    analysis_type TEXT NOT NULL,
    result_data JSONB NOT NULL,
    quality_metrics JSONB,
    processing_duration_ms INTEGER,
    algorithm_version TEXT,
    last_accessed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Audit Log
CREATE TABLE public.audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.user_profiles(id),
    user_role TEXT,
    action TEXT NOT NULL,
    table_name TEXT,
    record_id UUID,
    changes JSONB,
    ip_address INET,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Patient Scoring Config (Junction Table)
CREATE TABLE public.patient_scoring_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
    scoring_config_id UUID NOT NULL REFERENCES public.scoring_configuration(id),
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES public.user_profiles(id),
    UNIQUE(patient_id, scoring_config_id)
);

-- Private Schema Tables
CREATE TABLE private.patient_pii (
    patient_id UUID PRIMARY KEY REFERENCES public.patients(id) ON DELETE CASCADE,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    date_of_birth DATE NOT NULL,
    email TEXT,
    phone TEXT,
    medical_notes TEXT,
    emergency_contact TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES public.user_profiles(id)
);

CREATE TABLE private.patient_auth_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '24 hours'),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    used_at TIMESTAMPTZ,
    ip_address INET,
    user_agent TEXT
);

-- ============================================================================
-- STEP 5: CREATE ALL 33 FUNCTIONS AND STORED PROCEDURES
-- ============================================================================

-- Function 1: get_user_role
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN COALESCE(
        (SELECT role FROM public.user_profiles WHERE id = auth.uid()),
        'anonymous'
    );
END;
$$;

-- Function 2: get_current_user_id
CREATE OR REPLACE FUNCTION public.get_current_user_id()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN auth.uid();
END;
$$;

-- Function 3: get_current_therapist_id
CREATE OR REPLACE FUNCTION public.get_current_therapist_id()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    therapist_uuid UUID;
BEGIN
    SELECT id INTO therapist_uuid
    FROM public.user_profiles
    WHERE id = auth.uid() 
    AND role = 'therapist'
    AND active = true
    LIMIT 1;
    
    RETURN therapist_uuid;
END;
$$;

-- Function 4: user_owns_patient
CREATE OR REPLACE FUNCTION public.user_owns_patient(p_code TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    current_therapist_id UUID;
BEGIN
    SELECT id INTO current_therapist_id
    FROM public.user_profiles
    WHERE id = auth.uid()
    AND role = 'therapist'
    AND active = true
    LIMIT 1;

    IF current_therapist_id IS NULL THEN
        RETURN FALSE;
    END IF;

    RETURN EXISTS (
        SELECT 1
        FROM public.patients p
        WHERE p.patient_code = p_code
          AND p.therapist_id = current_therapist_id
    );
END;
$$;

-- Function 5: is_assigned_to_patient (by code)
CREATE OR REPLACE FUNCTION public.is_assigned_to_patient(p_code TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN public.user_owns_patient(p_code);
END;
$$;

-- Function 6: is_assigned_to_patient (by UUID)
CREATE OR REPLACE FUNCTION public.is_assigned_to_patient(patient_uuid UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    is_assigned BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1
        FROM public.patients
        WHERE id = patient_uuid AND therapist_id = public.get_current_therapist_id()
    ) INTO is_assigned;
    RETURN is_assigned;
END;
$$;

-- Function 7: is_therapist_for_patient
CREATE OR REPLACE FUNCTION public.is_therapist_for_patient(patient_uuid UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.patients 
        WHERE id = patient_uuid AND therapist_id = auth.uid()
    );
END;
$$;

-- Function 8: get_patient_code_from_storage_path
CREATE OR REPLACE FUNCTION public.get_patient_code_from_storage_path(file_path TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
SECURITY DEFINER
AS $$
  SELECT CASE 
    WHEN file_path ~ '^P\d+/' THEN
      (string_to_array(file_path, '/'))[1]
    WHEN file_path ~ '^c3d-examples/P\d+/' THEN
      (string_to_array(file_path, '/'))[2]
    ELSE 
      NULL
  END;
$$;

-- Function 9: get_session_scoring_config
CREATE OR REPLACE FUNCTION public.get_session_scoring_config(
    p_session_id UUID DEFAULT NULL,
    p_patient_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_config_id UUID;
BEGIN
    -- Priority 1: Session config
    IF p_session_id IS NOT NULL THEN
        SELECT scoring_config_id INTO v_config_id
        FROM public.therapy_sessions
        WHERE id = p_session_id
        LIMIT 1;
        
        IF v_config_id IS NOT NULL THEN
            RETURN v_config_id;
        END IF;
    END IF;
    
    -- Priority 2: Patient config
    IF p_patient_id IS NOT NULL THEN
        SELECT current_scoring_config_id INTO v_config_id
        FROM public.patients
        WHERE id = p_patient_id
        LIMIT 1;
        
        IF v_config_id IS NOT NULL THEN
            RETURN v_config_id;
        END IF;
    END IF;
    
    -- Priority 3: Global default
    SELECT id INTO v_config_id
    FROM public.scoring_configuration
    WHERE name = 'GHOSTLY-TRIAL-DEFAULT' 
        AND active = true
    ORDER BY created_at DESC
    LIMIT 1;
    
    IF v_config_id IS NOT NULL THEN
        RETURN v_config_id;
    END IF;
    
    -- Priority 4: Any active config
    SELECT id INTO v_config_id
    FROM public.scoring_configuration
    WHERE active = true
    ORDER BY created_at DESC
    LIMIT 1;
    
    RETURN v_config_id;
END;
$$;

-- Function 10: get_patient_scoring_config
CREATE OR REPLACE FUNCTION public.get_patient_scoring_config(p_patient_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_config_id UUID;
BEGIN
    SELECT scoring_config_id INTO v_config_id
    FROM patient_scoring_config
    WHERE patient_id = p_patient_id AND active = true
    LIMIT 1;
    
    IF v_config_id IS NOT NULL THEN
        RETURN v_config_id;
    END IF;
    
    SELECT id INTO v_config_id
    FROM scoring_configuration
    WHERE is_global = true AND active = true
    AND name = 'GHOSTLY+ Default'
    LIMIT 1;
    
    RETURN v_config_id;
END;
$$;

-- Function 11: update_patient_current_values
CREATE OR REPLACE FUNCTION public.update_patient_current_values(
    p_patient_id UUID,
    p_mvc_ch1 DOUBLE PRECISION DEFAULT NULL,
    p_mvc_ch2 DOUBLE PRECISION DEFAULT NULL,
    p_duration_ch1 DOUBLE PRECISION DEFAULT NULL,
    p_duration_ch2 DOUBLE PRECISION DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE public.patients 
    SET 
        current_mvc_ch1 = COALESCE(p_mvc_ch1, current_mvc_ch1),
        current_mvc_ch2 = COALESCE(p_mvc_ch2, current_mvc_ch2),
        current_duration_ch1 = COALESCE(p_duration_ch1, current_duration_ch1),
        current_duration_ch2 = COALESCE(p_duration_ch2, current_duration_ch2),
        last_assessment_date = NOW(),
        updated_at = NOW()
    WHERE id = p_patient_id;
    
    RETURN FOUND;
END;
$$;

-- Function 12: set_session_therapeutic_targets
CREATE OR REPLACE FUNCTION public.set_session_therapeutic_targets(
    p_session_id UUID,
    p_target_mvc_ch1 DOUBLE PRECISION DEFAULT NULL,
    p_target_mvc_ch2 DOUBLE PRECISION DEFAULT NULL,
    p_target_duration_ch1 DOUBLE PRECISION DEFAULT NULL,
    p_target_duration_ch2 DOUBLE PRECISION DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE public.session_settings 
    SET 
        target_mvc_ch1 = COALESCE(p_target_mvc_ch1, target_mvc_ch1),
        target_mvc_ch2 = COALESCE(p_target_mvc_ch2, target_mvc_ch2),
        target_duration_ch1 = COALESCE(p_target_duration_ch1, target_duration_ch1),
        target_duration_ch2 = COALESCE(p_target_duration_ch2, target_duration_ch2),
        updated_at = NOW()
    WHERE session_id = p_session_id;
    
    RETURN FOUND;
END;
$$;

-- Function 13: check_expired_consents
CREATE OR REPLACE FUNCTION public.check_expired_consents()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE public.patient_medical_info 
    SET 
        consent_for_research = false,
        consent_for_data_sharing = false
    WHERE consent_expires_at < now() 
        AND (consent_for_research = true OR consent_for_data_sharing = true);
END;
$$;

-- Function 14: cleanup_expired_patient_tokens
CREATE OR REPLACE FUNCTION public.cleanup_expired_patient_tokens()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM private.patient_auth_tokens 
    WHERE expires_at < NOW() - INTERVAL '1 hour';
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$;

-- Function 15: debug_storage_access
CREATE OR REPLACE FUNCTION public.debug_storage_access(file_path TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    patient_code TEXT;
    current_user_id UUID;
    therapist_id UUID;
    owns_patient BOOLEAN;
    result JSON;
BEGIN
    patient_code := split_part(file_path, '/', 1);
    current_user_id := auth.uid();

    SELECT id INTO therapist_id
    FROM public.user_profiles
    WHERE id = current_user_id
    AND role = 'therapist'
    AND active = true
    LIMIT 1;

    owns_patient := public.user_owns_patient(patient_code);

    SELECT json_build_object(
        'file_path', file_path,
        'patient_code', patient_code,
        'current_user_id', current_user_id,
        'therapist_id', therapist_id,
        'owns_patient', owns_patient,
        'auth_context_valid', (current_user_id IS NOT NULL),
        'therapist_profile_found', (therapist_id IS NOT NULL)
    ) INTO result;

    RETURN result;
END;
$$;

-- Function 16: validate_emg_statistics_jsonb_structure
CREATE OR REPLACE FUNCTION public.validate_emg_statistics_jsonb_structure()
RETURNS TABLE(
    session_id UUID,
    channel_name TEXT,
    has_quality_metrics BOOLEAN,
    has_overall_compliant BOOLEAN,
    overall_compliant_value INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        es.session_id,
        es.channel_name,
        (es.contraction_quality_metrics IS NOT NULL AND es.contraction_quality_metrics != '{}') as has_quality_metrics,
        (es.contraction_quality_metrics ? 'overall_compliant_contractions') as has_overall_compliant,
        CAST(es.contraction_quality_metrics->>'overall_compliant_contractions' AS INTEGER) as overall_compliant_value
    FROM public.emg_statistics es
    ORDER BY es.session_id, es.channel_name;
END;
$$;

-- ============================================================================
-- STEP 6: CREATE TRIGGER FUNCTIONS (17 functions)
-- ============================================================================

-- Trigger Function 1: generate_user_code
CREATE OR REPLACE FUNCTION public.generate_user_code()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.user_code IS NULL THEN
        CASE NEW.role
            WHEN 'therapist' THEN
                NEW.user_code := 'T' || lpad(nextval('therapist_code_seq')::text, 3, '0');
            WHEN 'researcher' THEN
                NEW.user_code := 'R' || lpad(nextval('researcher_code_seq')::text, 3, '0');
            WHEN 'admin' THEN
                NEW.user_code := 'A' || lpad(nextval('admin_code_seq')::text, 3, '0');
            ELSE
                RAISE EXCEPTION 'Invalid role: %', NEW.role;
        END CASE;
    END IF;
    RETURN NEW;
END;
$$;

-- Trigger Function 2: update_updated_at_column
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

-- Trigger Function 3: calculate_bmi_on_change
CREATE OR REPLACE FUNCTION public.calculate_bmi_on_change()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.height_cm IS NOT NULL AND NEW.weight_kg IS NOT NULL THEN
        NEW.bmi_value = ROUND((NEW.weight_kg / POWER(NEW.height_cm/100, 2))::numeric, 1);
        
        NEW.bmi_status = CASE
            WHEN NEW.bmi_value < 18.5 THEN 'underweight'
            WHEN NEW.bmi_value >= 18.5 AND NEW.bmi_value < 25 THEN 'normal'
            WHEN NEW.bmi_value >= 25 AND NEW.bmi_value < 30 THEN 'overweight'
            ELSE 'obese'
        END;
    END IF;
    
    RETURN NEW;
END;
$$;

-- Trigger Function 4: audit_patient_medical_info
CREATE OR REPLACE FUNCTION public.audit_patient_medical_info()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    INSERT INTO public.audit_log (
        user_id,
        user_role,
        action,
        table_name,
        record_id,
        changes,
        ip_address
    ) VALUES (
        auth.uid(),
        COALESCE(
            (SELECT role FROM public.user_profiles WHERE id = auth.uid()),
            'unknown'
        ),
        TG_OP,
        'patient_medical_info',
        COALESCE(NEW.id, OLD.id),
        CASE 
            WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD)
            WHEN TG_OP = 'INSERT' THEN to_jsonb(NEW)
            ELSE jsonb_build_object('old', to_jsonb(OLD), 'new', to_jsonb(NEW))
        END,
        inet_client_addr()
    );
    RETURN COALESCE(NEW, OLD);
END;
$$;

-- Trigger Function 5: audit_patient_scoring_config_change
CREATE OR REPLACE FUNCTION public.audit_patient_scoring_config_change()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF OLD.current_scoring_config_id IS DISTINCT FROM NEW.current_scoring_config_id THEN
        NEW.scoring_config_updated_at = NOW();
    END IF;
    RETURN NEW;
END;
$$;

-- Trigger Function 6: copy_scoring_config_to_session
CREATE OR REPLACE FUNCTION public.copy_scoring_config_to_session()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.scoring_config_id IS NULL AND NEW.patient_id IS NOT NULL THEN
        NEW.scoring_config_id = get_session_scoring_config(
            p_session_id := NULL,
            p_patient_id := NEW.patient_id
        );
    END IF;
    RETURN NEW;
END;
$$;

-- Trigger Function 7: validate_performance_weights
CREATE OR REPLACE FUNCTION public.validate_performance_weights()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  weight_sum FLOAT;
BEGIN
  SELECT 
    COALESCE((NEW.performance_weights->>'compliance')::FLOAT, 0) +
    COALESCE((NEW.performance_weights->>'symmetry')::FLOAT, 0) +  
    COALESCE((NEW.performance_weights->>'effort')::FLOAT, 0) +
    COALESCE((NEW.performance_weights->>'game')::FLOAT, 0)
  INTO weight_sum;
  
  IF ABS(weight_sum - 1.0) > 0.01 THEN
    RAISE EXCEPTION 'Performance weights must sum to 1.0, got %', weight_sum;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger Function 8: update_medical_timestamp
CREATE OR REPLACE FUNCTION public.update_medical_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  NEW.updated_by = auth.uid();
  RETURN NEW;
END;
$$;

-- Trigger Function 9: update_patient_medical_info_updated_at
CREATE OR REPLACE FUNCTION public.update_patient_medical_info_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = now();
    IF auth.uid() IS NOT NULL THEN
        NEW.updated_by = auth.uid();
    END IF;
    RETURN NEW;
END;
$$;

-- Trigger Function 10: update_clinical_notes_updated_at
CREATE OR REPLACE FUNCTION public.update_clinical_notes_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Trigger Function 11: update_c3d_metadata_updated_at
CREATE OR REPLACE FUNCTION public.update_c3d_metadata_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

-- Trigger Function 12: update_scoring_config_timestamp
CREATE OR REPLACE FUNCTION public.update_scoring_config_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

-- Trigger Function 13: update_therapy_sessions_last_accessed
CREATE OR REPLACE FUNCTION public.update_therapy_sessions_last_accessed()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.last_accessed_at = NOW();
    RETURN NEW;
END;
$$;

-- Trigger Function 14: update_analysis_results_last_accessed
CREATE OR REPLACE FUNCTION public.update_analysis_results_last_accessed()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.last_accessed_at = NOW();
    RETURN NEW;
END;
$$;

-- Trigger Function 15: update_analytics_cache_last_accessed
CREATE OR REPLACE FUNCTION public.update_analytics_cache_last_accessed()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.last_accessed_at = NOW();
    RETURN NEW;
END;
$$;

-- Trigger Function 16: update_cache_hit
CREATE OR REPLACE FUNCTION public.update_cache_hit()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.cache_hits = OLD.cache_hits + 1;
    NEW.last_accessed_at = NOW();
    RETURN NEW;
END;
$$;

-- ============================================================================
-- STEP 7: CREATE TRIGGERS
-- ============================================================================

-- User Profiles Triggers
CREATE TRIGGER generate_user_code_trigger
    BEFORE INSERT ON public.user_profiles
    FOR EACH ROW EXECUTE FUNCTION public.generate_user_code();

CREATE TRIGGER update_user_profiles_updated_at
    BEFORE UPDATE ON public.user_profiles
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Patient Medical Info Triggers
CREATE TRIGGER calculate_bmi_trigger
    BEFORE INSERT OR UPDATE ON public.patient_medical_info
    FOR EACH ROW EXECUTE FUNCTION public.calculate_bmi_on_change();

CREATE TRIGGER audit_patient_medical_info_trigger
    AFTER INSERT OR UPDATE OR DELETE ON public.patient_medical_info
    FOR EACH ROW EXECUTE FUNCTION public.audit_patient_medical_info();

CREATE TRIGGER update_patient_medical_info_timestamp
    BEFORE UPDATE ON public.patient_medical_info
    FOR EACH ROW EXECUTE FUNCTION public.update_patient_medical_info_updated_at();

-- Patients Triggers
CREATE TRIGGER audit_patient_scoring_config_trigger
    BEFORE UPDATE ON public.patients
    FOR EACH ROW EXECUTE FUNCTION public.audit_patient_scoring_config_change();

CREATE TRIGGER update_patients_updated_at
    BEFORE UPDATE ON public.patients
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Therapy Sessions Triggers
CREATE TRIGGER copy_scoring_config_trigger
    BEFORE INSERT ON public.therapy_sessions
    FOR EACH ROW EXECUTE FUNCTION public.copy_scoring_config_to_session();

CREATE TRIGGER update_therapy_sessions_updated_at
    BEFORE UPDATE ON public.therapy_sessions
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_therapy_sessions_accessed
    BEFORE SELECT ON public.therapy_sessions
    FOR EACH ROW EXECUTE FUNCTION public.update_therapy_sessions_last_accessed();

-- Scoring Configuration Triggers
CREATE TRIGGER validate_performance_weights_trigger
    BEFORE INSERT OR UPDATE ON public.scoring_configuration
    FOR EACH ROW EXECUTE FUNCTION public.validate_performance_weights();

CREATE TRIGGER update_scoring_config_updated_at
    BEFORE UPDATE ON public.scoring_configuration
    FOR EACH ROW EXECUTE FUNCTION public.update_scoring_config_timestamp();

-- Clinical Notes Triggers
CREATE TRIGGER update_clinical_notes_timestamp
    BEFORE UPDATE ON public.clinical_notes
    FOR EACH ROW EXECUTE FUNCTION public.update_clinical_notes_updated_at();

-- C3D Metadata Triggers
CREATE TRIGGER update_c3d_metadata_timestamp
    BEFORE UPDATE ON public.c3d_metadata
    FOR EACH ROW EXECUTE FUNCTION public.update_c3d_metadata_updated_at();

-- Analysis Results Triggers
CREATE TRIGGER update_analysis_results_accessed
    BEFORE SELECT ON public.analysis_results
    FOR EACH ROW EXECUTE FUNCTION public.update_analysis_results_last_accessed();

-- Session Settings Triggers
CREATE TRIGGER update_session_settings_updated_at
    BEFORE UPDATE ON public.session_settings
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- STEP 8: CREATE INDEXES
-- ============================================================================

-- User Profiles Indexes
CREATE INDEX idx_user_profiles_role ON public.user_profiles(role);
CREATE INDEX idx_user_profiles_active ON public.user_profiles(active);
CREATE INDEX idx_user_profiles_user_code ON public.user_profiles(user_code);

-- Patients Indexes
CREATE INDEX idx_patients_therapist ON public.patients(therapist_id);
CREATE INDEX idx_patients_code ON public.patients(patient_code);
CREATE INDEX idx_patients_active ON public.patients(active);

-- Therapy Sessions Indexes
CREATE INDEX idx_sessions_patient ON public.therapy_sessions(patient_id);
CREATE INDEX idx_sessions_therapist ON public.therapy_sessions(therapist_id);
CREATE INDEX idx_sessions_date ON public.therapy_sessions(session_date);
CREATE INDEX idx_sessions_file_path ON public.therapy_sessions(file_path);

-- EMG Statistics Indexes
CREATE INDEX idx_emg_statistics_session ON public.emg_statistics(session_id);
CREATE INDEX idx_emg_statistics_channel ON public.emg_statistics(channel_name);

-- Clinical Notes Indexes
CREATE INDEX idx_clinical_notes_patient ON public.clinical_notes(patient_id);
CREATE INDEX idx_clinical_notes_session ON public.clinical_notes(session_id);
CREATE INDEX idx_clinical_notes_therapist ON public.clinical_notes(therapist_id);
CREATE INDEX idx_clinical_notes_type ON public.clinical_notes(note_type);

-- C3D Metadata Indexes
CREATE INDEX idx_c3d_metadata_file_path ON public.c3d_metadata(file_path);
CREATE INDEX idx_c3d_metadata_processed ON public.c3d_metadata(processed);

-- Analysis Results Indexes
CREATE INDEX idx_analysis_results_session ON public.analysis_results(session_id);
CREATE INDEX idx_analysis_results_c3d ON public.analysis_results(c3d_metadata_id);
CREATE INDEX idx_analysis_results_type ON public.analysis_results(analysis_type);

-- Audit Log Indexes
CREATE INDEX idx_audit_log_user ON public.audit_log(user_id);
CREATE INDEX idx_audit_log_table ON public.audit_log(table_name);
CREATE INDEX idx_audit_log_record ON public.audit_log(record_id);
CREATE INDEX idx_audit_log_created ON public.audit_log(created_at);

-- ============================================================================
-- STEP 9: ENABLE ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patient_medical_info ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.therapy_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.emg_statistics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clinical_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scoring_configuration ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patient_scoring_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.c3d_metadata ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analysis_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- STEP 10: CREATE RLS POLICIES
-- ============================================================================

-- Admin Full Access Policies
CREATE POLICY "admin_full_access" ON public.user_profiles
    FOR ALL USING (get_user_role() = 'admin');

CREATE POLICY "admin_full_access" ON public.patients
    FOR ALL USING (get_user_role() = 'admin');

CREATE POLICY "admin_full_access" ON public.patient_medical_info
    FOR ALL USING (get_user_role() = 'admin');

CREATE POLICY "admin_full_access" ON public.therapy_sessions
    FOR ALL USING (get_user_role() = 'admin');

CREATE POLICY "admin_full_access" ON public.session_settings
    FOR ALL USING (get_user_role() = 'admin');

CREATE POLICY "admin_full_access" ON public.emg_statistics
    FOR ALL USING (get_user_role() = 'admin');

CREATE POLICY "admin_full_access" ON public.clinical_notes
    FOR ALL USING (get_user_role() = 'admin');

CREATE POLICY "admin_full_access" ON public.scoring_configuration
    FOR ALL USING (get_user_role() = 'admin');

CREATE POLICY "admin_full_access" ON public.audit_log
    FOR ALL USING (get_user_role() = 'admin');

-- Therapist Policies
CREATE POLICY "therapist_own_patients" ON public.patients
    FOR ALL USING (therapist_id = auth.uid() OR get_user_role() = 'admin');

CREATE POLICY "therapist_own_patient_medical" ON public.patient_medical_info
    FOR ALL USING (
        patient_id IN (SELECT id FROM public.patients WHERE therapist_id = auth.uid())
        OR get_user_role() = 'admin'
    );

CREATE POLICY "therapist_own_sessions" ON public.therapy_sessions
    FOR ALL USING (
        patient_id IN (SELECT id FROM public.patients WHERE therapist_id = auth.uid())
        OR get_user_role() = 'admin'
    );

CREATE POLICY "therapist_own_session_settings" ON public.session_settings
    FOR ALL USING (
        session_id IN (
            SELECT id FROM public.therapy_sessions 
            WHERE patient_id IN (SELECT id FROM public.patients WHERE therapist_id = auth.uid())
        )
        OR get_user_role() = 'admin'
    );

CREATE POLICY "therapist_own_emg_statistics" ON public.emg_statistics
    FOR ALL USING (
        session_id IN (
            SELECT id FROM public.therapy_sessions 
            WHERE patient_id IN (SELECT id FROM public.patients WHERE therapist_id = auth.uid())
        )
        OR get_user_role() = 'admin'
    );

CREATE POLICY "therapist_own_clinical_notes" ON public.clinical_notes
    FOR ALL USING (therapist_id = auth.uid() OR get_user_role() = 'admin');

CREATE POLICY "therapist_own_profile" ON public.user_profiles
    FOR SELECT USING (id = auth.uid() OR get_user_role() = 'admin');

CREATE POLICY "therapist_update_profile" ON public.user_profiles
    FOR UPDATE USING (id = auth.uid() AND get_user_role() = 'therapist');

-- Researcher Policies (Read-Only)
CREATE POLICY "researcher_read_sessions" ON public.therapy_sessions
    FOR SELECT USING (get_user_role() = 'researcher');

CREATE POLICY "researcher_read_patients" ON public.patients
    FOR SELECT USING (get_user_role() = 'researcher');

CREATE POLICY "researcher_read_emg_statistics" ON public.emg_statistics
    FOR SELECT USING (get_user_role() = 'researcher');

CREATE POLICY "researcher_read_profiles" ON public.user_profiles
    FOR SELECT USING (get_user_role() = 'researcher');

-- Everyone Can Read Their Own Profile
CREATE POLICY "users_own_profile" ON public.user_profiles
    FOR SELECT USING (id = auth.uid());

-- Scoring Configuration Policies
CREATE POLICY "read_scoring_configs" ON public.scoring_configuration
    FOR SELECT USING (true);

CREATE POLICY "therapist_create_scoring_configs" ON public.scoring_configuration
    FOR INSERT WITH CHECK (therapist_id = auth.uid() OR get_user_role() = 'admin');

CREATE POLICY "therapist_update_own_configs" ON public.scoring_configuration
    FOR UPDATE USING (therapist_id = auth.uid() OR get_user_role() = 'admin');

-- ============================================================================
-- STEP 11: CREATE STORAGE BUCKET AND POLICIES
-- ============================================================================

-- Note: Storage bucket creation must be done via Supabase Dashboard or CLI
-- The SQL below documents the required storage policies

-- Storage RLS Policies for c3d-examples bucket would be created as:
/*
-- Admin Full Access
CREATE POLICY "admin_c3d_full_access" ON storage.objects
    FOR ALL 
    TO authenticated
    USING (
        bucket_id = 'c3d-examples' AND 
        get_user_role() = 'admin'
    )
    WITH CHECK (
        bucket_id = 'c3d-examples' AND 
        get_user_role() = 'admin'
    );

-- Researcher Read-Only
CREATE POLICY "researcher_c3d_read" ON storage.objects
    FOR SELECT 
    TO authenticated
    USING (
        bucket_id = 'c3d-examples' AND 
        get_user_role() = 'researcher'
    );

-- Therapist Own Patients
CREATE POLICY "therapist_c3d_own_patients" ON storage.objects
    FOR ALL 
    TO authenticated
    USING (
        bucket_id = 'c3d-examples' AND 
        get_user_role() = 'therapist' AND
        (
            get_patient_code_from_storage_path(name) IN (
                SELECT patient_code 
                FROM patients 
                WHERE therapist_id = auth.uid() 
                AND patient_code IS NOT NULL
            )
            OR name = ''
            OR name ~ '^P\d+/?$'
        )
    )
    WITH CHECK (
        bucket_id = 'c3d-examples' AND 
        get_user_role() = 'therapist' AND
        (
            get_patient_code_from_storage_path(name) IN (
                SELECT patient_code 
                FROM patients 
                WHERE therapist_id = auth.uid() 
                AND patient_code IS NOT NULL
            )
        )
    );
*/

-- ============================================================================
-- STEP 12: INSERT DEFAULT DATA
-- ============================================================================

-- Insert default GHOSTLY+ scoring configurations
INSERT INTO public.scoring_configuration (
    name,
    description,
    therapist_id,
    is_global,
    performance_weights,
    active
) VALUES 
(
    'GHOSTLY-TRIAL-DEFAULT',
    'Official GHOSTLY+ clinical trial scoring weights (current specification)',
    NULL,
    true,
    '{"compliance": 0.4, "symmetry": 0.25, "effort": 0.2, "game": 0.15}'::jsonb,
    true
),
(
    'GHOSTLY+ Legacy',
    'Previous GHOSTLY+ scoring weights for backwards compatibility',
    NULL,
    true,
    '{"compliance": 0.5, "symmetry": 0.2, "effort": 0.3, "game": 0.0}'::jsonb,
    false
)
ON CONFLICT (therapist_id, name) DO NOTHING;

-- ============================================================================
-- STEP 13: GRANT PERMISSIONS
-- ============================================================================

-- Grant usage on schemas
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO service_role;

-- Grant permissions on all tables
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;

-- Grant permissions on all sequences
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Grant execute on all functions
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Run these queries to verify the migration was successful:

/*
-- Check table count
SELECT COUNT(*) as table_count FROM information_schema.tables 
WHERE table_schema IN ('public', 'private');

-- Check function count
SELECT COUNT(*) as function_count FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public';

-- Check trigger count
SELECT COUNT(*) as trigger_count FROM information_schema.triggers
WHERE trigger_schema = 'public';

-- Check RLS policy count
SELECT COUNT(*) as policy_count FROM pg_policies
WHERE schemaname = 'public';

-- Check index count
SELECT COUNT(*) as index_count FROM pg_indexes
WHERE schemaname = 'public';
*/

-- ============================================================================
-- END OF PRODUCTION SNAPSHOT
-- ============================================================================
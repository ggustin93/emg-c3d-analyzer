-- Simplify RLS Policies Migration
-- Remove conflicting policies and create clean, simple ones
-- Author: Claude Code Assistant
-- Date: 2025-01-29

-- ===== DROP ALL EXISTING CONFLICTING POLICIES =====

-- Drop all existing policies for patients table
DROP POLICY IF EXISTS "Allow therapists to manage their assigned patients" ON public.patients;
DROP POLICY IF EXISTS "Researchers can view pseudonymized patient data" ON public.patients;
DROP POLICY IF EXISTS "Therapists can manage their patients" ON public.patients;
DROP POLICY IF EXISTS "admin_full_access" ON public.patients;
DROP POLICY IF EXISTS "researcher_read_patients" ON public.patients;
DROP POLICY IF EXISTS "therapist_own_patients" ON public.patients;
DROP POLICY IF EXISTS "therapist_update_treatment_config" ON public.patients;
-- Keep service role policy as it's needed for backend operations

-- Drop all existing policies for patient_medical_info table
DROP POLICY IF EXISTS "admin_access" ON public.patient_medical_info;
DROP POLICY IF EXISTS "therapist_own_patients" ON public.patient_medical_info;

-- Drop all existing policies for therapy_sessions table
DROP POLICY IF EXISTS "Allow therapists to manage sessions for assigned patients" ON public.therapy_sessions;
DROP POLICY IF EXISTS "Researchers can view session data" ON public.therapy_sessions;
DROP POLICY IF EXISTS "Therapists can manage sessions for their patients" ON public.therapy_sessions;
DROP POLICY IF EXISTS "admin_full_access" ON public.therapy_sessions;
DROP POLICY IF EXISTS "researcher_read_sessions" ON public.therapy_sessions;
DROP POLICY IF EXISTS "therapist_own_sessions" ON public.therapy_sessions;
-- Keep service role policy as it's needed for backend operations

-- ===== CREATE SIMPLIFIED POLICIES =====

-- PATIENTS TABLE: Simple, clear policies
CREATE POLICY "patients_admin_all" ON public.patients
  FOR ALL USING (get_user_role() = 'admin');

CREATE POLICY "patients_therapist_own" ON public.patients
  FOR ALL USING (
    get_user_role() = 'therapist' AND therapist_id = auth.uid()
  );

CREATE POLICY "patients_researcher_read" ON public.patients
  FOR SELECT USING (get_user_role() = 'researcher');

-- PATIENT_MEDICAL_INFO TABLE: Simple, clear policies
CREATE POLICY "patient_medical_info_admin_all" ON public.patient_medical_info
  FOR ALL USING (get_user_role() = 'admin');

CREATE POLICY "patient_medical_info_therapist_own" ON public.patient_medical_info
  FOR ALL USING (
    get_user_role() = 'therapist' AND 
    patient_id IN (
      SELECT id FROM public.patients WHERE therapist_id = auth.uid()
    )
  );

CREATE POLICY "patient_medical_info_researcher_read" ON public.patient_medical_info
  FOR SELECT USING (get_user_role() = 'researcher');

-- THERAPY_SESSIONS TABLE: Simple, clear policies
CREATE POLICY "therapy_sessions_admin_all" ON public.therapy_sessions
  FOR ALL USING (get_user_role() = 'admin');

CREATE POLICY "therapy_sessions_therapist_own" ON public.therapy_sessions
  FOR ALL USING (
    get_user_role() = 'therapist' AND 
    patient_id IN (
      SELECT id FROM public.patients WHERE therapist_id = auth.uid()
    )
  );

CREATE POLICY "therapy_sessions_researcher_read" ON public.therapy_sessions
  FOR SELECT USING (get_user_role() = 'researcher');

-- ===== COMMENTS FOR DOCUMENTATION =====

COMMENT ON POLICY "patients_admin_all" ON public.patients IS 'Admins can do everything with patients';
COMMENT ON POLICY "patients_therapist_own" ON public.patients IS 'Therapists can manage only their assigned patients';
COMMENT ON POLICY "patients_researcher_read" ON public.patients IS 'Researchers can read all patient data for analysis';

COMMENT ON POLICY "patient_medical_info_admin_all" ON public.patient_medical_info IS 'Admins can do everything with patient medical info';
COMMENT ON POLICY "patient_medical_info_therapist_own" ON public.patient_medical_info IS 'Therapists can manage medical info for their assigned patients';
COMMENT ON POLICY "patient_medical_info_researcher_read" ON public.patient_medical_info IS 'Researchers can read all patient medical info for analysis';

COMMENT ON POLICY "therapy_sessions_admin_all" ON public.therapy_sessions IS 'Admins can do everything with therapy sessions';
COMMENT ON POLICY "therapy_sessions_therapist_own" ON public.therapy_sessions IS 'Therapists can manage sessions for their assigned patients';
COMMENT ON POLICY "therapy_sessions_researcher_read" ON public.therapy_sessions IS 'Researchers can read all therapy sessions for analysis';

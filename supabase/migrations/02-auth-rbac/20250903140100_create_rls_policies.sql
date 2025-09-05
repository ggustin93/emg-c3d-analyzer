-- RLS Policies for RBAC
-- Migration: 20250903140100_create_rls_policies.sql

-- Helper function to get current user role
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS TEXT
LANGUAGE SQL
SECURITY DEFINER
AS $$
  SELECT role FROM user_profiles WHERE id = auth.uid();
$$;

-- Policy 1: Admin full access to all tables
CREATE POLICY "admin_full_access" ON user_profiles
  FOR ALL USING (get_user_role() = 'ADMIN');

CREATE POLICY "admin_full_access" ON patients  
  FOR ALL USING (get_user_role() = 'ADMIN');

CREATE POLICY "admin_full_access" ON therapy_sessions
  FOR ALL USING (get_user_role() = 'ADMIN');

CREATE POLICY "admin_full_access" ON scoring_configuration
  FOR ALL USING (get_user_role() = 'ADMIN');

CREATE POLICY "admin_full_access" ON audit_log
  FOR ALL USING (get_user_role() = 'ADMIN');

-- Policy 2: Therapist can see/modify their own patients and sessions
CREATE POLICY "therapist_own_patients" ON patients
  FOR ALL USING (
    therapist_id = auth.uid() OR get_user_role() = 'ADMIN'
  );

CREATE POLICY "therapist_own_sessions" ON therapy_sessions
  FOR ALL USING (
    patient_id IN (
      SELECT id FROM patients WHERE therapist_id = auth.uid()
    ) OR get_user_role() = 'ADMIN'
  );

-- Therapist can view their profile and update certain fields
CREATE POLICY "therapist_own_profile" ON user_profiles
  FOR SELECT USING (
    id = auth.uid() OR get_user_role() = 'ADMIN'
  );

CREATE POLICY "therapist_update_profile" ON user_profiles
  FOR UPDATE USING (
    id = auth.uid() AND get_user_role() = 'THERAPIST'
  );

-- Policy 3: Researcher read-only access (anonymized data)
CREATE POLICY "researcher_read_sessions" ON therapy_sessions
  FOR SELECT USING (get_user_role() = 'RESEARCHER');

CREATE POLICY "researcher_read_patients" ON patients
  FOR SELECT USING (get_user_role() = 'RESEARCHER');

-- Researcher can see basic user profiles (no personal info)
CREATE POLICY "researcher_read_profiles" ON user_profiles
  FOR SELECT USING (get_user_role() = 'RESEARCHER');

-- Scoring config read-only for therapist and researcher
CREATE POLICY "non_admin_read_scoring" ON scoring_configuration
  FOR SELECT USING (
    get_user_role() IN ('THERAPIST', 'RESEARCHER')
  );

-- Everyone can read their own profile
CREATE POLICY "users_own_profile" ON user_profiles
  FOR SELECT USING (id = auth.uid());

-- Create anonymized view for researchers
CREATE OR REPLACE VIEW anonymized_sessions AS
SELECT 
  id,
  session_date,
  -- Remove identifiable information
  left(patient_id::text, 8) as patient_code, -- Only show first 8 chars
  mvc_value,
  game_score,
  compliance_metrics,
  performance_score,
  created_at,
  updated_at
FROM therapy_sessions
WHERE 
  -- Only accessible by researchers and admins
  get_user_role() IN ('RESEARCHER', 'ADMIN');

-- Grant access to the view
GRANT SELECT ON anonymized_sessions TO authenticated;
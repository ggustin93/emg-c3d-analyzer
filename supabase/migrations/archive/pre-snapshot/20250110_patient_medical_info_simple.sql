-- Simple Patient Medical Info Table
-- ONLY fields from UI screenshot - KISS principle applied

CREATE TABLE public.patient_medical_info (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid UNIQUE NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  
  -- Names (for patient list display)
  first_name text NOT NULL,
  last_name text NOT NULL,
  
  -- Demographics card fields
  date_of_birth date NOT NULL,
  gender text NOT NULL,
  room_number text,
  admission_date date,
  
  -- Medical info card fields  
  primary_diagnosis text,
  mobility_status text DEFAULT 'bed_rest',
  bmi_value numeric(4,1),
  bmi_status text DEFAULT 'normal',
  cognitive_status text DEFAULT 'alert',
  
  -- Treatment summary fields
  total_sessions_planned integer DEFAULT 10,
  patient_status text DEFAULT 'active',
  
  -- Audit
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid NOT NULL REFERENCES user_profiles(id),
  updated_by uuid NOT NULL REFERENCES user_profiles(id)
);

-- RLS: Only therapists see their patients' medical data
ALTER TABLE public.patient_medical_info ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_access" ON patient_medical_info FOR ALL USING (
  (SELECT role FROM user_profiles WHERE id = auth.uid()) = 'admin'
);

CREATE POLICY "therapist_own_patients" ON patient_medical_info FOR ALL USING (
  (SELECT role FROM user_profiles WHERE id = auth.uid()) = 'therapist' 
  AND patient_id IN (SELECT id FROM patients WHERE therapist_id = auth.uid())
);

-- Simple update trigger
CREATE OR REPLACE FUNCTION update_medical_timestamp() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  NEW.updated_by = auth.uid();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER medical_updated_at 
  BEFORE UPDATE ON patient_medical_info 
  FOR EACH ROW EXECUTE FUNCTION update_medical_timestamp();
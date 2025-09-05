-- Simplify Scoring Configuration: Remove Junction Table Complexity
-- =================================================================
-- As senior backend engineers, we recognize this is over-engineered.
-- A patient only needs ONE active scoring config. YAGNI applies here.

-- Step 1: Add scoring_config_id directly to patients table
ALTER TABLE public.patients 
ADD COLUMN scoring_config_id UUID REFERENCES public.scoring_configuration(id),
ADD COLUMN scoring_config_assigned_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN scoring_config_assigned_by UUID REFERENCES public.user_profiles(id);

-- Step 2: Migrate existing data from junction table (if any exists)
UPDATE public.patients p
SET 
  scoring_config_id = psc.scoring_config_id,
  scoring_config_assigned_at = psc.assigned_at,
  scoring_config_assigned_by = psc.assigned_by
FROM public.patient_scoring_config psc
WHERE p.id = psc.patient_id 
  AND psc.active = true;

-- Step 3: Drop the over-engineered junction table
DROP TABLE IF EXISTS public.patient_scoring_config CASCADE;

-- Step 4: Simplify the function to just check patient's config
CREATE OR REPLACE FUNCTION get_patient_scoring_config(p_patient_id UUID)
RETURNS UUID AS $$
DECLARE
    v_config_id UUID;
BEGIN
    -- Direct lookup from patients table
    SELECT scoring_config_id INTO v_config_id
    FROM patients
    WHERE id = p_patient_id;
    
    -- If no patient-specific config, return global default
    IF v_config_id IS NULL THEN
        SELECT id INTO v_config_id
        FROM scoring_configuration
        WHERE is_global = true 
          AND active = true
          AND configuration_name = 'GHOSTLY+ Default'
        LIMIT 1;
    END IF;
    
    RETURN v_config_id;
END;
$$ LANGUAGE plpgsql;

-- Step 5: Create index for performance
CREATE INDEX idx_patients_scoring_config ON public.patients(scoring_config_id);

-- Step 6: Add RLS policy for scoring configuration access
CREATE POLICY "Patients can view their scoring config"
ON public.scoring_configuration FOR SELECT
USING (
  id IN (
    SELECT scoring_config_id FROM patients WHERE id = auth.uid()
  )
  OR is_global = true
);

-- Step 7: Create audit trigger for historical tracking (if needed later)
CREATE OR REPLACE FUNCTION log_scoring_config_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.scoring_config_id IS DISTINCT FROM NEW.scoring_config_id THEN
    -- Log to audit table or JSONB field when we need it
    -- For now, just track the assignment timestamp
    NEW.scoring_config_assigned_at = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER scoring_config_change_trigger
BEFORE UPDATE ON patients
FOR EACH ROW
EXECUTE FUNCTION log_scoring_config_change();

-- Comments explaining the simplified design
COMMENT ON COLUMN patients.scoring_config_id IS 
'Direct reference to patient-specific scoring configuration. NULL means use global default.';

COMMENT ON COLUMN patients.scoring_config_assigned_at IS 
'When the scoring configuration was last changed for this patient.';

COMMENT ON COLUMN patients.scoring_config_assigned_by IS 
'Therapist who assigned the current scoring configuration.';
-- Remove therapist_id from scoring_configuration
-- ================================================
-- We don't need therapist_id anymore since we have patient_scoring_config
-- for more flexible patient-specific configuration assignments

-- Drop the unique constraint that uses therapist_id
ALTER TABLE public.scoring_configuration 
DROP CONSTRAINT IF EXISTS unique_therapist_config;

-- Drop the foreign key constraint
ALTER TABLE public.scoring_configuration 
DROP CONSTRAINT IF EXISTS scoring_configuration_therapist_id_fkey;

-- Drop the index on therapist_id
DROP INDEX IF EXISTS idx_scoring_configuration_therapist_id;

-- Finally, drop the therapist_id column
ALTER TABLE public.scoring_configuration 
DROP COLUMN IF EXISTS therapist_id;

-- Add a unique index on configuration_name for global configs
-- This ensures we don't have duplicate global configuration names
CREATE UNIQUE INDEX unique_global_config_name 
ON public.scoring_configuration(configuration_name) 
WHERE is_global = true;

-- Update the get_patient_scoring_config function to remove therapist logic
CREATE OR REPLACE FUNCTION get_patient_scoring_config(p_patient_id UUID)
RETURNS UUID AS $$
DECLARE
    v_config_id UUID;
BEGIN
    -- Priority 1: Check for active patient-specific configuration
    SELECT scoring_config_id INTO v_config_id
    FROM patient_scoring_config
    WHERE patient_id = p_patient_id AND active = true
    LIMIT 1;
    
    IF v_config_id IS NOT NULL THEN
        RETURN v_config_id;
    END IF;
    
    -- Priority 2: Return global default configuration
    -- (Removed therapist-specific logic since we no longer have therapist_id)
    SELECT id INTO v_config_id
    FROM scoring_configuration
    WHERE is_global = true AND active = true
    AND configuration_name = 'GHOSTLY+ Default'
    LIMIT 1;
    
    RETURN v_config_id; -- May be NULL if no global config exists
END;
$$ LANGUAGE plpgsql;

-- Add comment explaining the new structure
COMMENT ON TABLE scoring_configuration IS 
'Scoring weight configurations for performance assessment. Global configurations (is_global=true) are system-wide defaults. Patient-specific assignments are managed through patient_scoring_config junction table.';

COMMENT ON COLUMN scoring_configuration.is_global IS 
'Whether this is a global system configuration (true) or a custom configuration that can be assigned to specific patients (false)';
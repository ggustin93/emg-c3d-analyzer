-- Function: get_patient_scoring_config
-- Type: FUNCTION
-- Returns: uuid
-- Arguments: p_patient_id uuid
-- Purpose: Retrieves data based on current context

CREATE OR REPLACE FUNCTION public.get_patient_scoring_config(
    p_patient_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
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
    SELECT id INTO v_config_id
    FROM scoring_configuration
    WHERE is_global = true AND active = true
    AND configuration_name = 'GHOSTLY+ Default'
    LIMIT 1;
    
    RETURN v_config_id;
END;
$$;

-- Example usage:
-- SELECT get_patient_scoring_config(...);

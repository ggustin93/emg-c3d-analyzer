-- Function: get_session_scoring_config
-- Type: FUNCTION
-- Returns: uuid
-- Arguments: p_session_id uuid, p_patient_id uuid
-- Purpose: Retrieves data based on current context

CREATE OR REPLACE FUNCTION public.get_session_scoring_config(
    p_session_id uuid, p_patient_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_config_id uuid;
BEGIN
    -- Priority 1: Check if session already has a scoring_config_id (immutable for historical accuracy)
    IF p_session_id IS NOT NULL THEN
        SELECT scoring_config_id INTO v_config_id
        FROM public.therapy_sessions
        WHERE id = p_session_id
        LIMIT 1;
        
        IF v_config_id IS NOT NULL THEN
            RETURN v_config_id;
        END IF;
    END IF;
    
    -- Priority 2: Check patient's current scoring configuration
    IF p_patient_id IS NOT NULL THEN
        SELECT current_scoring_config_id INTO v_config_id
        FROM public.patients
        WHERE id = p_patient_id
        LIMIT 1;
        
        IF v_config_id IS NOT NULL THEN
            RETURN v_config_id;
        END IF;
    END IF;
    
    -- Priority 3: Get the active global default (GHOSTLY-TRIAL-DEFAULT)
    SELECT id INTO v_config_id
    FROM public.scoring_configuration
    WHERE name = 'GHOSTLY-TRIAL-DEFAULT' 
        AND active = true
    ORDER BY created_at DESC
    LIMIT 1;
    
    IF v_config_id IS NOT NULL THEN
        RETURN v_config_id;
    END IF;
    
    -- Priority 4: Get any active configuration as last resort
    SELECT id INTO v_config_id
    FROM public.scoring_configuration
    WHERE active = true
    ORDER BY created_at DESC
    LIMIT 1;
    
    RETURN v_config_id;
END;
$$;

-- Example usage:
-- SELECT get_session_scoring_config(...);

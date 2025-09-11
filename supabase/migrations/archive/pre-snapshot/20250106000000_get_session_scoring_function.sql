-- Create function to get appropriate scoring configuration for a session
-- Priority: Session config → Patient config → Global default

CREATE OR REPLACE FUNCTION public.get_session_scoring_config(
    p_session_id uuid DEFAULT NULL,
    p_patient_id uuid DEFAULT NULL
)
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

-- Grant execute permission to service role and authenticated users
GRANT EXECUTE ON FUNCTION public.get_session_scoring_config TO service_role;
GRANT EXECUTE ON FUNCTION public.get_session_scoring_config TO authenticated;

-- Add comment for documentation
COMMENT ON FUNCTION public.get_session_scoring_config IS 
    'Get the appropriate scoring configuration for a therapy session. '
    'Priority: Session config → Patient config → Global default → Any active config. '
    'Returns NULL only if no scoring configurations exist in the database.';
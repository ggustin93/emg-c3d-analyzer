-- Fix: Update get_session_scoring_config function to use correct column name
-- The scoring_configuration table has 'configuration_name' column, not 'name'
-- This was causing "column 'name' does not exist" error

CREATE OR REPLACE FUNCTION public.get_session_scoring_config(
    p_session_id uuid DEFAULT NULL::uuid, 
    p_patient_id uuid DEFAULT NULL::uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
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
    -- FIX: Changed 'name' to 'configuration_name' to match actual column name in scoring_configuration table
    SELECT id INTO v_config_id
    FROM public.scoring_configuration
    WHERE configuration_name = 'GHOSTLY-TRIAL-DEFAULT' 
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
$function$;
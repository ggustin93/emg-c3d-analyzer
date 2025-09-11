-- Function: set_session_therapeutic_targets
-- Type: FUNCTION
-- Returns: boolean
-- Arguments: p_session_id uuid, p_target_mvc_ch1 double precision, p_target_mvc_ch2 double precision, p_target_duration_ch1 double precision, p_target_duration_ch2 double precision

CREATE OR REPLACE FUNCTION public.set_session_therapeutic_targets(
    p_session_id uuid, p_target_mvc_ch1 double precision, p_target_mvc_ch2 double precision, p_target_duration_ch1 double precision, p_target_duration_ch2 double precision)
RETURNS boolean
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

-- Example usage:
-- SELECT set_session_therapeutic_targets(...);

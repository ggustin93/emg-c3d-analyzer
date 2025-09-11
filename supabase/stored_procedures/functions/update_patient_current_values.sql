-- Function: update_patient_current_values
-- Type: FUNCTION
-- Returns: boolean
-- Arguments: p_patient_id uuid, p_mvc_ch1 double precision, p_mvc_ch2 double precision, p_duration_ch1 double precision, p_duration_ch2 double precision

CREATE OR REPLACE FUNCTION public.update_patient_current_values(
    p_patient_id uuid, p_mvc_ch1 double precision, p_mvc_ch2 double precision, p_duration_ch1 double precision, p_duration_ch2 double precision)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE public.patients 
    SET 
        current_mvc_ch1 = COALESCE(p_mvc_ch1, current_mvc_ch1),
        current_mvc_ch2 = COALESCE(p_mvc_ch2, current_mvc_ch2),
        current_duration_ch1 = COALESCE(p_duration_ch1, current_duration_ch1),
        current_duration_ch2 = COALESCE(p_duration_ch2, current_duration_ch2),
        last_assessment_date = NOW(),
        updated_at = NOW()
    WHERE id = p_patient_id;
    
    RETURN FOUND;
END;
$$;

-- Example usage:
-- SELECT update_patient_current_values('uuid-here', 80.5, 75.0, 3000, 2500);

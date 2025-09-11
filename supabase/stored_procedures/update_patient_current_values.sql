-- Function: update_patient_current_values
-- Purpose: Updates patient current MVC and duration values after therapist assessment
-- Used for: Tracking baseline capabilities
-- Parameters:
--   p_patient_id UUID - Patient ID
--   p_mvc_ch1 DOUBLE PRECISION - MVC value for channel 1
--   p_mvc_ch2 DOUBLE PRECISION - MVC value for channel 2
--   p_duration_ch1 DOUBLE PRECISION - Duration for channel 1
--   p_duration_ch2 DOUBLE PRECISION - Duration for channel 2
-- Returns: BOOLEAN - true if update successful

CREATE OR REPLACE FUNCTION public.update_patient_current_values(
    p_patient_id uuid,
    p_mvc_ch1 double precision DEFAULT NULL,
    p_mvc_ch2 double precision DEFAULT NULL,
    p_duration_ch1 double precision DEFAULT NULL,
    p_duration_ch2 double precision DEFAULT NULL
)
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

-- Comment
COMMENT ON FUNCTION public.update_patient_current_values IS 
    'Updates patient current MVC and duration values after therapist assessment. Used for tracking baseline capabilities.';

-- Permissions
GRANT EXECUTE ON FUNCTION public.update_patient_current_values TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_patient_current_values TO service_role;
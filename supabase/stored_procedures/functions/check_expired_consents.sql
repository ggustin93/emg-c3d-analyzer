-- Function: check_expired_consents
-- Type: FUNCTION
-- Returns: void

CREATE OR REPLACE FUNCTION public.check_expired_consents()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE public.patient_medical_info 
    SET 
        consent_for_research = false,
        consent_for_data_sharing = false
    WHERE consent_expires_at < now() 
        AND (consent_for_research = true OR consent_for_data_sharing = true);
END;
$$;

-- Example usage:
-- SELECT check_expired_consents();

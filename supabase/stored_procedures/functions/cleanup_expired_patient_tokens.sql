-- Function: cleanup_expired_patient_tokens
-- Type: FUNCTION
-- Returns: integer

CREATE OR REPLACE FUNCTION public.cleanup_expired_patient_tokens()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM private.patient_auth_tokens 
    WHERE expires_at < NOW() - INTERVAL '1 hour'; -- Grace period
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$;

-- Example usage:
-- SELECT cleanup_expired_patient_tokens();

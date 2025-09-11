-- Function: is_assigned_to_patient
-- Type: FUNCTION
-- Returns: boolean
-- Arguments: p_code text
-- Purpose: Authorization check

CREATE OR REPLACE FUNCTION public.is_assigned_to_patient(
    p_code text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN public.user_owns_patient(p_code);
END;
$$;

-- Example usage:
-- SELECT is_assigned_to_patient(...);

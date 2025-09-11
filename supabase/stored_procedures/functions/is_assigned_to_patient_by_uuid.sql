-- Function: is_assigned_to_patient
-- Type: FUNCTION
-- Returns: boolean
-- Arguments: patient_uuid uuid
-- Purpose: Authorization check

CREATE OR REPLACE FUNCTION public.is_assigned_to_patient(
    patient_uuid uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    is_assigned BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1
        FROM public.patients
        WHERE id = patient_uuid AND therapist_id = public.get_current_therapist_id()
    ) INTO is_assigned;
    RETURN is_assigned;
END;
$$;

-- Example usage:
-- SELECT is_assigned_to_patient(...);

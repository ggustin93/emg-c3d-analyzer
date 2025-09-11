-- Function: is_therapist_for_patient
-- Type: FUNCTION
-- Returns: boolean
-- Arguments: patient_uuid uuid
-- Purpose: Authorization check

CREATE OR REPLACE FUNCTION public.is_therapist_for_patient(
    patient_uuid uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.patients 
        WHERE id = patient_uuid AND therapist_id = auth.uid()
    );
END;
$$;

-- Example usage:
-- SELECT is_therapist_for_patient(...);

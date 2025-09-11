-- Function: user_owns_patient
-- Purpose: Checks if the current therapist owns/is assigned to a patient
-- Parameters: p_code TEXT - The patient code (e.g., 'P001')
-- Returns: BOOLEAN - true if therapist owns patient, false otherwise
-- Used in: Storage RLS policies, API authorization checks

CREATE OR REPLACE FUNCTION public.user_owns_patient(p_code TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    current_therapist_id UUID;
BEGIN
    -- Use the same logic as get_current_therapist_id for consistency
    SELECT id INTO current_therapist_id
    FROM public.user_profiles
    WHERE id = auth.uid()
    AND role = 'therapist'
    AND active = true
    LIMIT 1;

    -- If no valid therapist found, return false
    IF current_therapist_id IS NULL THEN
        RETURN FALSE;
    END IF;

    -- Check if the current therapist owns the patient
    RETURN EXISTS (
        SELECT 1
        FROM public.patients p
        WHERE p.patient_code = p_code
          AND p.therapist_id = current_therapist_id
    );
END;
$$;

-- Permissions
GRANT EXECUTE ON FUNCTION public.user_owns_patient(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_owns_patient(TEXT) TO service_role;
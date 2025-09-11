-- Function: user_owns_patient
-- Type: FUNCTION
-- Returns: boolean
-- Arguments: p_code text
-- Purpose: Authorization check

CREATE OR REPLACE FUNCTION public.user_owns_patient(
    p_code text)
RETURNS boolean
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

-- Example usage:
-- SELECT user_owns_patient('P001');

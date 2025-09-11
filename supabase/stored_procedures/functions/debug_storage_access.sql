-- Function: debug_storage_access
-- Type: FUNCTION
-- Returns: json
-- Arguments: file_path text

CREATE OR REPLACE FUNCTION public.debug_storage_access(
    file_path text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
  DECLARE
      patient_code TEXT;
      current_user_id UUID;
      therapist_id UUID;
      owns_patient BOOLEAN;
      result JSON;
  BEGIN
      -- Extract patient code from path
      patient_code := split_part(file_path, '/', 1);

      -- Get current auth context
      current_user_id := auth.uid();

      -- Get therapist ID using same logic as get_current_therapist_id
      SELECT id INTO therapist_id
      FROM public.user_profiles
      WHERE id = current_user_id
      AND role = 'therapist'
      AND active = true
      LIMIT 1;

      -- Test ownership
      owns_patient := public.user_owns_patient(patient_code);

      -- Build debug result
      SELECT json_build_object(
          'file_path', file_path,
          'patient_code', patient_code,
          'current_user_id', current_user_id,
          'therapist_id', therapist_id,
          'owns_patient', owns_patient,
          'auth_context_valid', (current_user_id IS NOT NULL),
          'therapist_profile_found', (therapist_id IS NOT NULL)
      ) INTO result;

      RETURN result;
  END;
  $$;

-- Example usage:
-- SELECT debug_storage_access(...);

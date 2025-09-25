-- Simple RPC function to get patient-therapist relationships
-- This bypasses RLS and returns the data directly

CREATE OR REPLACE FUNCTION get_patient_therapists(patient_codes TEXT[])
RETURNS TABLE (
  patient_code TEXT,
  therapist_id UUID,
  therapist_first_name TEXT,
  therapist_last_name TEXT,
  therapist_user_code TEXT,
  therapist_display_name TEXT
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- Only allow authenticated users to call this function
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  RETURN QUERY
  SELECT 
    p.patient_code,
    p.therapist_id,
    up.first_name as therapist_first_name,
    up.last_name as therapist_last_name,
    up.user_code as therapist_user_code,
    CASE 
      WHEN up.first_name IS NOT NULL AND up.last_name IS NOT NULL 
      THEN up.first_name || ' ' || up.last_name
      ELSE COALESCE(up.user_code, 'Therapist ' || SUBSTRING(up.id::text, 1, 8))
    END as therapist_display_name
  FROM patients p
  INNER JOIN user_profiles up ON p.therapist_id = up.id
  WHERE p.patient_code = ANY(patient_codes)
    AND up.role = 'therapist'
    AND p.active = true;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_patient_therapists(TEXT[]) TO authenticated;

-- Add comment for documentation
COMMENT ON FUNCTION get_patient_therapists(TEXT[]) IS 'Get patient-therapist relationships for given patient codes';

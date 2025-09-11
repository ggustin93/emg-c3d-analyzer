-- Function: get_current_therapist_id
-- Type: FUNCTION
-- Returns: uuid
-- Purpose: Retrieves data based on current context

CREATE OR REPLACE FUNCTION public.get_current_therapist_id()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    therapist_uuid UUID;
BEGIN
    -- Query the user_profiles table as per the current schema
    SELECT id INTO therapist_uuid
    FROM public.user_profiles
    WHERE id = auth.uid() 
    AND role = 'therapist'
    AND active = true
    LIMIT 1;
    
    RETURN therapist_uuid;
END;
$$;

-- Example usage:
-- SELECT get_current_therapist_id();

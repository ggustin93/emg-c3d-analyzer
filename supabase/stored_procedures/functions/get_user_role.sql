-- Function: get_user_role
-- Type: FUNCTION
-- Returns: text
-- Purpose: Retrieves data based on current context

CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN COALESCE(
        (SELECT role FROM public.user_profiles WHERE id = auth.uid()),
        'anonymous'
    );
END;
$$;

-- Example usage:
-- SELECT get_user_role();

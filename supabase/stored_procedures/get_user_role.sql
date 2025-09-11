-- Function: get_user_role
-- Purpose: Returns the role of the current authenticated user
-- Returns: TEXT (therapist, admin, researcher, or anonymous)
-- Used in: RLS policies for role-based access control

CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS TEXT
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

-- Permissions
GRANT EXECUTE ON FUNCTION public.get_user_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_role() TO service_role;
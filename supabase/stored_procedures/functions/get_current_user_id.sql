-- Function: get_current_user_id
-- Type: FUNCTION
-- Returns: uuid
-- Purpose: Retrieves data based on current context

CREATE OR REPLACE FUNCTION public.get_current_user_id()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN auth.uid();
END;
$$;

-- Example usage:
-- SELECT get_current_user_id();

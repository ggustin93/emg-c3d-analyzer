-- Create RPC function to safely join auth.users with user_profiles
-- This allows admin users to retrieve user emails without direct auth.users access
CREATE OR REPLACE FUNCTION get_users_with_emails()
RETURNS TABLE (
  id UUID,
  email TEXT,
  role TEXT,
  first_name TEXT,
  last_name TEXT,
  institution TEXT,
  department TEXT,
  access_level TEXT,
  active BOOLEAN,
  created_at TIMESTAMPTZ,
  last_sign_in_at TIMESTAMPTZ,
  user_code TEXT
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
  
  -- Further restrict to admin users only
  IF NOT EXISTS (
    SELECT 1 FROM user_profiles 
    WHERE user_profiles.id = auth.uid() AND user_profiles.role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Insufficient permissions';
  END IF;

  RETURN QUERY
  SELECT 
    up.id,
    au.email,
    up.role,
    up.first_name,
    up.last_name,
    up.institution,
    up.department,
    up.access_level,
    up.active,
    up.created_at,
    au.last_sign_in_at,
    up.user_code
  FROM user_profiles up
  LEFT JOIN auth.users au ON up.id = au.id
  ORDER BY up.created_at DESC;
END;
$$;

-- Grant execute permission to authenticated users (function checks admin role internally)
GRANT EXECUTE ON FUNCTION get_users_with_emails() TO authenticated;

-- Add comment for documentation
COMMENT ON FUNCTION get_users_with_emails() IS 'Admin-only function to retrieve user profiles with email addresses from auth.users';
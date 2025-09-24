-- Create temporary_passwords table for secure password vault functionality
-- This table stores encrypted temporary passwords for manual admin delivery

CREATE TABLE temporary_passwords (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_email TEXT NOT NULL,
  user_first_name TEXT,
  user_last_name TEXT,
  password_encrypted TEXT NOT NULL,
  masked_password TEXT NOT NULL, -- First/last 2 chars for verification (e.g., "Te****xt")
  delivery_method TEXT DEFAULT 'manual',
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  retrieved_at TIMESTAMPTZ NULL,
  retrieved_by UUID NULL REFERENCES auth.users(id),
  admin_note TEXT
);

-- Create indexes for performance
CREATE INDEX idx_temporary_passwords_user_id ON temporary_passwords(user_id);
CREATE INDEX idx_temporary_passwords_expires_at ON temporary_passwords(expires_at);
CREATE INDEX idx_temporary_passwords_retrieved_at ON temporary_passwords(retrieved_at);
CREATE INDEX idx_temporary_passwords_created_by ON temporary_passwords(created_by);

-- Enable Row Level Security
ALTER TABLE temporary_passwords ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Only admins can access temporary passwords
CREATE POLICY "Admins can manage temporary passwords"
ON temporary_passwords
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM user_profiles 
    WHERE id = auth.uid() 
    AND role = 'admin'
  )
);

-- Create a function to automatically clean up expired passwords
CREATE OR REPLACE FUNCTION cleanup_expired_passwords()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  -- Delete passwords that expired more than 24 hours ago
  DELETE FROM temporary_passwords
  WHERE expires_at < (now() - interval '24 hours');
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  RETURN deleted_count;
END;
$$;

-- Create audit trigger for password operations
CREATE OR REPLACE FUNCTION audit_password_retrieval()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Log password retrieval to audit table
  INSERT INTO audit_log (
    user_id,
    user_role,
    action,
    table_name,
    record_id,
    changes,
    created_at
  ) VALUES (
    auth.uid(),
    'admin',
    'password_retrieved',
    'temporary_passwords',
    NEW.id::text,
    jsonb_build_object(
      'user_email', NEW.user_email,
      'retrieved_at', NEW.retrieved_at,
      'delivery_method', NEW.delivery_method
    ),
    now()
  );
  
  RETURN NEW;
END;
$$;

-- Create trigger for password retrieval auditing
CREATE TRIGGER trigger_audit_password_retrieval
  AFTER UPDATE OF retrieved_at ON temporary_passwords
  FOR EACH ROW
  WHEN (OLD.retrieved_at IS NULL AND NEW.retrieved_at IS NOT NULL)
  EXECUTE FUNCTION audit_password_retrieval();

-- Add comment explaining the security model
COMMENT ON TABLE temporary_passwords IS 'Stores encrypted temporary passwords for manual admin delivery. Passwords expire after 24 hours and can only be retrieved once by admins.';

-- Grant necessary permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON temporary_passwords TO authenticated;
GRANT EXECUTE ON FUNCTION cleanup_expired_passwords() TO authenticated;
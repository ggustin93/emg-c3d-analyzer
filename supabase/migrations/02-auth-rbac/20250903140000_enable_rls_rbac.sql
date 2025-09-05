-- Enable Row Level Security for RBAC
-- Migration: 20250903140000_enable_rls_rbac.sql

-- Enable RLS on main tables
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE therapy_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE scoring_configuration ENABLE ROW LEVEL SECURITY;

-- Create audit log table for compliance
CREATE TABLE IF NOT EXISTS audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  user_id UUID REFERENCES auth.users(id),
  user_role TEXT,
  action TEXT NOT NULL,
  table_name TEXT NOT NULL,
  record_id UUID,
  changes JSONB,
  ip_address INET,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add index for audit queries
CREATE INDEX idx_audit_log_timestamp ON audit_log(timestamp DESC);
CREATE INDEX idx_audit_log_user_id ON audit_log(user_id);
CREATE INDEX idx_audit_log_table_action ON audit_log(table_name, action);

-- Enable RLS on audit_log (admins only)
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
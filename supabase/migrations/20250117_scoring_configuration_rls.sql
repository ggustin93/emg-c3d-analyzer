-- Migration: Scoring Configuration RLS Policies
-- Purpose: Ensure admin-only write access during clinical trial
-- Date: 2025-01-17
-- Author: Clinical Trial System

-- ============================================
-- 1. Enable RLS on scoring_configuration table
-- ============================================
ALTER TABLE public.scoring_configuration ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 2. Drop existing policies to ensure clean state
-- ============================================
DROP POLICY IF EXISTS "All users can view scoring configurations" ON public.scoring_configuration;
DROP POLICY IF EXISTS "Admins can manage scoring configurations" ON public.scoring_configuration;
DROP POLICY IF EXISTS "admin_full_access" ON public.scoring_configuration;
DROP POLICY IF EXISTS "non_admin_read_scoring" ON public.scoring_configuration;

-- ============================================
-- 3. Create function to get user role (if not exists)
-- ============================================
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT COALESCE(
    (SELECT role FROM public.user_profiles WHERE id = auth.uid()),
    'anonymous'
  )
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.get_user_role() TO authenticated;

-- ============================================
-- 4. Create READ policies (all authenticated users)
-- ============================================

-- Policy: All authenticated users can view all scoring configurations
CREATE POLICY "authenticated_users_read_scoring_configs"
ON public.scoring_configuration
FOR SELECT
TO authenticated
USING (true);

COMMENT ON POLICY "authenticated_users_read_scoring_configs" ON public.scoring_configuration IS 
'All authenticated users (therapists, researchers, admins) can view scoring configurations for transparency';

-- ============================================
-- 5. Create WRITE policies (admin-only during trial)
-- ============================================

-- Policy: Only admins can insert new scoring configurations
CREATE POLICY "admins_insert_scoring_configs"
ON public.scoring_configuration
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 
    FROM public.user_profiles 
    WHERE id = auth.uid() 
    AND role = 'admin'
    AND active = true
  )
);

COMMENT ON POLICY "admins_insert_scoring_configs" ON public.scoring_configuration IS 
'During clinical trial, only active admin users can create new scoring configurations';

-- Policy: Only admins can update scoring configurations
CREATE POLICY "admins_update_scoring_configs"
ON public.scoring_configuration
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 
    FROM public.user_profiles 
    WHERE id = auth.uid() 
    AND role = 'admin'
    AND active = true
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 
    FROM public.user_profiles 
    WHERE id = auth.uid() 
    AND role = 'admin'
    AND active = true
  )
);

COMMENT ON POLICY "admins_update_scoring_configs" ON public.scoring_configuration IS 
'During clinical trial, only active admin users can update scoring configurations including GHOSTLY-TRIAL-DEFAULT';

-- Policy: Only admins can delete scoring configurations (except protected ones)
CREATE POLICY "admins_delete_scoring_configs"
ON public.scoring_configuration
FOR DELETE
TO authenticated
USING (
  -- Admin check
  EXISTS (
    SELECT 1 
    FROM public.user_profiles 
    WHERE id = auth.uid() 
    AND role = 'admin'
    AND active = true
  )
  AND
  -- Protect GHOSTLY-TRIAL-DEFAULT from deletion
  id != 'a0000000-0000-0000-0000-000000000001'
);

COMMENT ON POLICY "admins_delete_scoring_configs" ON public.scoring_configuration IS 
'Admins can delete configurations except GHOSTLY-TRIAL-DEFAULT which is protected';

-- ============================================
-- 6. Create service role bypass policy
-- ============================================

-- Policy: Service role (backend) has full access
CREATE POLICY "service_role_full_access"
ON public.scoring_configuration
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

COMMENT ON POLICY "service_role_full_access" ON public.scoring_configuration IS 
'Backend service with service_role key has unrestricted access for system operations';

-- ============================================
-- 7. Ensure GHOSTLY-TRIAL-DEFAULT exists
-- ============================================

-- Insert GHOSTLY-TRIAL-DEFAULT if it doesn't exist
INSERT INTO public.scoring_configuration (
  id,
  configuration_name,
  description,
  weight_compliance,
  weight_symmetry,
  weight_effort,
  weight_game,
  weight_completion,
  weight_intensity,
  weight_duration,
  is_global,
  active,
  created_at,
  updated_at
)
VALUES (
  'a0000000-0000-0000-0000-000000000001'::uuid,
  'GHOSTLY-TRIAL-DEFAULT',
  'Default scoring configuration for GHOSTLY+ clinical trial. All patients use this configuration.',
  0.50,  -- 50% compliance (from metricsDefinitions.md)
  0.25,  -- 25% symmetry
  0.25,  -- 25% effort
  0.00,  -- 0% game (game-dependent)
  0.333, -- Equal weight for completion
  0.333, -- Equal weight for intensity
  0.334, -- Equal weight for duration (sum = 1.0)
  true,  -- This is a global configuration
  true,  -- Set as active by default
  NOW(),
  NOW()
)
ON CONFLICT (id) DO UPDATE SET
  updated_at = NOW(),
  description = EXCLUDED.description
WHERE scoring_configuration.id = 'a0000000-0000-0000-0000-000000000001';

-- ============================================
-- 8. Create audit trigger for scoring changes
-- ============================================

-- Create audit function for scoring configuration changes
CREATE OR REPLACE FUNCTION public.audit_scoring_configuration_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Only audit UPDATE and DELETE operations
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    INSERT INTO public.audit_log (
      user_id,
      user_role,
      action,
      table_name,
      record_id,
      changes,
      timestamp
    )
    VALUES (
      auth.uid(),
      get_user_role(),
      TG_OP,
      TG_TABLE_NAME,
      COALESCE(OLD.id, NEW.id),
      jsonb_build_object(
        'old', to_jsonb(OLD),
        'new', to_jsonb(NEW),
        'configuration_name', COALESCE(OLD.configuration_name, NEW.configuration_name)
      ),
      NOW()
    );
  END IF;
  
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$;

-- Create trigger for audit logging
DROP TRIGGER IF EXISTS audit_scoring_configuration_trigger ON public.scoring_configuration;
CREATE TRIGGER audit_scoring_configuration_trigger
AFTER UPDATE OR DELETE
ON public.scoring_configuration
FOR EACH ROW
EXECUTE FUNCTION public.audit_scoring_configuration_changes();

-- ============================================
-- 9. Add helpful comments
-- ============================================

COMMENT ON TABLE public.scoring_configuration IS 
'Scoring weight configurations for performance assessment. GHOSTLY-TRIAL-DEFAULT (id: a0000000-0000-0000-0000-000000000001) is the protected default configuration used during clinical trial.';

COMMENT ON COLUMN public.scoring_configuration.configuration_name IS 
'Unique name for the configuration. GHOSTLY-TRIAL-DEFAULT is the system default.';

COMMENT ON COLUMN public.scoring_configuration.is_global IS 
'True for system-wide configurations like GHOSTLY-TRIAL-DEFAULT, false for custom configurations.';

-- ============================================
-- 10. Create helper view for frontend
-- ============================================

CREATE OR REPLACE VIEW public.scoring_configuration_with_permissions AS
SELECT 
  sc.*,
  CASE 
    WHEN up.role = 'admin' THEN true
    ELSE false
  END AS can_edit,
  CASE
    WHEN sc.id = 'a0000000-0000-0000-0000-000000000001' THEN true
    ELSE false
  END AS is_default
FROM public.scoring_configuration sc
LEFT JOIN public.user_profiles up ON up.id = auth.uid()
WHERE up.active = true OR up.id IS NULL;

COMMENT ON VIEW public.scoring_configuration_with_permissions IS 
'View that includes edit permissions for the current user and identifies the default configuration';

-- Grant access to the view
GRANT SELECT ON public.scoring_configuration_with_permissions TO authenticated;

-- ============================================
-- 11. Validation: Ensure policies are working
-- ============================================

-- Test query to verify RLS is enabled and policies exist
DO $$
DECLARE
  rls_enabled boolean;
  policy_count integer;
BEGIN
  -- Check if RLS is enabled
  SELECT relrowsecurity INTO rls_enabled
  FROM pg_class
  WHERE relname = 'scoring_configuration'
  AND relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');
  
  IF NOT rls_enabled THEN
    RAISE EXCEPTION 'RLS is not enabled on scoring_configuration table';
  END IF;
  
  -- Count policies
  SELECT COUNT(*) INTO policy_count
  FROM pg_policies
  WHERE tablename = 'scoring_configuration'
  AND schemaname = 'public';
  
  IF policy_count < 5 THEN
    RAISE WARNING 'Expected at least 5 policies, found %', policy_count;
  END IF;
  
  RAISE NOTICE 'RLS migration completed successfully with % policies', policy_count;
END $$;

-- ============================================
-- 12. Future enhancement placeholder
-- ============================================

-- Note: After clinical trial, modify policies to allow therapists to create
-- patient-specific configurations by updating the INSERT and UPDATE policies:
-- AND role IN ('admin', 'therapist')

-- For now, this is commented out to maintain admin-only access during trial
-- UPDATE: To enable therapist access after trial, run:
-- ALTER POLICY "admins_insert_scoring_configs" ON public.scoring_configuration
-- RENAME TO "admins_and_therapists_insert_scoring_configs";
-- 
-- ALTER POLICY "admins_and_therapists_insert_scoring_configs" ON public.scoring_configuration
-- WITH CHECK (
--   EXISTS (
--     SELECT 1 
--     FROM public.user_profiles 
--     WHERE id = auth.uid() 
--     AND role IN ('admin', 'therapist')
--     AND active = true
--   )
-- );
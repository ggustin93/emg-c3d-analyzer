-- Function: update_c3d_metadata_updated_at
-- Type: TRIGGER
-- Returns: trigger
-- Purpose: Automatically updates timestamp fields

CREATE OR REPLACE FUNCTION public.update_c3d_metadata_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

-- Trigger usage:
-- CREATE TRIGGER trigger_name
-- BEFORE INSERT OR UPDATE ON table_name
-- FOR EACH ROW EXECUTE FUNCTION update_c3d_metadata_updated_at();

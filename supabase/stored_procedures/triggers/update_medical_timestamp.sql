-- Function: update_medical_timestamp
-- Type: TRIGGER
-- Returns: trigger
-- Purpose: Automatically updates timestamp fields

CREATE OR REPLACE FUNCTION public.update_medical_timestamp()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  NEW.updated_at = now();
  NEW.updated_by = auth.uid();
  RETURN NEW;
END;
$$;

-- Trigger usage:
-- CREATE TRIGGER trigger_name
-- BEFORE INSERT OR UPDATE ON table_name
-- FOR EACH ROW EXECUTE FUNCTION update_medical_timestamp();

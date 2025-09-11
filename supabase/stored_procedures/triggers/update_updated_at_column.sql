-- Function: update_updated_at_column
-- Type: TRIGGER
-- Returns: trigger
-- Purpose: Automatically updates timestamp fields

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
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
-- FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

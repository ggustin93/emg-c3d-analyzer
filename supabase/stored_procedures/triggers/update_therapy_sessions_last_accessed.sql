-- Function: update_therapy_sessions_last_accessed
-- Type: TRIGGER
-- Returns: trigger
-- Purpose: Automatically updates timestamp fields

CREATE OR REPLACE FUNCTION public.update_therapy_sessions_last_accessed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    NEW.last_accessed_at = NOW();
    RETURN NEW;
END;
$$;

-- Trigger usage:
-- CREATE TRIGGER trigger_name
-- BEFORE INSERT OR UPDATE ON table_name
-- FOR EACH ROW EXECUTE FUNCTION update_therapy_sessions_last_accessed();

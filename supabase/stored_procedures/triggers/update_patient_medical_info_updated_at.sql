-- Function: update_patient_medical_info_updated_at
-- Type: TRIGGER
-- Returns: trigger
-- Purpose: Automatically updates timestamp fields

CREATE OR REPLACE FUNCTION public.update_patient_medical_info_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    NEW.updated_at = now();
    -- Only update updated_by if we have an authenticated user
    IF auth.uid() IS NOT NULL THEN
        NEW.updated_by = auth.uid();
    END IF;
    RETURN NEW;
END;
$$;

-- Trigger usage:
-- CREATE TRIGGER trigger_name
-- BEFORE INSERT OR UPDATE ON table_name
-- FOR EACH ROW EXECUTE FUNCTION update_patient_medical_info_updated_at();

-- Function: audit_patient_scoring_config_change
-- Type: TRIGGER
-- Returns: trigger

CREATE OR REPLACE FUNCTION public.audit_patient_scoring_config_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    IF OLD.current_scoring_config_id IS DISTINCT FROM NEW.current_scoring_config_id THEN
        NEW.scoring_config_updated_at = NOW();
        -- Note: scoring_config_updated_by should be set by the application
    END IF;
    RETURN NEW;
END;
$$;

-- Trigger usage:
-- CREATE TRIGGER trigger_name
-- BEFORE INSERT OR UPDATE ON table_name
-- FOR EACH ROW EXECUTE FUNCTION audit_patient_scoring_config_change();

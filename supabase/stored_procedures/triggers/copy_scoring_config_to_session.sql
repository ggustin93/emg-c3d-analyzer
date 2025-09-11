-- Function: copy_scoring_config_to_session
-- Type: TRIGGER
-- Returns: trigger

CREATE OR REPLACE FUNCTION public.copy_scoring_config_to_session()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Only set scoring_config_id if it's not already set
    IF NEW.scoring_config_id IS NULL AND NEW.patient_id IS NOT NULL THEN
        -- Get the appropriate config for this patient
        NEW.scoring_config_id = get_session_scoring_config(
            p_session_id := NULL,  -- New session, no session config yet
            p_patient_id := NEW.patient_id
        );
    END IF;
    RETURN NEW;
END;
$$;

-- Trigger usage:
-- CREATE TRIGGER trigger_name
-- BEFORE INSERT OR UPDATE ON table_name
-- FOR EACH ROW EXECUTE FUNCTION copy_scoring_config_to_session();

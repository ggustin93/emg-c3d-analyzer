-- Function: generate_user_code
-- Type: TRIGGER
-- Returns: trigger

CREATE OR REPLACE FUNCTION public.generate_user_code()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Only generate if user_code is not provided
    IF NEW.user_code IS NULL THEN
        CASE NEW.role
            WHEN 'therapist' THEN
                NEW.user_code := 'T' || lpad(nextval('therapist_code_seq')::text, 3, '0');
            WHEN 'researcher' THEN
                NEW.user_code := 'R' || lpad(nextval('researcher_code_seq')::text, 3, '0');
            WHEN 'admin' THEN
                NEW.user_code := 'A' || lpad(nextval('admin_code_seq')::text, 3, '0');
            ELSE
                -- Should not happen due to CHECK constraint on role
                RAISE EXCEPTION 'Invalid role: %', NEW.role;
        END CASE;
    END IF;
    RETURN NEW;
END;
$$;

-- Trigger usage:
-- CREATE TRIGGER trigger_name
-- BEFORE INSERT OR UPDATE ON table_name
-- FOR EACH ROW EXECUTE FUNCTION generate_user_code();

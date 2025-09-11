-- Function: audit_patient_medical_info
-- Type: TRIGGER
-- Returns: trigger

CREATE OR REPLACE FUNCTION public.audit_patient_medical_info()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    INSERT INTO public.audit_log (
        user_id,
        user_role,
        action,
        table_name,
        record_id,
        changes,
        ip_address
    ) VALUES (
        auth.uid(),
        COALESCE(
            (SELECT role FROM public.user_profiles WHERE id = auth.uid()),
            'unknown'
        ),
        TG_OP,
        'patient_medical_info',
        COALESCE(NEW.id, OLD.id),
        CASE 
            WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD)
            WHEN TG_OP = 'INSERT' THEN to_jsonb(NEW)
            ELSE jsonb_build_object('old', to_jsonb(OLD), 'new', to_jsonb(NEW))
        END,
        inet_client_addr()
    );
    RETURN COALESCE(NEW, OLD);
END;
$$;

-- Trigger usage:
-- CREATE TRIGGER trigger_name
-- BEFORE INSERT OR UPDATE ON table_name
-- FOR EACH ROW EXECUTE FUNCTION audit_patient_medical_info();

-- Session-Based Scoring Configuration with Patient Cache
-- ========================================================
-- Best practice: Link scoring config to therapy sessions for audit trail,
-- while maintaining a current config cache on patients for performance.
-- This provides both immutability for historical data and flexibility for future sessions.

-- Step 1: Add scoring_config_id to therapy_sessions for immutable audit trail
ALTER TABLE public.therapy_sessions 
ADD COLUMN scoring_config_id UUID REFERENCES public.scoring_configuration(id);

-- Index for efficient historical queries
CREATE INDEX idx_therapy_sessions_scoring_config 
ON public.therapy_sessions(scoring_config_id);

-- Step 2: Add current_scoring_config_id to patients as a cache for next session
ALTER TABLE public.patients 
ADD COLUMN current_scoring_config_id UUID REFERENCES public.scoring_configuration(id),
ADD COLUMN scoring_config_updated_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN scoring_config_updated_by UUID REFERENCES public.user_profiles(id);

-- Index for fast lookup when creating new sessions
CREATE INDEX idx_patients_current_scoring_config 
ON public.patients(current_scoring_config_id);

-- Step 3: Migrate any existing junction table data to patients table
DO $$
BEGIN
    -- Only run if junction table exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'patient_scoring_config') THEN
        UPDATE public.patients p
        SET 
            current_scoring_config_id = psc.scoring_config_id,
            scoring_config_updated_at = psc.assigned_at,
            scoring_config_updated_by = psc.assigned_by
        FROM public.patient_scoring_config psc
        WHERE p.id = psc.patient_id 
          AND psc.active = true;
          
        -- Drop the junction table as it's no longer needed
        DROP TABLE public.patient_scoring_config CASCADE;
    END IF;
END $$;

-- Step 4: Create intelligent lookup function with proper priority hierarchy
CREATE OR REPLACE FUNCTION get_session_scoring_config(
    p_session_id UUID DEFAULT NULL,
    p_patient_id UUID DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_config_id UUID;
BEGIN
    -- Priority 1: If session_id provided, check if session already has a config
    -- This preserves historical scoring for completed sessions
    IF p_session_id IS NOT NULL THEN
        SELECT scoring_config_id INTO v_config_id
        FROM therapy_sessions
        WHERE id = p_session_id;
        
        IF v_config_id IS NOT NULL THEN
            RETURN v_config_id;  -- Return immutable session config
        END IF;
    END IF;
    
    -- Priority 2: Check patient's current scoring preference
    -- This is used when creating new sessions
    IF p_patient_id IS NOT NULL THEN
        SELECT current_scoring_config_id INTO v_config_id
        FROM patients
        WHERE id = p_patient_id;
        
        IF v_config_id IS NOT NULL THEN
            RETURN v_config_id;  -- Return patient's current preference
        END IF;
    END IF;
    
    -- Priority 3: Return global GHOSTLY+ Default
    SELECT id INTO v_config_id
    FROM scoring_configuration
    WHERE is_global = true 
      AND active = true
      AND configuration_name = 'GHOSTLY+ Default'
    LIMIT 1;
    
    RETURN v_config_id;  -- May be NULL if no global config exists
END;
$$ LANGUAGE plpgsql;

-- Step 5: Create trigger to copy patient's current config to new sessions
CREATE OR REPLACE FUNCTION copy_scoring_config_to_session()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_session_scoring_config
BEFORE INSERT ON therapy_sessions
FOR EACH ROW
EXECUTE FUNCTION copy_scoring_config_to_session();

-- Step 6: Create audit trigger for patient config changes
CREATE OR REPLACE FUNCTION audit_patient_scoring_config_change()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.current_scoring_config_id IS DISTINCT FROM NEW.current_scoring_config_id THEN
        NEW.scoring_config_updated_at = NOW();
        -- Note: scoring_config_updated_by should be set by the application
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER patient_scoring_config_audit
BEFORE UPDATE ON patients
FOR EACH ROW
EXECUTE FUNCTION audit_patient_scoring_config_change();

-- Step 7: Populate existing sessions with default config (for backwards compatibility)
UPDATE therapy_sessions ts
SET scoring_config_id = (
    SELECT id 
    FROM scoring_configuration 
    WHERE configuration_name = 'GHOSTLY+ Default' 
      AND is_global = true 
      AND active = true
    LIMIT 1
)
WHERE scoring_config_id IS NULL;

-- Step 8: Add helpful comments explaining the architecture
COMMENT ON COLUMN therapy_sessions.scoring_config_id IS 
'Immutable reference to the scoring configuration used for this specific session. Provides audit trail and ensures historical scores remain valid even if scoring algorithms change.';

COMMENT ON COLUMN patients.current_scoring_config_id IS 
'Current scoring configuration preference for this patient. Used as default when creating new sessions. Can be changed without affecting historical session scores.';

COMMENT ON COLUMN patients.scoring_config_updated_at IS 
'Timestamp of when the patient''s scoring configuration preference was last changed.';

COMMENT ON COLUMN patients.scoring_config_updated_by IS 
'Therapist who last updated the patient''s scoring configuration preference.';

COMMENT ON FUNCTION get_session_scoring_config IS 
'Intelligent scoring configuration lookup with priority: 1) Session config (immutable), 2) Patient preference (mutable), 3) Global default. Ensures proper audit trail while maintaining flexibility.';

-- Step 9: Create view for easy scoring configuration analysis
CREATE OR REPLACE VIEW session_scoring_analysis AS
SELECT 
    ts.id as session_id,
    ts.session_date,
    ts.patient_id,
    p.patient_code,
    p.full_name as patient_name,
    sc.configuration_name,
    sc.weight_compliance,
    sc.weight_symmetry,
    sc.weight_effort,
    sc.weight_game,
    ps.overall_score,
    ps.compliance_score,
    CASE 
        WHEN ts.scoring_config_id = p.current_scoring_config_id THEN 'Current'
        WHEN ts.scoring_config_id IS NOT NULL THEN 'Historical'
        ELSE 'Default'
    END as config_status
FROM therapy_sessions ts
LEFT JOIN patients p ON ts.patient_id = p.id
LEFT JOIN scoring_configuration sc ON ts.scoring_config_id = sc.id
LEFT JOIN performance_scores ps ON ps.session_id = ts.id
ORDER BY ts.session_date DESC;

COMMENT ON VIEW session_scoring_analysis IS 
'Comprehensive view showing which scoring configuration was used for each session, enabling clinical audit trail and research analysis.';
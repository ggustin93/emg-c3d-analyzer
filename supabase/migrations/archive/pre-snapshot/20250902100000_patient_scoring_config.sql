-- Patient-Specific Scoring Configuration
-- ========================================
-- Enables personalized scoring weights per patient for individualized therapy goals
-- Priority hierarchy:
-- 1. Patient-specific config (if exists and active)
-- 2. Therapist default config (if patient's therapist has one)
-- 3. Global database config (GHOSTLY+ Default)
-- 4. System fallback (config.py ScoringDefaults)

-- Create patient_scoring_config junction table
-- This allows flexible assignment of scoring configurations to patients
CREATE TABLE IF NOT EXISTS public.patient_scoring_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL,
    scoring_config_id UUID NOT NULL,
    assigned_by UUID, -- therapist who assigned this configuration
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    active BOOLEAN DEFAULT true,
    notes TEXT, -- Clinical notes about why this config was chosen
    
    -- Foreign key constraints
    CONSTRAINT patient_scoring_config_patient_fkey 
        FOREIGN KEY (patient_id) REFERENCES user_profiles(id) ON DELETE CASCADE,
    CONSTRAINT patient_scoring_config_scoring_fkey 
        FOREIGN KEY (scoring_config_id) REFERENCES scoring_configuration(id) ON DELETE RESTRICT,
    CONSTRAINT patient_scoring_config_assigned_by_fkey 
        FOREIGN KEY (assigned_by) REFERENCES user_profiles(id) ON DELETE SET NULL
);

-- Create indexes for performance
CREATE INDEX idx_patient_scoring_config_patient ON public.patient_scoring_config(patient_id);
CREATE INDEX idx_patient_scoring_config_active ON public.patient_scoring_config(active);
CREATE INDEX idx_patient_scoring_config_assigned_at ON public.patient_scoring_config(assigned_at DESC);

-- Ensure only one active configuration per patient using a partial unique index
CREATE UNIQUE INDEX unique_active_patient_config ON public.patient_scoring_config(patient_id) WHERE active = true;

-- Add updated_at column and trigger
ALTER TABLE public.patient_scoring_config 
ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

CREATE TRIGGER update_patient_scoring_config_updated_at 
BEFORE UPDATE ON patient_scoring_config 
FOR EACH ROW 
EXECUTE FUNCTION update_updated_at_column();

-- Create a view for easy access to active patient configurations
CREATE OR REPLACE VIEW patient_active_scoring_config AS
SELECT 
    psc.patient_id,
    psc.scoring_config_id,
    sc.configuration_name,
    sc.weight_compliance,
    sc.weight_symmetry,
    sc.weight_effort,
    sc.weight_game,
    sc.weight_completion,
    sc.weight_intensity,
    sc.weight_duration,
    sc.rpe_mapping,
    psc.assigned_by,
    psc.assigned_at,
    psc.notes,
    up_patient.full_name as patient_name,
    up_therapist.full_name as assigned_by_name
FROM patient_scoring_config psc
JOIN scoring_configuration sc ON psc.scoring_config_id = sc.id
JOIN user_profiles up_patient ON psc.patient_id = up_patient.id
LEFT JOIN user_profiles up_therapist ON psc.assigned_by = up_therapist.id
WHERE psc.active = true;

-- Function to get the appropriate scoring configuration for a patient
CREATE OR REPLACE FUNCTION get_patient_scoring_config(p_patient_id UUID)
RETURNS UUID AS $$
DECLARE
    v_config_id UUID;
    v_therapist_id UUID;
BEGIN
    -- Priority 1: Check for active patient-specific configuration
    SELECT scoring_config_id INTO v_config_id
    FROM patient_scoring_config
    WHERE patient_id = p_patient_id AND active = true
    LIMIT 1;
    
    IF v_config_id IS NOT NULL THEN
        RETURN v_config_id;
    END IF;
    
    -- Priority 2: Get patient's therapist and check for therapist default
    SELECT therapist_id INTO v_therapist_id
    FROM therapy_sessions
    WHERE patient_id = p_patient_id
    ORDER BY session_date DESC
    LIMIT 1;
    
    IF v_therapist_id IS NOT NULL THEN
        SELECT id INTO v_config_id
        FROM scoring_configuration
        WHERE therapist_id = v_therapist_id AND active = true
        LIMIT 1;
        
        IF v_config_id IS NOT NULL THEN
            RETURN v_config_id;
        END IF;
    END IF;
    
    -- Priority 3: Return global default configuration
    SELECT id INTO v_config_id
    FROM scoring_configuration
    WHERE is_global = true AND active = true
    AND configuration_name = 'GHOSTLY+ Default'
    LIMIT 1;
    
    RETURN v_config_id; -- May be NULL if no global config exists
END;
$$ LANGUAGE plpgsql;

-- Insert default global configuration if it doesn't exist
INSERT INTO scoring_configuration (
    configuration_name,
    description,
    weight_compliance,
    weight_symmetry,
    weight_effort,
    weight_game,
    weight_completion,
    weight_intensity,
    weight_duration,
    is_global,
    active,
    rpe_mapping
) 
SELECT 
    'GHOSTLY+ Default',
    'Standard scoring configuration based on metricsDefinitions.md - optimal for elderly rehabilitation',
    0.50,  -- 50% Therapeutic Compliance
    0.25,  -- 25% Muscle Symmetry
    0.25,  -- 25% Subjective Effort (RPE)
    0.00,  -- 0% Game Performance (optional, game-dependent)
    0.333, -- Equal weighting for completion
    0.333, -- Equal weighting for intensity
    0.334, -- Equal weighting for duration (adjusted for sum)
    true,  -- This is a global configuration
    true,  -- Active by default
    '{
        "0": {"score": 10, "category": "no_exertion", "clinical": "concerning_lack_of_effort"},
        "1": {"score": 25, "category": "very_light", "clinical": "below_therapeutic_minimum"},
        "2": {"score": 50, "category": "light", "clinical": "warm_up_intensity"},
        "3": {"score": 85, "category": "moderate_low", "clinical": "therapeutic_entry_range"},
        "4": {"score": 100, "category": "optimal_moderate", "clinical": "ideal_therapeutic_intensity"},
        "5": {"score": 100, "category": "optimal_moderate", "clinical": "peak_therapeutic_intensity"},
        "6": {"score": 75, "category": "somewhat_hard", "clinical": "approaching_upper_limit"},
        "7": {"score": 50, "category": "hard", "clinical": "excessive_for_elderly"},
        "8": {"score": 25, "category": "very_hard", "clinical": "dangerous_overexertion"},
        "9": {"score": 15, "category": "extremely_hard", "clinical": "immediate_intervention_needed"},
        "10": {"score": 10, "category": "maximum", "clinical": "emergency_stop_protocol"}
    }'::jsonb
WHERE NOT EXISTS (
    SELECT 1 FROM scoring_configuration 
    WHERE configuration_name = 'GHOSTLY+ Default' AND is_global = true
);

-- Comment on the new table for documentation
COMMENT ON TABLE patient_scoring_config IS 'Maps scoring configurations to individual patients for personalized therapy goals';
COMMENT ON COLUMN patient_scoring_config.patient_id IS 'The patient receiving this scoring configuration';
COMMENT ON COLUMN patient_scoring_config.scoring_config_id IS 'The specific scoring configuration assigned';
COMMENT ON COLUMN patient_scoring_config.assigned_by IS 'The therapist who assigned this configuration';
COMMENT ON COLUMN patient_scoring_config.active IS 'Whether this is the currently active configuration for the patient';
COMMENT ON COLUMN patient_scoring_config.notes IS 'Clinical notes explaining why this configuration was chosen';
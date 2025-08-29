-- Migration: Add Performance Scoring Enhancements
-- Date: 2025-08-21
-- Purpose: Add support for fake RPE flagging and configurable scoring weights

-- 1. Add fake RPE flag to performance_scores table
ALTER TABLE performance_scores 
ADD COLUMN IF NOT EXISTS rpe_is_fake BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN performance_scores.rpe_is_fake IS 'Flag indicating if RPE=4 was set as default (fake) value vs therapist-provided';

-- 2. Create scoring_configuration table for configurable weights
CREATE TABLE IF NOT EXISTS scoring_configuration (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Main scoring weights (must sum to 1.0)
    weight_compliance DECIMAL(4,3) NOT NULL DEFAULT 0.400 CHECK (weight_compliance >= 0 AND weight_compliance <= 1),
    weight_symmetry DECIMAL(4,3) NOT NULL DEFAULT 0.250 CHECK (weight_symmetry >= 0 AND weight_symmetry <= 1),
    weight_effort DECIMAL(4,3) NOT NULL DEFAULT 0.200 CHECK (weight_effort >= 0 AND weight_effort <= 1),
    weight_game DECIMAL(4,3) NOT NULL DEFAULT 0.150 CHECK (weight_game >= 0 AND weight_game <= 1),
    
    -- Compliance sub-component weights (must sum to 1.0)
    weight_completion DECIMAL(4,3) NOT NULL DEFAULT 0.333 CHECK (weight_completion >= 0 AND weight_completion <= 1),
    weight_intensity DECIMAL(4,3) NOT NULL DEFAULT 0.333 CHECK (weight_intensity >= 0 AND weight_intensity <= 1),
    weight_duration DECIMAL(4,3) NOT NULL DEFAULT 0.334 CHECK (weight_duration >= 0 AND weight_duration <= 1),
    
    -- Optional configuration metadata
    configuration_name TEXT DEFAULT 'Default GHOSTLY+ Weights',
    description TEXT,
    active BOOLEAN DEFAULT TRUE,
    created_by UUID, -- therapist/researcher who created this configuration
    
    -- Validation constraints
    CONSTRAINT valid_main_weights CHECK (
        ABS((weight_compliance + weight_symmetry + weight_effort + weight_game) - 1.0) < 0.001
    ),
    CONSTRAINT valid_compliance_weights CHECK (
        ABS((weight_completion + weight_intensity + weight_duration) - 1.0) < 0.001
    )
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_scoring_configuration_active ON scoring_configuration(active, created_at DESC);

-- Insert default GHOSTLY+ configuration
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
    active
) VALUES (
    'GHOSTLY+ Clinical Trial Weights',
    'Official GHOSTLY+ multicenter RCT scoring weights optimized for hospitalized older adults',
    0.400,  -- Compliance (40%)
    0.250,  -- Symmetry (25%)
    0.200,  -- Effort (20%)
    0.150,  -- Game (15%)
    0.333,  -- Completion rate (1/3)
    0.333,  -- Intensity rate (1/3)
    0.334,  -- Duration rate (1/3)
    TRUE
) ON CONFLICT DO NOTHING;

-- Add Row Level Security (RLS)
ALTER TABLE scoring_configuration ENABLE ROW LEVEL SECURITY;

-- Policy: Only authenticated users can view configurations
CREATE POLICY IF NOT EXISTS "Researchers can view scoring configurations" 
ON scoring_configuration FOR SELECT
TO authenticated
USING (true);

-- Policy: Only researchers can modify configurations
CREATE POLICY IF NOT EXISTS "Researchers can modify scoring configurations"
ON scoring_configuration FOR ALL
TO authenticated
USING (true);

-- 3. Add comments for documentation
COMMENT ON TABLE scoring_configuration IS 'Configurable scoring weights for GHOSTLY+ performance metrics calculation';
COMMENT ON COLUMN scoring_configuration.weight_compliance IS 'Weight for therapeutic compliance score (default: 40%)';
COMMENT ON COLUMN scoring_configuration.weight_symmetry IS 'Weight for muscle symmetry score (default: 25%)';
COMMENT ON COLUMN scoring_configuration.weight_effort IS 'Weight for subjective effort score (default: 20%)';
COMMENT ON COLUMN scoring_configuration.weight_game IS 'Weight for game performance score (default: 15%)';

-- 4. Create helper function to validate scoring configuration
CREATE OR REPLACE FUNCTION validate_scoring_weights()
RETURNS TRIGGER AS $$
BEGIN
    -- Check main weights sum to 1.0 (within tolerance)
    IF ABS((NEW.weight_compliance + NEW.weight_symmetry + NEW.weight_effort + NEW.weight_game) - 1.0) >= 0.001 THEN
        RAISE EXCEPTION 'Main scoring weights must sum to 1.0, got: %', 
            (NEW.weight_compliance + NEW.weight_symmetry + NEW.weight_effort + NEW.weight_game);
    END IF;
    
    -- Check compliance sub-weights sum to 1.0 (within tolerance)
    IF ABS((NEW.weight_completion + NEW.weight_intensity + NEW.weight_duration) - 1.0) >= 0.001 THEN
        RAISE EXCEPTION 'Compliance sub-weights must sum to 1.0, got: %',
            (NEW.weight_completion + NEW.weight_intensity + NEW.weight_duration);
    END IF;
    
    -- Update timestamp
    NEW.updated_at = NOW();
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to validate weights before insert/update
CREATE TRIGGER scoring_configuration_validation
    BEFORE INSERT OR UPDATE ON scoring_configuration
    FOR EACH ROW EXECUTE FUNCTION validate_scoring_weights();
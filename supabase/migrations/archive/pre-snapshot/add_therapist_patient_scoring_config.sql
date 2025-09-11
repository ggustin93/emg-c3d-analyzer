-- Migration: Add Therapist/Patient Support to Scoring Configuration
-- Date: 2025-08-22
-- Purpose: Support therapist and patient-specific scoring configuration customization

BEGIN;

-- Add therapist_id and patient_id columns to scoring_configuration table
ALTER TABLE scoring_configuration 
ADD COLUMN IF NOT EXISTS therapist_id UUID;

ALTER TABLE scoring_configuration 
ADD COLUMN IF NOT EXISTS patient_id UUID;

-- Add comments for documentation
COMMENT ON COLUMN scoring_configuration.therapist_id IS 'Optional therapist ID for custom scoring configuration (null for global configs)';
COMMENT ON COLUMN scoring_configuration.patient_id IS 'Optional patient ID for therapist+patient specific scoring configuration';

-- Create index for efficient custom configuration lookups
CREATE INDEX IF NOT EXISTS idx_scoring_configuration_therapist_patient 
ON scoring_configuration(therapist_id, patient_id) 
WHERE therapist_id IS NOT NULL;

-- Create index for therapist-only configurations
CREATE INDEX IF NOT EXISTS idx_scoring_configuration_therapist_only 
ON scoring_configuration(therapist_id) 
WHERE therapist_id IS NOT NULL AND patient_id IS NULL;

-- Add constraint to ensure patient_id is only set when therapist_id is set
ALTER TABLE scoring_configuration 
ADD CONSTRAINT IF NOT EXISTS check_therapist_patient_relationship 
CHECK (patient_id IS NULL OR therapist_id IS NOT NULL);

-- Update the existing default configuration to explicitly mark it as global
UPDATE scoring_configuration 
SET 
    configuration_name = 'GHOSTLY+ Global Default Weights',
    description = 'Official GHOSTLY+ multicenter RCT scoring weights for global use (therapist/patient agnostic)',
    therapist_id = NULL,
    patient_id = NULL
WHERE configuration_name = 'GHOSTLY+ Clinical Trial Weights';

COMMIT;

-- Verification: Show configuration structure
SELECT 
    configuration_name,
    therapist_id,
    patient_id,
    weight_compliance,
    weight_symmetry,
    weight_effort,
    weight_game,
    active
FROM scoring_configuration 
ORDER BY created_at;
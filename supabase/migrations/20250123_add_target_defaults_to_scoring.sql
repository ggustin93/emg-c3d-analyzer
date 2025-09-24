-- Migration 2: Add Target Defaults to Scoring Configuration
-- Author: Claude Code  
-- Date: 2025-01-23
-- Purpose: Add target_defaults JSONB field for patient initialization defaults

-- Add target_defaults JSONB field for patient initialization defaults
ALTER TABLE public.scoring_configuration
ADD COLUMN IF NOT EXISTS target_defaults JSONB DEFAULT '{
  "mvc_threshold_percentage": 75,
  "target_duration_ch1_ms": 2000,
  "target_duration_ch2_ms": 2000,
  "target_contractions_ch1": 12,
  "target_contractions_ch2": 12,
  "bfr_target_lop_percentage_ch1": 50,
  "bfr_target_lop_percentage_ch2": 50
}'::JSONB;

-- Add comment for documentation
COMMENT ON COLUMN public.scoring_configuration.target_defaults IS 'Default target values used when initializing new patients';

-- Update GHOSTLY-TRIAL-DEFAULT with initial target defaults
UPDATE public.scoring_configuration
SET target_defaults = '{
  "mvc_threshold_percentage": 75,
  "target_duration_ch1_ms": 2000,
  "target_duration_ch2_ms": 2000,
  "target_contractions_ch1": 12,
  "target_contractions_ch2": 12,
  "bfr_target_lop_percentage_ch1": 50,
  "bfr_target_lop_percentage_ch2": 50
}'::JSONB
WHERE id = 'a0000000-0000-0000-0000-000000000001';
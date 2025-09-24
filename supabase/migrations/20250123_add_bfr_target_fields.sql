-- Migration 1: Add BFR Target Fields to Patients
-- Author: Claude Code
-- Date: 2025-01-23
-- Purpose: Add Blood Flow Restriction (BFR) target fields with validation constraints

-- Add BFR target fields for Blood Flow Restriction therapy with CHECK constraints
ALTER TABLE public.patients 
ADD COLUMN IF NOT EXISTS bfr_target_lop_percentage_ch1 FLOAT8 DEFAULT 50.0
  CHECK (bfr_target_lop_percentage_ch1 >= 0 AND bfr_target_lop_percentage_ch1 <= 100),
ADD COLUMN IF NOT EXISTS bfr_target_lop_percentage_ch2 FLOAT8 DEFAULT 50.0
  CHECK (bfr_target_lop_percentage_ch2 >= 0 AND bfr_target_lop_percentage_ch2 <= 100);

-- Add documentation comments
COMMENT ON COLUMN public.patients.bfr_target_lop_percentage_ch1 IS 'BFR target limb occlusion pressure percentage for channel 1 (0-100%)';
COMMENT ON COLUMN public.patients.bfr_target_lop_percentage_ch2 IS 'BFR target limb occlusion pressure percentage for channel 2 (0-100%)';
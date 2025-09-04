-- ==============================================================================
-- EMG C3D Analyzer - Fix Duration Column Names
-- ==============================================================================
-- 🎯 PURPOSE: Rename duration columns from _seconds to _ms for accuracy
-- 📅 Created: 2025-09-02
-- 🔧 Changes:
--   - Rename target_duration_ch1_seconds → target_duration_ch1_ms
--   - Rename target_duration_ch2_seconds → target_duration_ch2_ms
-- 💡 Rationale: Values are in milliseconds (2000ms, 482ms), so _ms is more accurate
-- ==============================================================================

-- ==============================================================================
-- PHASE 1: SESSION_SETTINGS COLUMN RENAMING
-- ==============================================================================

-- Rename duration columns to use accurate _ms suffix
ALTER TABLE public.session_settings 
  RENAME COLUMN target_duration_ch1_seconds TO target_duration_ch1_ms;

ALTER TABLE public.session_settings 
  RENAME COLUMN target_duration_ch2_seconds TO target_duration_ch2_ms;

-- Add helpful comments
COMMENT ON COLUMN public.session_settings.target_duration_ch1_ms IS 'Target contraction duration for left muscle (CH1) in milliseconds';
COMMENT ON COLUMN public.session_settings.target_duration_ch2_ms IS 'Target contraction duration for right muscle (CH2) in milliseconds';

-- ==============================================================================
-- MIGRATION SUMMARY
-- ==============================================================================
-- 
-- Changes Applied:
-- 1. SESSION_SETTINGS:
--    - target_duration_ch1_seconds → target_duration_ch1_ms
--    - target_duration_ch2_seconds → target_duration_ch2_ms
--    + Added descriptive comments for clarity
--
-- ==============================================================================
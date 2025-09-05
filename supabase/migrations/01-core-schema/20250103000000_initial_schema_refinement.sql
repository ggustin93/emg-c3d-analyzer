-- ==============================================================================
-- EMG C3D Analyzer - Schema Refinement Migration
-- ==============================================================================
-- 🎯 PURPOSE: Comprehensive schema improvements for clarity and efficiency
-- 📅 Created: 2025-01-03
-- 🔧 Changes:
--   - Rename columns for clarity (mvc75 naming convention)
--   - Consolidate processing_parameters into JSONB
--   - Add contractions detail storage
--   - Enhance BFR monitoring fields
--   - Remove redundant fields
-- ==============================================================================

-- ==============================================================================
-- PHASE 1: EMG_STATISTICS ENHANCEMENTS
-- ==============================================================================

-- Rename columns for clarity
ALTER TABLE public.emg_statistics 
  RENAME COLUMN mvc_threshold_actual_value TO mvc75_threshold;

ALTER TABLE public.emg_statistics 
  RENAME COLUMN mvc_contraction_count TO mvc75_compliance_rate;

ALTER TABLE public.emg_statistics 
  RENAME COLUMN duration_contraction_count TO duration_compliance_rate;

-- Add JSONB fields for detailed data storage
ALTER TABLE public.emg_statistics 
  ADD COLUMN IF NOT EXISTS contractions_detail JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.emg_statistics.contractions_detail IS 'Detailed contraction data: [{start_time_ms, end_time_ms, peak_amplitude, mean_amplitude, meets_mvc, meets_duration}]';

ALTER TABLE public.emg_statistics 
  ADD COLUMN IF NOT EXISTS signal_quality_metrics JSONB DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.emg_statistics.signal_quality_metrics IS 'Signal quality metrics: {snr_db, baseline_noise_uv, artifact_percentage, saturation_percentage}';

ALTER TABLE public.emg_statistics 
  ADD COLUMN IF NOT EXISTS processing_config JSONB DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.emg_statistics.processing_config IS 'Processing parameters used for this analysis (replaces processing_parameters table)';

-- ==============================================================================
-- PHASE 2: SESSION_SETTINGS CLEANUP
-- ==============================================================================

-- Remove therapist_id if exists (sessions are immutable post-creation)
ALTER TABLE public.session_settings 
  DROP COLUMN IF EXISTS therapist_id;

-- Rename target MVC columns for clarity
ALTER TABLE public.session_settings 
  RENAME COLUMN target_mvc_ch1 TO target_mvc75_ch1;

ALTER TABLE public.session_settings 
  RENAME COLUMN target_mvc_ch2 TO target_mvc75_ch2;

COMMENT ON COLUMN public.session_settings.target_mvc75_ch1 IS 'Target MVC at 75% threshold for left muscle (CH1) this session';
COMMENT ON COLUMN public.session_settings.target_mvc75_ch2 IS 'Target MVC at 75% threshold for right muscle (CH2) this session';

-- Also rename duration targets for consistency
ALTER TABLE public.session_settings
  RENAME COLUMN target_duration_ch1 TO target_duration_ch1_seconds;

ALTER TABLE public.session_settings
  RENAME COLUMN target_duration_ch2 TO target_duration_ch2_seconds;

-- ==============================================================================
-- PHASE 3: BFR MONITORING ENHANCEMENT
-- ==============================================================================

-- Drop old manual compliance field
ALTER TABLE public.bfr_monitoring 
  DROP COLUMN IF EXISTS bfr_compliance_manual;

-- Add new flexible validation fields
ALTER TABLE public.bfr_monitoring 
  ADD COLUMN IF NOT EXISTS compliance_validation_method TEXT 
    DEFAULT 'user_input'
    CHECK (compliance_validation_method IN ('user_input', 'sensor', 'algorithm', 'estimated'));

ALTER TABLE public.bfr_monitoring 
  ADD COLUMN IF NOT EXISTS compliance_validated BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN public.bfr_monitoring.compliance_validation_method IS 'Method used to validate BFR compliance';
COMMENT ON COLUMN public.bfr_monitoring.compliance_validated IS 'Whether BFR compliance has been validated';

-- ==============================================================================
-- PHASE 4: MIGRATE PROCESSING_PARAMETERS TO JSONB
-- ==============================================================================

-- Migrate existing processing_parameters data to emg_statistics.processing_config
DO $$
BEGIN
  -- Check if processing_parameters table exists
  IF EXISTS (SELECT FROM information_schema.tables 
             WHERE table_schema = 'public' 
             AND table_name = 'processing_parameters') THEN
    
    -- Update emg_statistics with processing parameters as JSONB
    UPDATE public.emg_statistics es
    SET processing_config = jsonb_build_object(
      'sampling_rate_hz', pp.sampling_rate_hz,
      'filter_low_cutoff_hz', pp.filter_low_cutoff_hz,
      'filter_high_cutoff_hz', pp.filter_high_cutoff_hz,
      'filter_order', pp.filter_order,
      'rms_window_ms', pp.rms_window_ms,
      'rms_overlap_percent', pp.rms_overlap_percent,
      'mvc_window_seconds', pp.mvc_window_seconds,
      'mvc_threshold_percentage', pp.mvc_threshold_percentage,
      'processing_version', pp.processing_version,
      'created_at', pp.created_at,
      'updated_at', pp.updated_at
    )
    FROM public.processing_parameters pp
    WHERE pp.session_id = es.session_id;
    
    -- Drop the processing_parameters table
    DROP TABLE public.processing_parameters CASCADE;
    
    RAISE NOTICE 'Processing parameters migrated to JSONB and table dropped';
  ELSE
    RAISE NOTICE 'Processing_parameters table does not exist, skipping migration';
  END IF;
END $$;

-- ==============================================================================
-- PHASE 5: PATIENTS TABLE - RENAME THERAPEUTIC TARGETS FOR CLARITY
-- ==============================================================================

-- Rename current MVC columns to include 75% threshold indication
ALTER TABLE public.patients
  RENAME COLUMN current_mvc_ch1 TO current_mvc75_ch1;

ALTER TABLE public.patients
  RENAME COLUMN current_mvc_ch2 TO current_mvc75_ch2;

COMMENT ON COLUMN public.patients.current_mvc75_ch1 IS 'Current MVC baseline at 75% threshold for left muscle (CH1) - updated by therapist after assessment';
COMMENT ON COLUMN public.patients.current_mvc75_ch2 IS 'Current MVC baseline at 75% threshold for right muscle (CH2) - updated by therapist after assessment';

-- Rename duration columns for clarity
ALTER TABLE public.patients
  RENAME COLUMN current_duration_ch1 TO current_duration_ch1_seconds;

ALTER TABLE public.patients
  RENAME COLUMN current_duration_ch2 TO current_duration_ch2_seconds;

-- ==============================================================================
-- PHASE 6: UPDATE CONSTRAINTS AND INDEXES
-- ==============================================================================

-- Update check constraints for renamed columns
ALTER TABLE public.patients
  DROP CONSTRAINT IF EXISTS patients_current_mvc_ch1_check,
  DROP CONSTRAINT IF EXISTS patients_current_mvc_ch2_check,
  ADD CONSTRAINT patients_current_mvc75_ch1_check CHECK (current_mvc75_ch1 > 0),
  ADD CONSTRAINT patients_current_mvc75_ch2_check CHECK (current_mvc75_ch2 > 0);

ALTER TABLE public.session_settings
  DROP CONSTRAINT IF EXISTS session_settings_target_mvc_ch1_check,
  DROP CONSTRAINT IF EXISTS session_settings_target_mvc_ch2_check,
  ADD CONSTRAINT session_settings_target_mvc75_ch1_check CHECK (target_mvc75_ch1 > 0),
  ADD CONSTRAINT session_settings_target_mvc75_ch2_check CHECK (target_mvc75_ch2 > 0);

-- Update indexes for renamed columns
DROP INDEX IF EXISTS idx_patients_current_mvc_ch1;
DROP INDEX IF EXISTS idx_patients_current_mvc_ch2;

CREATE INDEX idx_patients_current_mvc75_ch1 
  ON public.patients(current_mvc75_ch1) 
  WHERE current_mvc75_ch1 IS NOT NULL;

CREATE INDEX idx_patients_current_mvc75_ch2 
  ON public.patients(current_mvc75_ch2) 
  WHERE current_mvc75_ch2 IS NOT NULL;

-- Add indexes for JSONB fields for better query performance
CREATE INDEX idx_emg_statistics_contractions_detail 
  ON public.emg_statistics USING gin(contractions_detail);

CREATE INDEX idx_emg_statistics_processing_config 
  ON public.emg_statistics USING gin(processing_config);

CREATE INDEX idx_emg_statistics_signal_quality_metrics 
  ON public.emg_statistics USING gin(signal_quality_metrics);

-- ==============================================================================
-- PHASE 7: ADD EXPORT TRACKING TABLE (OPTIONAL BUT RECOMMENDED)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.export_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES public.therapy_sessions(id) ON DELETE CASCADE,
    exported_by UUID REFERENCES public.user_profiles(id),
    export_config JSONB DEFAULT '{}'::jsonb,
    export_format TEXT CHECK (export_format IN ('json', 'csv', 'excel', 'matlab')),
    channels_included TEXT[],
    downsampling_factor INTEGER,
    exported_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_export_history_session_id ON public.export_history(session_id);
CREATE INDEX idx_export_history_exported_by ON public.export_history(exported_by);
CREATE INDEX idx_export_history_exported_at ON public.export_history(exported_at);

COMMENT ON TABLE public.export_history IS 'Audit trail for data exports';

-- ==============================================================================
-- PHASE 8: UPDATE RLS POLICIES (IF NEEDED)
-- ==============================================================================

-- Note: RLS policies should automatically work with renamed columns,
-- but verify after migration

-- ==============================================================================
-- MIGRATION SUMMARY
-- ==============================================================================
-- 
-- Changes Applied:
-- 1. EMG_STATISTICS:
--    - mvc_threshold_actual_value → mvc75_threshold
--    - mvc_contraction_count → mvc75_compliance_rate
--    - duration_contraction_count → duration_compliance_rate
--    + Added contractions_detail JSONB
--    + Added signal_quality_metrics JSONB
--    + Added processing_config JSONB
--
-- 2. SESSION_SETTINGS:
--    - Removed therapist_id
--    - target_mvc_ch1 → target_mvc75_ch1
--    - target_mvc_ch2 → target_mvc75_ch2
--    - target_duration_ch1 → target_duration_ch1_seconds
--    - target_duration_ch2 → target_duration_ch2_seconds
--
-- 3. BFR_MONITORING:
--    - Removed bfr_compliance_manual
--    + Added compliance_validation_method
--    + Added compliance_validated
--
-- 4. PROCESSING_PARAMETERS:
--    - Table dropped, data migrated to emg_statistics.processing_config
--
-- 5. PATIENTS:
--    - current_mvc_ch1 → current_mvc75_ch1
--    - current_mvc_ch2 → current_mvc75_ch2
--    - current_duration_ch1 → current_duration_ch1_seconds
--    - current_duration_ch2 → current_duration_ch2_seconds
--
-- 6. EXPORT_HISTORY:
--    + New table for tracking exports
--
-- ==============================================================================
-- MVC Workflow Alignment Migration
-- Adds therapeutic targeting fields and MVC source tracking
-- Respects existing BFR monitoring table architecture
-- Author: Claude Code
-- Date: 2025-01-31

BEGIN;

-- Add therapeutic target fields to session_settings
-- These fields support flexible per-channel contraction targets
ALTER TABLE session_settings ADD COLUMN IF NOT EXISTS target_contractions_ch1 INTEGER DEFAULT 12;
ALTER TABLE session_settings ADD COLUMN IF NOT EXISTS target_contractions_ch2 INTEGER DEFAULT 12;

-- Add therapist_id for clinical tracking (from C3D metadata)
ALTER TABLE session_settings ADD COLUMN IF NOT EXISTS therapist_id UUID DEFAULT NULL REFERENCES auth.users(id);

-- Add MVC source tracking and algorithm configuration to processing_parameters
-- mvc_source tracks the priority cascade (c3d_metadata > patient_database > self_calibration)
ALTER TABLE processing_parameters ADD COLUMN IF NOT EXISTS mvc_source VARCHAR(50) DEFAULT 'self_calibration';

-- algorithm_config stores immutable snapshots of processing parameters for session traceability
ALTER TABLE processing_parameters ADD COLUMN IF NOT EXISTS algorithm_config JSONB DEFAULT '{}'::jsonb;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_session_settings_therapist_id 
ON session_settings (therapist_id);

CREATE INDEX IF NOT EXISTS idx_processing_parameters_mvc_source 
ON processing_parameters (mvc_source);

-- Add comments for documentation
COMMENT ON COLUMN session_settings.target_contractions_ch1 IS 'Therapeutic target for CH1 contractions per session (flexible per-channel)';
COMMENT ON COLUMN session_settings.target_contractions_ch2 IS 'Therapeutic target for CH2 contractions per session (flexible per-channel)';
COMMENT ON COLUMN session_settings.therapist_id IS 'ID of therapist from C3D metadata for clinical tracking';

COMMENT ON COLUMN processing_parameters.mvc_source IS 'Source of MVC values: c3d_metadata, patient_database, or self_calibration';
COMMENT ON COLUMN processing_parameters.algorithm_config IS 'Immutable snapshot of algorithm configuration for session traceability';

-- Verify all required tables exist and are being populated
-- This query helps validate the schema is ready for the updated processor
DO $$
BEGIN
    -- Check if all 6 required tables exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'session_settings') THEN
        RAISE EXCEPTION 'Missing required table: session_settings';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'processing_parameters') THEN
        RAISE EXCEPTION 'Missing required table: processing_parameters';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'c3d_metadata') THEN
        RAISE EXCEPTION 'Missing required table: c3d_metadata';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'analytics') THEN
        RAISE EXCEPTION 'Missing required table: analytics';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'performance_scores') THEN
        RAISE EXCEPTION 'Missing required table: performance_scores';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'emg_data') THEN
        RAISE EXCEPTION 'Missing required table: emg_data';
    END IF;
    
    -- Check if BFR monitoring table exists (should already be there)
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'bfr_monitoring') THEN
        RAISE NOTICE 'BFR monitoring table not found - this is expected if BFR monitoring is not yet implemented';
    ELSE
        RAISE NOTICE 'BFR monitoring table found - processor will populate this separately from session_settings';
    END IF;
    
    RAISE NOTICE 'Schema validation complete: Core tables ready for MVC workflow with BFR monitoring separation';
END $$;

COMMIT;
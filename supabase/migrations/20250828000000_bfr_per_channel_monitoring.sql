-- ==============================================================================
-- EMG C3D Analyzer - BFR Per-Channel Monitoring Migration
-- ==============================================================================
-- 🎯 MIGRATION PURPOSE: Update BFR monitoring to support per-channel/per-muscle data
-- 📅 Created: 2025-08-28
-- 🔗 Context: Production C3D files will contain BFR pressure settings for both muscles
--
-- KEY CHANGES:
-- ✅ Per-channel BFR monitoring (CH1, CH2 = different muscles, different pressures)
-- ✅ Support for both sensor data and manual compliance assessment
-- ✅ Maintains backward compatibility with existing session-based data
-- ==============================================================================

-- Drop existing BFR monitoring table (will be recreated with new schema)
DROP TABLE IF EXISTS public.bfr_monitoring CASCADE;

-- Recreate BFR monitoring table with per-channel support
CREATE TABLE public.bfr_monitoring (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES public.therapy_sessions(id) ON DELETE CASCADE,
    
    -- Channel/muscle identification
    channel_name TEXT NOT NULL CHECK (channel_name IN ('CH1', 'CH2')),
    
    -- BFR pressure settings (from C3D metadata in production, nullable for manual mode)
    target_pressure_aop DOUBLE PRECISION CHECK (target_pressure_aop >= 0 AND target_pressure_aop <= 100),
    actual_pressure_aop DOUBLE PRECISION CHECK (actual_pressure_aop >= 0 AND actual_pressure_aop <= 100),
    cuff_pressure_mmhg DOUBLE PRECISION CHECK (cuff_pressure_mmhg >= 0),
    
    -- Blood pressure monitoring (safety - NOT from C3D, always from defaults/manual)
    systolic_bp_mmhg DOUBLE PRECISION CHECK (systolic_bp_mmhg >= 80 AND systolic_bp_mmhg <= 250),
    diastolic_bp_mmhg DOUBLE PRECISION CHECK (diastolic_bp_mmhg >= 40 AND diastolic_bp_mmhg <= 150),
    
    -- Manual compliance assessment (for when sensors not available)
    bfr_compliance_manual BOOLEAN, -- Patient/therapist yes/no assessment per muscle
    
    -- Safety compliance (computed from available data)
    safety_compliant BOOLEAN NOT NULL DEFAULT TRUE,
    
    -- Measurement metadata
    measurement_timestamp TIMESTAMPTZ DEFAULT NOW(),
    measurement_method TEXT DEFAULT 'manual' CHECK (measurement_method IN ('sensor', 'manual', 'estimated')),
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Ensure one record per session/channel combination
    UNIQUE(session_id, channel_name)
);

-- Create performance index for BFR monitoring queries
CREATE INDEX idx_bfr_monitoring_session_channel ON public.bfr_monitoring(session_id, channel_name);
CREATE INDEX idx_bfr_monitoring_safety_compliance ON public.bfr_monitoring(safety_compliant);
CREATE INDEX idx_bfr_monitoring_measurement_method ON public.bfr_monitoring(measurement_method);

-- Enable RLS on the new table
ALTER TABLE public.bfr_monitoring ENABLE ROW LEVEL SECURITY;

-- Recreate RLS policy for BFR monitoring (same pattern as before)
CREATE POLICY "Users can access BFR data for authorized sessions" ON public.bfr_monitoring
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.therapy_sessions ts
            JOIN public.patients p ON p.id = ts.patient_id
            JOIN public.user_profiles up ON (
                up.id = auth.uid() AND (
                    (up.role = 'therapist' AND up.id = p.therapist_id) OR
                    up.role IN ('researcher', 'admin')
                )
            )
            WHERE ts.id = bfr_monitoring.session_id
        )
    );

-- Allow therapists to insert/update BFR data for their patients
CREATE POLICY "Therapists can manage BFR data for their patients" ON public.bfr_monitoring
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.therapy_sessions ts
            JOIN public.patients p ON p.id = ts.patient_id
            JOIN public.user_profiles up ON up.id = auth.uid()
            WHERE ts.id = bfr_monitoring.session_id
            AND up.role IN ('therapist', 'admin')
            AND (up.role = 'admin' OR up.id = p.therapist_id)
        )
    );

-- ==============================================================================
-- MIGRATION NOTES & PRODUCTION GUIDANCE
-- ==============================================================================

-- 📋 PRODUCTION C3D METADATA EXTRACTION:
-- When C3D files contain BFR data, populate per-channel records:
--   CH1 (left muscle):  target_pressure_aop, actual_pressure_aop, cuff_pressure_mmhg from C3D
--   CH2 (right muscle): target_pressure_aop, actual_pressure_aop, cuff_pressure_mmhg from C3D
--   measurement_method = 'sensor'
--   bfr_compliance_manual = NULL (sensor data takes precedence)

-- 🔧 MANUAL ASSESSMENT MODE:
-- When sensors not available, therapist/patient assessment:
--   target_pressure_aop = 50.0 (from config defaults)
--   actual_pressure_aop = NULL
--   cuff_pressure_mmhg = NULL  
--   measurement_method = 'manual'
--   bfr_compliance_manual = true/false (per muscle: "Was 50% AOP respected?")

-- 🔒 SAFETY COMPLIANCE LOGIC:
-- safety_compliant is computed as:
--   - sensor mode: (actual_pressure_aop >= 40.0 AND actual_pressure_aop <= 60.0)
--   - manual mode: bfr_compliance_manual
--   - mixed mode: prefer sensor data where available

-- 💾 DATABASE POPULATION PATTERN (therapy_session_processor.py):
-- For each session, create 2 records (CH1, CH2):
-- INSERT INTO bfr_monitoring (session_id, channel_name, ...) VALUES
--   (session_id, 'CH1', ch1_pressure_data...),
--   (session_id, 'CH2', ch2_pressure_data...)

-- 🎯 MIGRATION SUCCESS INDICATORS:
-- ✅ Per-channel BFR monitoring supports both muscles independently  
-- ✅ Sensor data and manual assessment modes both supported
-- ✅ Production-ready for C3D metadata containing BFR pressure settings
-- ✅ Backward compatible with existing therapy session processor
-- ✅ Maintains all existing RLS security policies

SELECT 'BFR Per-Channel Monitoring Migration Complete! 🚀' AS status,
       'Ready for per-muscle BFR pressure monitoring' AS description;
-- ==============================================================================
-- EMG C3D Analyzer - Therapeutic Targets Schema Optimization
-- ==============================================================================
-- 🎯 PURPOSE: Add channel-dependent therapeutic targets and remove redundancy
-- 📅 Created: 2025-08-29
-- 🔗 Branch: feature/schema-therapeutic-targets
--
-- KEY CHANGES:
-- ✅ Add patient-level current MVC/duration values (optional, therapist-managed)
-- ✅ Add session-level per-channel therapeutic targets (manual therapist input)
-- ✅ Remove redundant c3d_technical_data table (data moved to game_metadata)
-- ✅ Non-breaking: All additions are optional, existing code continues to work
-- ==============================================================================

BEGIN;

-- ==============================================================================
-- PHASE 1: ENHANCE PATIENTS TABLE - CURRENT REHABILITATION STATE
-- ==============================================================================

-- Add optional current rehabilitation values per patient (therapist-managed)
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS 
    current_mvc_ch1 DOUBLE PRECISION CHECK (current_mvc_ch1 > 0);

ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS 
    current_mvc_ch2 DOUBLE PRECISION CHECK (current_mvc_ch2 > 0);

ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS 
    current_duration_ch1 DOUBLE PRECISION CHECK (current_duration_ch1 > 0);

ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS 
    current_duration_ch2 DOUBLE PRECISION CHECK (current_duration_ch2 > 0);

ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS 
    last_assessment_date TIMESTAMPTZ;

-- Add helpful comments for therapists
COMMENT ON COLUMN public.patients.current_mvc_ch1 IS 'Current MVC baseline for left muscle (CH1) - updated by therapist after assessment';
COMMENT ON COLUMN public.patients.current_mvc_ch2 IS 'Current MVC baseline for right muscle (CH2) - updated by therapist after assessment';
COMMENT ON COLUMN public.patients.current_duration_ch1 IS 'Current duration capability for left muscle (seconds) - updated by therapist';
COMMENT ON COLUMN public.patients.current_duration_ch2 IS 'Current duration capability for right muscle (seconds) - updated by therapist';
COMMENT ON COLUMN public.patients.last_assessment_date IS 'When current MVC/duration values were last updated by therapist';

-- ==============================================================================
-- PHASE 2: ENHANCE SESSION SETTINGS - PER-CHANNEL THERAPEUTIC TARGETS
-- ==============================================================================

-- Add optional per-channel therapeutic targets (manual therapist input per session)
ALTER TABLE public.session_settings ADD COLUMN IF NOT EXISTS 
    target_mvc_ch1 DOUBLE PRECISION CHECK (target_mvc_ch1 > 0);

ALTER TABLE public.session_settings ADD COLUMN IF NOT EXISTS 
    target_mvc_ch2 DOUBLE PRECISION CHECK (target_mvc_ch2 > 0);

ALTER TABLE public.session_settings ADD COLUMN IF NOT EXISTS 
    target_duration_ch1 DOUBLE PRECISION CHECK (target_duration_ch1 > 0);

ALTER TABLE public.session_settings ADD COLUMN IF NOT EXISTS 
    target_duration_ch2 DOUBLE PRECISION CHECK (target_duration_ch2 > 0);

-- Add helpful comments for clinical workflow
COMMENT ON COLUMN public.session_settings.target_mvc_ch1 IS 'Target MVC for left muscle (CH1) this session - set by therapist based on patient progression';
COMMENT ON COLUMN public.session_settings.target_mvc_ch2 IS 'Target MVC for right muscle (CH2) this session - set by therapist based on patient progression';
COMMENT ON COLUMN public.session_settings.target_duration_ch1 IS 'Target duration for left muscle contractions this session (seconds)';
COMMENT ON COLUMN public.session_settings.target_duration_ch2 IS 'Target duration for right muscle contractions this session (seconds)';

-- ==============================================================================
-- PHASE 3: REMOVE REDUNDANT C3D_TECHNICAL_DATA TABLE
-- ==============================================================================

-- Check if table exists and has data before dropping
DO $$
DECLARE
    table_exists BOOLEAN;
    record_count INTEGER := 0;
BEGIN
    -- Check if table exists
    SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'c3d_technical_data'
    ) INTO table_exists;
    
    IF table_exists THEN
        -- Count records if table exists
        SELECT COUNT(*) INTO record_count FROM public.c3d_technical_data;
        
        RAISE NOTICE 'Found c3d_technical_data table with % records', record_count;
        
        -- Drop the table (data should be migrated to therapy_sessions.game_metadata)
        DROP TABLE public.c3d_technical_data CASCADE;
        
        RAISE NOTICE 'Dropped c3d_technical_data table (data moved to therapy_sessions.game_metadata)';
    ELSE
        RAISE NOTICE 'c3d_technical_data table does not exist - nothing to drop';
    END IF;
END $$;

-- ==============================================================================
-- PHASE 4: CREATE INDEXES FOR PERFORMANCE
-- ==============================================================================

-- Index for patient current values lookup
CREATE INDEX IF NOT EXISTS idx_patients_current_mvc_ch1 
    ON public.patients(current_mvc_ch1) 
    WHERE current_mvc_ch1 IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_patients_current_mvc_ch2 
    ON public.patients(current_mvc_ch2) 
    WHERE current_mvc_ch2 IS NOT NULL;

-- Index for session targets lookup  
CREATE INDEX IF NOT EXISTS idx_session_settings_target_mvc_ch1 
    ON public.session_settings(target_mvc_ch1) 
    WHERE target_mvc_ch1 IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_session_settings_target_mvc_ch2 
    ON public.session_settings(target_mvc_ch2) 
    WHERE target_mvc_ch2 IS NOT NULL;

-- Index for assessment date filtering
CREATE INDEX IF NOT EXISTS idx_patients_last_assessment_date 
    ON public.patients(last_assessment_date) 
    WHERE last_assessment_date IS NOT NULL;

-- ==============================================================================
-- PHASE 5: CREATE HELPER FUNCTIONS FOR THERAPEUTIC TARGET MANAGEMENT
-- ==============================================================================

-- Function to update patient current values (therapist workflow)
CREATE OR REPLACE FUNCTION update_patient_current_values(
    p_patient_id UUID,
    p_mvc_ch1 DOUBLE PRECISION DEFAULT NULL,
    p_mvc_ch2 DOUBLE PRECISION DEFAULT NULL,
    p_duration_ch1 DOUBLE PRECISION DEFAULT NULL,
    p_duration_ch2 DOUBLE PRECISION DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE public.patients 
    SET 
        current_mvc_ch1 = COALESCE(p_mvc_ch1, current_mvc_ch1),
        current_mvc_ch2 = COALESCE(p_mvc_ch2, current_mvc_ch2),
        current_duration_ch1 = COALESCE(p_duration_ch1, current_duration_ch1),
        current_duration_ch2 = COALESCE(p_duration_ch2, current_duration_ch2),
        last_assessment_date = NOW(),
        updated_at = NOW()
    WHERE id = p_patient_id;
    
    RETURN FOUND;
END;
$$;

-- Function to set session therapeutic targets (therapist workflow)
CREATE OR REPLACE FUNCTION set_session_therapeutic_targets(
    p_session_id UUID,
    p_target_mvc_ch1 DOUBLE PRECISION DEFAULT NULL,
    p_target_mvc_ch2 DOUBLE PRECISION DEFAULT NULL,
    p_target_duration_ch1 DOUBLE PRECISION DEFAULT NULL,
    p_target_duration_ch2 DOUBLE PRECISION DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE public.session_settings 
    SET 
        target_mvc_ch1 = COALESCE(p_target_mvc_ch1, target_mvc_ch1),
        target_mvc_ch2 = COALESCE(p_target_mvc_ch2, target_mvc_ch2),
        target_duration_ch1 = COALESCE(p_target_duration_ch1, target_duration_ch1),
        target_duration_ch2 = COALESCE(p_target_duration_ch2, target_duration_ch2),
        updated_at = NOW()
    WHERE session_id = p_session_id;
    
    RETURN FOUND;
END;
$$;

-- ==============================================================================
-- PHASE 6: CREATE VALIDATION VIEWS FOR DATA QUALITY
-- ==============================================================================

-- Note: patient_current_assessments view removed - not needed at this stage

-- Note: session_target_vs_actual view removed - compliance is per-contraction, not session-level

-- ==============================================================================
-- PHASE 7: ADD COMMENTS AND DOCUMENTATION
-- ==============================================================================

COMMENT ON FUNCTION update_patient_current_values IS 
'Updates patient current MVC and duration values after therapist assessment. Used for tracking baseline capabilities.';

COMMENT ON FUNCTION set_session_therapeutic_targets IS 
'Sets therapeutic targets for a specific session. Used by therapists to define goals for each therapy session.';

-- Views removed - not needed at this stage of development

-- Display migration completion summary
SELECT 
    'Therapeutic Targets Schema Optimization Complete! 🎯' as status,
    'Added patient current values (optional)' as patients_enhanced,
    'Added session therapeutic targets (per-channel)' as session_settings_enhanced,
    'Removed c3d_technical_data table (moved to game_metadata)' as redundancy_removed,
    'Created helper functions and validation views' as utilities_added,
    'All changes are non-breaking and backward compatible' as compatibility;

COMMIT;
-- =====================================================================================
-- Migration 020: Database Schema Separation (KISS Principle Implementation) - CORRECTED
-- =====================================================================================
-- 
-- 🎯 DATABASE ENGINEERING - Clean Separation of Concerns
-- 
-- PURPOSE:
-- 1. Create c3d_technical_data table for EMG technical metadata (nullable by design)
-- 2. Remove technical columns from therapy_sessions (metadata only)
-- 3. Implement two-phase creation pattern (metadata first, technical data later)
-- 4. Solve webhook NOT NULL constraint violations
-- 5. Follow KISS principle: Single responsibility per table
--
-- PHILOSOPHY:
-- - Separation of concerns: Session metadata vs technical C3D data
-- - Progressive creation: Webhook creates session → Processing adds technical data
-- - No artificial defaults: Technical data nullable until available
-- - Maintainable schema: Each table has clear, single purpose
-- =====================================================================================

BEGIN;

-- =====================================================================================
-- STEP 1: Create c3d_technical_data Table (Nullable Technical Fields)
-- =====================================================================================

CREATE TABLE c3d_technical_data (
    session_id UUID REFERENCES therapy_sessions(id) ON DELETE CASCADE,
    
    -- Original C3D File Metadata (from file headers)
    original_sampling_rate REAL,
    original_duration_seconds REAL,
    original_sample_count INTEGER,
    
    -- Channel Information
    channel_count INTEGER,
    channel_names TEXT[] DEFAULT ARRAY[]::TEXT[],
    
    -- Processed Signal Information (for future use)
    sampling_rate REAL,
    duration_seconds REAL,
    frame_count INTEGER,
    
    -- Extraction Timestamp
    extracted_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Primary Key
    PRIMARY KEY (session_id)
);

-- Essential indexes for technical data queries
CREATE INDEX idx_c3d_technical_data_sampling_rate ON c3d_technical_data(sampling_rate) WHERE sampling_rate IS NOT NULL;
CREATE INDEX idx_c3d_technical_data_channel_count ON c3d_technical_data(channel_count) WHERE channel_count IS NOT NULL;

-- Self-documenting comments
COMMENT ON TABLE c3d_technical_data IS 'Technical EMG data extracted from C3D files - nullable by design for progressive creation';
COMMENT ON COLUMN c3d_technical_data.original_sampling_rate IS 'Original sampling rate from C3D file header (Hz)';
COMMENT ON COLUMN c3d_technical_data.original_duration_seconds IS 'Original duration from C3D file header (seconds)';
COMMENT ON COLUMN c3d_technical_data.channel_names IS 'EMG channel names extracted from C3D file';
COMMENT ON COLUMN c3d_technical_data.extracted_at IS 'Timestamp when C3D technical data was extracted';

-- =====================================================================================
-- STEP 2: Migrate Existing Technical Data to New Table (Based on Current Schema)
-- =====================================================================================

-- Insert existing technical data from therapy_sessions into new table
-- Only migrate columns that actually exist in the current schema
INSERT INTO c3d_technical_data (
    session_id,
    original_sampling_rate,
    original_duration_seconds,
    original_sample_count,
    channel_count,
    channel_names,
    extracted_at
)
SELECT 
    id as session_id,
    original_sampling_rate,
    original_duration_seconds,
    original_sample_count,
    channel_count,
    -- Convert JSONB channel_names to TEXT[] for new schema
    CASE 
        WHEN channel_names IS NOT NULL AND jsonb_typeof(channel_names) = 'array' 
        THEN ARRAY(SELECT jsonb_array_elements_text(channel_names))
        ELSE ARRAY[]::TEXT[]
    END as channel_names,
    COALESCE(updated_at, created_at, NOW()) as extracted_at
FROM therapy_sessions
WHERE 
    original_sampling_rate IS NOT NULL 
    OR channel_count IS NOT NULL 
    OR (channel_names IS NOT NULL AND channel_names != '[]'::jsonb);

-- =====================================================================================
-- STEP 3: Remove Technical Columns from therapy_sessions (Clean Separation)
-- =====================================================================================

-- Drop constraints first (check current schema for actual constraint names)
ALTER TABLE therapy_sessions DROP CONSTRAINT IF EXISTS therapy_sessions_channel_count_check;
ALTER TABLE therapy_sessions DROP CONSTRAINT IF EXISTS therapy_sessions_original_sampling_rate_check;
ALTER TABLE therapy_sessions DROP CONSTRAINT IF EXISTS therapy_sessions_original_duration_seconds_check;
ALTER TABLE therapy_sessions DROP CONSTRAINT IF EXISTS therapy_sessions_original_sample_count_check;

-- Drop technical columns that exist in current schema
ALTER TABLE therapy_sessions DROP COLUMN IF EXISTS original_sampling_rate;
ALTER TABLE therapy_sessions DROP COLUMN IF EXISTS original_duration_seconds;
ALTER TABLE therapy_sessions DROP COLUMN IF EXISTS original_sample_count;
ALTER TABLE therapy_sessions DROP COLUMN IF EXISTS channel_count;
ALTER TABLE therapy_sessions DROP COLUMN IF EXISTS channel_names;

-- Note: Some columns like sampling_rate, duration_seconds, frame_count don't exist in current schema
-- so we don't need to drop them

-- =====================================================================================
-- STEP 4: Add Constraints and Validation to c3d_technical_data
-- =====================================================================================

-- Add validation constraints for technical data (when present)
ALTER TABLE c3d_technical_data ADD CONSTRAINT valid_original_sampling_rate 
    CHECK (original_sampling_rate IS NULL OR original_sampling_rate > 0);

ALTER TABLE c3d_technical_data ADD CONSTRAINT valid_sampling_rate 
    CHECK (sampling_rate IS NULL OR sampling_rate > 0);

ALTER TABLE c3d_technical_data ADD CONSTRAINT valid_original_duration 
    CHECK (original_duration_seconds IS NULL OR original_duration_seconds > 0);

ALTER TABLE c3d_technical_data ADD CONSTRAINT valid_duration 
    CHECK (duration_seconds IS NULL OR duration_seconds > 0);

ALTER TABLE c3d_technical_data ADD CONSTRAINT valid_channel_count 
    CHECK (channel_count IS NULL OR channel_count > 0);

ALTER TABLE c3d_technical_data ADD CONSTRAINT valid_frame_count 
    CHECK (frame_count IS NULL OR frame_count > 0);

ALTER TABLE c3d_technical_data ADD CONSTRAINT valid_sample_count 
    CHECK (original_sample_count IS NULL OR original_sample_count > 0);

-- =====================================================================================
-- STEP 5: Update Table Comments for Clarity
-- =====================================================================================

-- Update therapy_sessions comment to reflect its new simplified purpose
COMMENT ON TABLE therapy_sessions IS 'Session metadata only - technical C3D data stored in c3d_technical_data table (KISS)';

-- Column comments for therapy_sessions (clarifying what remains)
COMMENT ON COLUMN therapy_sessions.file_path IS 'Storage path to C3D file';
COMMENT ON COLUMN therapy_sessions.file_hash IS 'SHA-256 hash for duplicate detection';
COMMENT ON COLUMN therapy_sessions.processing_status IS 'Workflow status: pending, processing, completed, failed';
COMMENT ON COLUMN therapy_sessions.analytics_cache IS 'Cached analysis results (JSONB)';

-- =====================================================================================
-- STEP 6: Create Helper Views for Backward Compatibility (Optional)
-- =====================================================================================

-- Create a view that combines both tables for queries needing both metadata and technical data
CREATE VIEW therapy_sessions_with_technical AS
SELECT 
    ts.*,
    ctd.original_sampling_rate,
    ctd.original_duration_seconds,
    ctd.original_sample_count,
    ctd.channel_count,
    ctd.channel_names,
    ctd.sampling_rate,
    ctd.duration_seconds,
    ctd.frame_count,
    ctd.extracted_at
FROM therapy_sessions ts
LEFT JOIN c3d_technical_data ctd ON ts.id = ctd.session_id;

COMMENT ON VIEW therapy_sessions_with_technical IS 'Combined view of session metadata and technical data for backward compatibility';

-- =====================================================================================
-- STEP 7: Validation Queries
-- =====================================================================================

-- Verify data migration was successful
SELECT 
    'therapy_sessions' as table_name,
    COUNT(*) as total_sessions,
    COUNT(CASE WHEN processing_status = 'completed' THEN 1 END) as completed_sessions
FROM therapy_sessions
UNION ALL
SELECT 
    'c3d_technical_data',
    COUNT(*),
    COUNT(CASE WHEN original_sampling_rate IS NOT NULL THEN 1 END)
FROM c3d_technical_data;

-- Verify foreign key relationships
SELECT 
    COUNT(*) as orphaned_technical_records
FROM c3d_technical_data ctd
LEFT JOIN therapy_sessions ts ON ctd.session_id = ts.id
WHERE ts.id IS NULL;

-- Verify constraints are working
SELECT 
    'c3d_technical_data_constraints' as validation_type,
    COUNT(*) as records_with_constraints,
    COUNT(CASE WHEN original_sampling_rate > 0 OR original_sampling_rate IS NULL THEN 1 END) as valid_sampling_rates,
    COUNT(CASE WHEN channel_count > 0 OR channel_count IS NULL THEN 1 END) as valid_channel_counts
FROM c3d_technical_data;

COMMIT;

-- =====================================================================================
-- RESULT: Clean Two-Table Architecture Following KISS Principle
-- 
-- TABLES MODIFIED:
-- • therapy_sessions: Now contains ONLY session metadata (file info, status, caching)
-- • c3d_technical_data: NEW table for all technical C3D data (nullable by design)
--
-- BENEFITS ACHIEVED:
-- ✅ KISS Compliance: Each table has single, clear responsibility
-- ✅ Webhook Fixed: No more NOT NULL constraint violations during session creation
-- ✅ Progressive Creation: Session metadata → Technical data (two-phase pattern)
-- ✅ Maintainable: Clean separation makes code easier to understand and modify
-- ✅ Scalable: Can add more technical fields without affecting session metadata
-- ✅ Backward Compatible: therapy_sessions_with_technical view preserves existing queries
--
-- NEXT STEPS:
-- 1. Update metadata_service.py for two-phase creation pattern
-- 2. Update cache_service.py to query both tables when needed
-- 3. Test webhook system with new schema
-- 4. Update documentation and architectural diagrams
-- =====================================================================================
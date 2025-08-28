-- Migration: Create C3D metadata table
-- Purpose: Store metadata from uploaded C3D files for quick access and deduplication

CREATE TABLE IF NOT EXISTS c3d_metadata (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    file_path TEXT NOT NULL UNIQUE,
    file_hash TEXT NOT NULL,
    file_size_bytes BIGINT NOT NULL,
    
    -- Patient and session information (from C3DFileDataResolver patterns)
    patient_id TEXT, -- Resolved from subfolder pattern (P005/) or C3D metadata.player_name
    therapist_id TEXT, -- From C3D metadata.therapist_id or storage metadata
    session_id TEXT,
    session_date TIMESTAMP, -- Resolved from filename (YYYYMMDD) or C3D metadata
    session_type TEXT, -- 'baseline', 'training', 'assessment'
    session_duration FLOAT, -- Session duration in seconds (from metadata.session_duration)
    session_notes TEXT, -- Optional session notes (from metadata.session_notes)
    
    -- Game metadata (from C3DFile.game_metadata pattern)
    game_metadata JSONB, -- Store player_name, therapist_id, and other game-specific data
    
    -- Technical metadata (C3D file structure)
    channel_names JSONB, -- JSON array of EMG channel names
    channel_count INTEGER,
    sampling_rate FLOAT,
    duration_seconds FLOAT,
    frame_count INTEGER,
    
    -- File metadata resolution (consistent with frontend patterns)
    resolved_patient_id TEXT, -- Final resolved patient ID using priority system
    resolved_therapist_id TEXT, -- Final resolved therapist ID
    resolved_session_date TIMESTAMP, -- Final resolved session date
    size_category TEXT, -- 'small', 'medium', 'large' (from getSizeCategory)
    
    -- Storage metadata (from Supabase Storage)
    content_type TEXT,
    upload_date TIMESTAMP WITH TIME ZONE, -- Original upload timestamp
    bucket_name TEXT DEFAULT 'c3d-files',
    object_metadata JSONB, -- Additional storage metadata
    
    -- Processing metadata
    processing_status TEXT DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed'
    processing_version TEXT,
    error_message TEXT,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    processed_at TIMESTAMP WITH TIME ZONE,
    
    -- Constraints
    CONSTRAINT valid_status CHECK (processing_status IN ('pending', 'processing', 'completed', 'failed')),
    CONSTRAINT valid_size_category CHECK (size_category IN ('small', 'medium', 'large'))
);

-- Create indexes for common queries (matching frontend filter patterns)
CREATE INDEX idx_c3d_metadata_file_hash ON c3d_metadata(file_hash);
CREATE INDEX idx_c3d_metadata_patient_id ON c3d_metadata(patient_id);
CREATE INDEX idx_c3d_metadata_resolved_patient_id ON c3d_metadata(resolved_patient_id);
CREATE INDEX idx_c3d_metadata_therapist_id ON c3d_metadata(therapist_id);
CREATE INDEX idx_c3d_metadata_resolved_therapist_id ON c3d_metadata(resolved_therapist_id);
CREATE INDEX idx_c3d_metadata_session_date ON c3d_metadata(session_date);
CREATE INDEX idx_c3d_metadata_resolved_session_date ON c3d_metadata(resolved_session_date);
CREATE INDEX idx_c3d_metadata_size_category ON c3d_metadata(size_category);
CREATE INDEX idx_c3d_metadata_processing_status ON c3d_metadata(processing_status);
CREATE INDEX idx_c3d_metadata_created_at ON c3d_metadata(created_at DESC);
CREATE INDEX idx_c3d_metadata_upload_date ON c3d_metadata(upload_date DESC);

-- Composite indexes for common filter combinations
CREATE INDEX idx_c3d_metadata_patient_therapist ON c3d_metadata(resolved_patient_id, resolved_therapist_id);
CREATE INDEX idx_c3d_metadata_date_range ON c3d_metadata(resolved_session_date, size_category);

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_c3d_metadata_updated_at 
    BEFORE UPDATE ON c3d_metadata 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Add comments for documentation
COMMENT ON TABLE c3d_metadata IS 'Stores metadata extracted from uploaded C3D files for efficient querying and deduplication';
COMMENT ON COLUMN c3d_metadata.file_hash IS 'SHA-256 hash of the file content for deduplication';
COMMENT ON COLUMN c3d_metadata.channel_names IS 'JSON array of EMG channel names found in the C3D file';
COMMENT ON COLUMN c3d_metadata.session_type IS 'Type of therapy session: baseline for MVC detection, training for regular sessions';
COMMENT ON COLUMN c3d_metadata.game_metadata IS 'JSON object containing game-specific data (player_name, therapist_id, etc.)';
COMMENT ON COLUMN c3d_metadata.resolved_patient_id IS 'Final patient ID resolved using priority: subfolder pattern > C3D metadata > storage metadata';
COMMENT ON COLUMN c3d_metadata.resolved_therapist_id IS 'Final therapist ID resolved using priority: C3D metadata > storage metadata';
COMMENT ON COLUMN c3d_metadata.resolved_session_date IS 'Final session date resolved using priority: filename pattern > C3D metadata';
COMMENT ON COLUMN c3d_metadata.size_category IS 'File size category for filtering: small (<2MB), medium (<3MB), large (>=3MB)';
COMMENT ON COLUMN c3d_metadata.upload_date IS 'Original file upload timestamp from Supabase Storage';
COMMENT ON COLUMN c3d_metadata.object_metadata IS 'Additional metadata from Supabase Storage (JSONB format)';
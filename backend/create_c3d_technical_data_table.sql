-- Create c3d_technical_data table for EMG analysis
-- This is a minimal table to support the existing code
CREATE TABLE IF NOT EXISTS c3d_technical_data (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    session_id UUID NOT NULL REFERENCES therapy_sessions(id) ON DELETE CASCADE,
    original_sampling_rate FLOAT DEFAULT 1000.0,
    original_duration_seconds FLOAT DEFAULT 0.0,
    original_sample_count INTEGER DEFAULT 0,
    channel_count INTEGER DEFAULT 0,
    channel_names JSONB DEFAULT '[]',
    sampling_rate FLOAT DEFAULT 1000.0,
    duration_seconds FLOAT DEFAULT 0.0,
    frame_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure one record per session
    CONSTRAINT unique_session_technical_data UNIQUE(session_id)
);

-- Index for fast lookups
CREATE INDEX idx_c3d_technical_data_session_id ON c3d_technical_data(session_id);

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_c3d_technical()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_c3d_technical_data_updated_at
    BEFORE UPDATE ON c3d_technical_data
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_c3d_technical();

-- Comment
COMMENT ON TABLE c3d_technical_data IS 'Technical metadata extracted from C3D files';
-- Migration: Create analysis results cache table
-- Purpose: Cache processed EMG analysis results to avoid reprocessing identical files

CREATE TABLE IF NOT EXISTS analysis_results (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    c3d_metadata_id UUID NOT NULL REFERENCES c3d_metadata(id) ON DELETE CASCADE,
    
    -- Cache key for quick lookup
    file_hash TEXT NOT NULL,
    processing_version TEXT NOT NULL,
    processing_params JSONB, -- MVC values, thresholds, etc. used for processing
    
    -- Complete analysis results
    analytics_data JSONB NOT NULL, -- Full ChannelAnalytics data
    emg_signals JSONB, -- Optional: store processed signals for quick retrieval
    contractions_data JSONB, -- Detected contractions with quality flags
    
    -- Performance metrics
    processing_time_ms INTEGER,
    cache_hits INTEGER DEFAULT 0,
    last_accessed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Clinical metrics (denormalized for quick queries)
    mvc_values JSONB, -- Per-muscle MVC values calculated
    good_contractions_count INTEGER,
    total_contractions_count INTEGER,
    compliance_scores JSONB, -- Left/right compliance scores
    
    -- Temporal statistics
    temporal_stats JSONB, -- Mean, std, min, max for each metric
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '30 days'),
    
    -- Unique constraint to prevent duplicate processing
    CONSTRAINT unique_analysis_cache UNIQUE (file_hash, processing_version, processing_params)
);

-- Create indexes for performance
CREATE INDEX idx_analysis_results_file_hash ON analysis_results(file_hash);
CREATE INDEX idx_analysis_results_c3d_metadata_id ON analysis_results(c3d_metadata_id);
CREATE INDEX idx_analysis_results_created_at ON analysis_results(created_at DESC);
CREATE INDEX idx_analysis_results_expires_at ON analysis_results(expires_at);
CREATE INDEX idx_analysis_results_last_accessed ON analysis_results(last_accessed_at DESC);

-- Function to update cache hit count and last accessed time
CREATE OR REPLACE FUNCTION update_cache_hit()
RETURNS TRIGGER AS $$
BEGIN
    NEW.cache_hits = OLD.cache_hits + 1;
    NEW.last_accessed_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create a view for frequently accessed analysis summaries
CREATE OR REPLACE VIEW analysis_summary AS
SELECT 
    ar.id,
    cm.file_path,
    cm.patient_id,
    cm.session_date,
    cm.session_type,
    ar.mvc_values,
    ar.good_contractions_count,
    ar.total_contractions_count,
    ar.compliance_scores,
    ar.processing_time_ms,
    ar.cache_hits,
    ar.created_at,
    ar.last_accessed_at
FROM analysis_results ar
JOIN c3d_metadata cm ON ar.c3d_metadata_id = cm.id
WHERE ar.expires_at > NOW()
ORDER BY ar.last_accessed_at DESC;

-- Add comments for documentation
COMMENT ON TABLE analysis_results IS 'Caches processed EMG analysis results to improve performance for repeated file access';
COMMENT ON COLUMN analysis_results.file_hash IS 'SHA-256 hash linking to the source C3D file';
COMMENT ON COLUMN analysis_results.analytics_data IS 'Complete ChannelAnalytics data in JSON format';
COMMENT ON COLUMN analysis_results.processing_params IS 'Parameters used for processing (MVC values, thresholds) to ensure cache validity';
COMMENT ON COLUMN analysis_results.expires_at IS 'Automatic cache expiry after 30 days, configurable';
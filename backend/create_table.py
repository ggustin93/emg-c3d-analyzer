#!/usr/bin/env python3
"""Create c3d_technical_data table."""

import sys
from database.supabase_client import get_supabase_client

def main():
    """Create the c3d_technical_data table."""
    sql = """
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
CREATE INDEX IF NOT EXISTS idx_c3d_technical_data_session_id ON c3d_technical_data(session_id);
"""
    
    try:
        client = get_supabase_client(use_service_key=True)
        result = client.rpc("exec_sql", {"sql_query": sql}).execute()
        print("✅ c3d_technical_data table created successfully")
        print(f"Result: {result.data}")
        return True
        
    except Exception as e:
        print(f"❌ Failed to create table: {e}")
        try:
            # Alternative approach - try direct SQL execution
            print("Trying alternative SQL execution...")
            from supabase import create_client
            import os
            
            url = os.getenv("SUPABASE_URL")
            key = os.getenv("SUPABASE_ANON_KEY") 
            
            if url and key:
                client = create_client(url, key)
                # This might not work, but worth trying
                print("Alternative method not available - manual table creation needed")
            else:
                print("Missing SUPABASE_URL or SUPABASE_ANON_KEY environment variables")
            
        except Exception as e2:
            print(f"Alternative method also failed: {e2}")
        
        return False

if __name__ == "__main__":
    sys.exit(0 if main() else 1)
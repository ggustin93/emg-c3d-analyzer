-- Migration: Remove deprecated session_id column from therapy_sessions
-- Date: 2025-09-02
-- Purpose: Complete transition to session_code format (P###S###)

-- Drop the deprecated session_id column
ALTER TABLE public.therapy_sessions 
DROP COLUMN IF EXISTS session_id;

-- Add comment to document the change
COMMENT ON TABLE public.therapy_sessions IS 'Therapy session records with session_code as primary identifier (format: P###S### e.g., P003S001)';

-- Rollback script (commented out for safety)
-- To rollback this migration, run:
-- ALTER TABLE public.therapy_sessions ADD COLUMN session_id text;
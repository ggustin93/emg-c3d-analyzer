-- Migration: Update therapy_sessions table to use session_code instead of session_id
-- Date: 2025-09-02
-- Author: EMG C3D Analyzer Team
-- Description: Rename session_id to session_code with new format "P###S###"
--              where P### is patient code and S### is session number
--
-- Changes:
-- 1. Rename session_id column to session_code
-- 2. Update constraints and indexes to reference session_code
-- 3. Ensure proper format validation for session_code

-- Step 1: Add the new session_code column if it doesn't exist
ALTER TABLE public.therapy_sessions 
ADD COLUMN IF NOT EXISTS session_code text;

-- Step 2: Add comment for the new column
COMMENT ON COLUMN public.therapy_sessions.session_code IS 'Unique session identifier in format P###S### (e.g., P003S001 for patient 3, session 1)';

-- Step 3: Migrate existing data from session_id to session_code if needed
-- This assumes existing session_id values need to be preserved
UPDATE public.therapy_sessions 
SET session_code = session_id
WHERE session_code IS NULL AND session_id IS NOT NULL;

-- Step 4: Drop the old session_id column and its constraints
ALTER TABLE public.therapy_sessions 
DROP CONSTRAINT IF EXISTS therapy_sessions_pkey CASCADE;

ALTER TABLE public.therapy_sessions 
DROP COLUMN IF EXISTS session_id;

-- Step 5: Set session_code as NOT NULL and add it as primary key
ALTER TABLE public.therapy_sessions 
ALTER COLUMN session_code SET NOT NULL;

ALTER TABLE public.therapy_sessions 
ADD CONSTRAINT therapy_sessions_pkey PRIMARY KEY (session_code);

-- Step 6: Add check constraint for session_code format (P###S###)
ALTER TABLE public.therapy_sessions
ADD CONSTRAINT session_code_format_check 
CHECK (session_code ~ '^P[0-9]{3}S[0-9]{3}$');

-- Step 7: Create index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_therapy_sessions_session_code 
ON public.therapy_sessions(session_code);

-- Step 8: Create index for patient lookups (extract patient part)
CREATE INDEX IF NOT EXISTS idx_therapy_sessions_patient_code 
ON public.therapy_sessions(substring(session_code from 1 for 4));

-- Step 9: Update any foreign key references in other tables
-- Update therapy_session_metrics if it exists
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'therapy_session_metrics'
    ) THEN
        -- Rename column in therapy_session_metrics
        ALTER TABLE public.therapy_session_metrics 
        RENAME COLUMN session_id TO session_code;
        
        -- Update foreign key constraint
        ALTER TABLE public.therapy_session_metrics
        DROP CONSTRAINT IF EXISTS therapy_session_metrics_session_id_fkey;
        
        ALTER TABLE public.therapy_session_metrics
        ADD CONSTRAINT therapy_session_metrics_session_code_fkey 
        FOREIGN KEY (session_code) 
        REFERENCES public.therapy_sessions(session_code) 
        ON DELETE CASCADE;
    END IF;
END $$;

-- Step 10: Update session_settings table if it references session_id
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'session_settings'
        AND column_name = 'session_id'
    ) THEN
        -- Rename column in session_settings
        ALTER TABLE public.session_settings 
        RENAME COLUMN session_id TO session_code;
        
        -- Update foreign key constraint
        ALTER TABLE public.session_settings
        DROP CONSTRAINT IF EXISTS session_settings_session_id_fkey;
        
        ALTER TABLE public.session_settings
        ADD CONSTRAINT session_settings_session_code_fkey 
        FOREIGN KEY (session_code) 
        REFERENCES public.therapy_sessions(session_code) 
        ON DELETE CASCADE;
    END IF;
END $$;

-- Verification query (commented out, for manual verification if needed)
-- SELECT 
--     column_name, 
--     data_type, 
--     is_nullable,
--     column_default
-- FROM information_schema.columns 
-- WHERE table_schema = 'public' 
-- AND table_name = 'therapy_sessions'
-- AND column_name = 'session_code';
-- Add user_code to user_profiles table for human-readable identification
-- Format: T001-T999 for therapists, R001-R999 for researchers, A001-A999 for admins
-- T000 is reserved for unknown/missing therapist

-- Create sequences for each role
CREATE SEQUENCE IF NOT EXISTS therapist_code_seq START 1;
CREATE SEQUENCE IF NOT EXISTS researcher_code_seq START 1;  
CREATE SEQUENCE IF NOT EXISTS admin_code_seq START 1;

-- Add user_code column
ALTER TABLE public.user_profiles 
ADD COLUMN IF NOT EXISTS user_code text UNIQUE;

-- Create function to generate user_code based on role
CREATE OR REPLACE FUNCTION generate_user_code()
RETURNS TRIGGER AS $$
BEGIN
    -- Only generate if user_code is not provided
    IF NEW.user_code IS NULL THEN
        CASE NEW.role
            WHEN 'therapist' THEN
                NEW.user_code := 'T' || lpad(nextval('therapist_code_seq')::text, 3, '0');
            WHEN 'researcher' THEN
                NEW.user_code := 'R' || lpad(nextval('researcher_code_seq')::text, 3, '0');
            WHEN 'admin' THEN
                NEW.user_code := 'A' || lpad(nextval('admin_code_seq')::text, 3, '0');
            ELSE
                -- Should not happen due to CHECK constraint on role
                RAISE EXCEPTION 'Invalid role: %', NEW.role;
        END CASE;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-generate user_code on insert
DROP TRIGGER IF EXISTS generate_user_code_trigger ON public.user_profiles;
CREATE TRIGGER generate_user_code_trigger
    BEFORE INSERT ON public.user_profiles
    FOR EACH ROW
    EXECUTE FUNCTION generate_user_code();

-- Update existing users with codes if they don't have one
-- This assigns codes based on creation order
WITH therapists AS (
    SELECT id, ROW_NUMBER() OVER (ORDER BY created_at) as rn
    FROM public.user_profiles
    WHERE role = 'therapist' AND user_code IS NULL
),
researchers AS (
    SELECT id, ROW_NUMBER() OVER (ORDER BY created_at) as rn
    FROM public.user_profiles
    WHERE role = 'researcher' AND user_code IS NULL
),
admins AS (
    SELECT id, ROW_NUMBER() OVER (ORDER BY created_at) as rn
    FROM public.user_profiles
    WHERE role = 'admin' AND user_code IS NULL
)
UPDATE public.user_profiles
SET user_code = CASE
    WHEN id IN (SELECT id FROM therapists) THEN 
        'T' || lpad((SELECT rn FROM therapists WHERE therapists.id = user_profiles.id)::text, 3, '0')
    WHEN id IN (SELECT id FROM researchers) THEN
        'R' || lpad((SELECT rn FROM researchers WHERE researchers.id = user_profiles.id)::text, 3, '0')
    WHEN id IN (SELECT id FROM admins) THEN
        'A' || lpad((SELECT rn FROM admins WHERE admins.id = user_profiles.id)::text, 3, '0')
END
WHERE user_code IS NULL;

-- Update sequences to continue from highest existing number
SELECT setval('therapist_code_seq', 
    COALESCE((SELECT MAX(substring(user_code from 2)::int) 
              FROM public.user_profiles 
              WHERE user_code LIKE 'T%'), 0)
);

SELECT setval('researcher_code_seq',
    COALESCE((SELECT MAX(substring(user_code from 2)::int)
              FROM public.user_profiles
              WHERE user_code LIKE 'R%'), 0)
);

SELECT setval('admin_code_seq',
    COALESCE((SELECT MAX(substring(user_code from 2)::int)
              FROM public.user_profiles
              WHERE user_code LIKE 'A%'), 0)
);

-- Add check constraint to ensure proper format
ALTER TABLE public.user_profiles
ADD CONSTRAINT user_code_format_check 
CHECK (user_code ~ '^[TRA][0-9]{3}$');

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_profiles_user_code 
ON public.user_profiles(user_code);

-- Note: The special T000 user for unknown therapist should be created through Supabase Auth
-- or as part of seed data. It cannot be created here due to foreign key constraint with auth.users.
-- The application should handle missing therapist cases gracefully by:
-- 1. Looking up by user_code if provided in C3D
-- 2. Falling back to a default therapist account if configured
-- 3. Recording the session with NULL therapist_id if neither exists
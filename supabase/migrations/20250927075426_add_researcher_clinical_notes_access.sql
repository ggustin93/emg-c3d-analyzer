-- ================================================================
-- ADD RESEARCHER CLINICAL NOTES ACCESS
-- ================================================================
-- Author: Claude Code
-- Date: January 27, 2025
-- Description: Allow researchers to add and view their own clinical notes
-- 
-- SECURITY REQUIREMENTS:
-- ✅ Researchers can add clinical notes for analysis purposes
-- ✅ Researchers can only see their own notes (author_id = auth.uid())
-- ✅ Researchers cannot see therapist or admin notes
-- ✅ Maintains data privacy and role-based access control
-- ================================================================

-- Add RLS policy for researchers to access clinical notes
-- Researchers can perform ALL operations (INSERT, SELECT, UPDATE, DELETE) 
-- but only on notes they authored (author_id = auth.uid())
CREATE POLICY "researcher_own_clinical_notes" ON public.clinical_notes
    FOR ALL USING (
        get_user_role() = 'researcher' AND 
        author_id = auth.uid()
    );

-- Verify the policy was created
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'clinical_notes' 
        AND policyname = 'researcher_own_clinical_notes'
    ) THEN
        RAISE NOTICE '✅ Researcher clinical notes policy created successfully';
    ELSE
        RAISE EXCEPTION '❌ Failed to create researcher clinical notes policy';
    END IF;
END $$;

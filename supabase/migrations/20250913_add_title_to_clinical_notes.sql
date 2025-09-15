-- Add title field to clinical_notes table
-- Migration: Add title field to clinical_notes table
-- Date: 2025-09-13
-- Description: Adds a title field to improve note organization and display

-- Add the title column
ALTER TABLE clinical_notes 
ADD COLUMN title VARCHAR(255) NOT NULL DEFAULT 'Note Clinique';

-- Create index for title for better search performance
CREATE INDEX idx_clinical_notes_title ON clinical_notes(title);

-- Update existing notes with default titles based on note_type
UPDATE clinical_notes 
SET title = CASE 
    WHEN note_type = 'patient' THEN 'Note Patient'
    WHEN note_type = 'file' THEN 'Note Session'
    ELSE 'Note Clinique'
END;

-- Add comment to the column
COMMENT ON COLUMN clinical_notes.title IS 'Title of the clinical note for better organization and display';
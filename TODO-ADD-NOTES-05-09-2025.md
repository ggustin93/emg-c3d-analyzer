# PRD - Clinical Notes Feature

**Project**: EMG C3D Analyzer  
**Feature**: Clinical Notes System  
**Date**: September 5, 2025  
**Status**: Planning  
**Priority**: Medium  
**Target Users**: Researchers, Therapists  

## 1. Executive Summary

Add clinical note-taking capabilities to the C3D File Browser, allowing researchers and therapists to create private markdown notes linked to specific files or patients. This feature enables clinical documentation and observation tracking without disrupting the current analysis workflow.

## 2. Problem Statement

Researchers and therapists need to document clinical observations, technical notes, and patient-specific insights during rehabilitation session analysis. Currently, there's no integrated way to capture and retrieve this critical contextual information within the platform.

## 3. Solution Overview

Implement a dual-level note system with:
- **File-level notes**: Observations specific to individual C3D files
- **Patient-level notes**: General observations about a patient across sessions
- **Private workspace**: Each user sees only their own notes (RLS security)
- **Markdown support**: Simple formatting for clinical documentation

## 4. Technical Architecture

### 4.1 Database Schema

```sql
-- New table for clinical notes
CREATE TABLE clinical_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id UUID NOT NULL REFERENCES auth.users(id),
  
  -- Flexible targeting (file OR patient)
  file_path TEXT, -- Links to C3D file path in storage
  patient_id TEXT, -- Links to resolved patient ID
  
  -- Content
  content TEXT NOT NULL, -- Markdown formatted content
  note_type TEXT NOT NULL CHECK (note_type IN ('file', 'patient')),
  
  -- Metadata
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  -- Constraint: must target either file OR patient, not both
  CONSTRAINT note_target_check CHECK (
    (file_path IS NOT NULL AND patient_id IS NULL) OR 
    (file_path IS NULL AND patient_id IS NOT NULL)
  )
);

-- Performance indexes
CREATE INDEX idx_clinical_notes_author ON clinical_notes(author_id);
CREATE INDEX idx_clinical_notes_file ON clinical_notes(file_path);
CREATE INDEX idx_clinical_notes_patient ON clinical_notes(patient_id);

-- Row Level Security
ALTER TABLE clinical_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can only access their own notes" ON clinical_notes
  FOR ALL USING (auth.uid() = author_id);
```

### 4.2 Backend Components

#### API Endpoints
```python
# New endpoints in FastAPI backend
POST   /api/notes/file/{file_path}     # Create file note
GET    /api/notes/file/{file_path}     # Get file notes
PUT    /api/notes/{note_id}            # Update note
DELETE /api/notes/{note_id}            # Delete note

POST   /api/notes/patient/{patient_id} # Create patient note  
GET    /api/notes/patient/{patient_id} # Get patient notes

GET    /api/notes/indicators           # Get note counts for UI badges
```

#### Service Layer
```python
# backend/services/clinical/notes_service.py
class ClinicalNotesService:
    @staticmethod
    async def create_file_note(file_path: str, content: str, author_id: str) -> Note
    
    @staticmethod
    async def create_patient_note(patient_id: str, content: str, author_id: str) -> Note
    
    @staticmethod
    async def get_user_notes(author_id: str, file_paths: List[str], patient_ids: List[str]) -> NotesIndicators
    
    @staticmethod  
    async def update_note(note_id: str, content: str, author_id: str) -> Note
    
    @staticmethod
    async def delete_note(note_id: str, author_id: str) -> bool
```

### 4.3 Frontend Components

#### New Components
```typescript
// frontend/src/components/notes/
├── NotesModal.tsx           # Main modal for note editing
├── MarkdownEditor.tsx       # Simple markdown editor component
├── NoteBadge.tsx           # Badge showing note count
├── NoteIndicator.tsx       # Icon for empty state
└── hooks/
    └── useNotes.ts         # Custom hook for notes management
```

#### Updated Components
```typescript
// frontend/src/components/c3d/
├── C3DFileList.tsx         # Add notes column
├── C3DFileBrowser.tsx      # Notes modal state management
└── types/
    └── notes.ts           # TypeScript interfaces
```

## 5. User Experience Design

### 5.1 Visual Integration

**New Column in File Browser:**
- Header: "Notes" 
- Width: ~80px (minimal footprint)
- Content: Badge indicators or add buttons

**Badge System:**
- **File notes**: `📝 3` (secondary badge, blue theme)
- **Patient notes**: `👤 2` (outline badge, green theme)  
- **Empty state**: Subtle icon buttons (`✏️`, `👤+`)

### 5.2 Interaction Flow

**Adding Notes:**
1. Click badge/icon in notes column
2. Modal opens with simple markdown editor
3. Type note with basic formatting toolbar
4. Save → Badge updates with count

**Viewing/Editing Notes:**
1. Click existing badge
2. Modal shows list of notes (if multiple)
3. Click note to edit
4. Preview mode available

### 5.3 Markdown Editor Specs

**Minimal Toolbar:**
- Bold (**text**)
- Italic (*text*)  
- Bullet list (- item)
- Preview toggle

**Target Users:** Non-technical researchers
**Approach:** Simple, familiar interface with immediate preview

## 6. Implementation Plan

### Phase 1: Backend Foundation (2-3 days)
- [ ] Create `clinical_notes` table with RLS
- [ ] Implement `ClinicalNotesService` class
- [ ] Add API endpoints with authentication
- [ ] Write unit tests for service layer

### Phase 2: Frontend Core (3-4 days)  
- [ ] Create notes TypeScript interfaces
- [ ] Implement `useNotes` custom hook
- [ ] Build `NotesModal` and `MarkdownEditor` components
- [ ] Add notes column to `C3DFileList`

### Phase 3: UI Polish (1-2 days)
- [ ] Implement badge indicators and empty states
- [ ] Add loading states and error handling  
- [ ] Polish modal UX and responsive design
- [ ] Write frontend component tests

### Phase 4: Integration Testing (1 day)
- [ ] E2E tests for note creation/editing workflows
- [ ] Performance testing with large note volumes
- [ ] Cross-browser compatibility testing

**Total Estimate:** 7-10 development days

## 7. Success Metrics

### Functional Requirements
- [ ] Users can create file-specific notes
- [ ] Users can create patient-level notes  
- [ ] Notes support basic markdown formatting
- [ ] Each user sees only their own notes (privacy)
- [ ] Note counts display accurately in file browser

### Performance Requirements
- [ ] Notes column loads without impacting browser performance
- [ ] Modal opens within 200ms
- [ ] Batch loading of note indicators for 50+ files

### Usability Requirements
- [ ] Non-technical users can create formatted notes
- [ ] Clear visual distinction between file vs patient notes
- [ ] Intuitive workflow that doesn't disrupt analysis tasks

## 8. Risk Assessment

### Technical Risks
- **Low Risk**: Standard CRUD operations with existing auth
- **Low Risk**: UI integration into existing component structure

### UX Risks  
- **Medium Risk**: Markdown editor complexity for non-tech users
  - *Mitigation*: Keep toolbar minimal, provide clear preview

### Performance Risks
- **Low Risk**: Additional database queries for note indicators
  - *Mitigation*: Batch loading and caching strategies

## 9. Future Enhancements

### V1.1 Potential Features
- Note templates for common observations
- Rich text editor option alongside markdown
- Note export with analysis reports
- Shared notes between team members (role-based)

### Integration Opportunities
- Link notes to specific analysis metrics
- Add notes during live analysis sessions
- Search functionality across all user notes

## 10. Dependencies

### Technical Dependencies
- Existing Supabase RLS system
- Current user authentication flow
- React-markdown library for rendering
- Existing UI component library (Shadcn)

### Design Dependencies  
- No new design system components required
- Leverage existing modal and badge patterns
- Follow current color scheme and spacing

---

**Approval Required From:**
- [ ] Product Owner (feature scope)
- [ ] Technical Lead (architecture review)  
- [ ] UX Lead (interaction design)

**Ready for Implementation:** ✅ All requirements specified
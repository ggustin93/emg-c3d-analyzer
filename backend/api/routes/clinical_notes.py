"""
Clinical Notes API Routes - EMG C3D Analyzer
=============================================

API endpoints for clinical note management with hybrid patient identification.
API accepts patient_code for user convenience, stores patient_id UUID for database integrity.

Key Features:
- Hybrid patient identification (patient_code → patient_id conversion)
- File path and patient note support
- Batch loading for UI performance optimization
- Row Level Security (RLS) enforcement
- Integration with existing EMG C3D Analyzer patterns
"""

from typing import List
from uuid import UUID
import logging

from fastapi import APIRouter, HTTPException, Depends, Path, Query
from supabase import Client

from models.clinical.clinical_notes import (
    ClinicalNote,
    ClinicalNoteWithPatientCode,
    CreateNoteRequest,
    UpdateNoteRequest,
    NotesIndicators,
    NotesIndicatorsRequest,
    NotesListResponse,
    ClinicalNotesError
)
from services.clinical.notes_service import ClinicalNotesService
from api.dependencies.services import get_clinical_notes_service
from api.dependencies.validation import get_current_user_id

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/clinical-notes", tags=["clinical-notes"])


@router.post("/file", response_model=ClinicalNote)
async def create_file_note(
    request: CreateNoteRequest,
    file_path: str = Query(..., description="C3D file path"),
    notes_service: ClinicalNotesService = Depends(get_clinical_notes_service),
    author_id: UUID = Depends(get_current_user_id)
):
    """
    Create a clinical note associated with a specific C3D file.
    
    Args:
        request: Note creation request with content
        file_path: Storage path to C3D file
        notes_service: Injected notes service
        author_id: Current authenticated user ID
        
    Returns:
        ClinicalNote: Created note with generated ID and timestamps
        
    Raises:
        HTTPException: 400 for validation errors, 500 for server errors
    """
    try:
        # Validate note type
        if request.note_type != 'file':
            raise HTTPException(
                status_code=400, 
                detail="Note type must be 'file' for file notes"
            )
        
        note = notes_service.create_file_note(
            file_path=file_path,
            content=request.content,
            author_id=author_id
        )
        
        logger.info(f"File note created: {note.id} for path: {file_path}")
        return note
        
    except ValueError as e:
        logger.warning(f"Validation error creating file note: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error creating file note: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to create file note: {str(e)}")


@router.post("/patient/{patient_code}", response_model=ClinicalNote)
async def create_patient_note(
    request: CreateNoteRequest,
    patient_code: str = Path(..., description="Patient code (e.g., P001)"),
    notes_service: ClinicalNotesService = Depends(get_clinical_notes_service),
    author_id: UUID = Depends(get_current_user_id)
):
    """
    Create a clinical note associated with a patient across sessions.
    Accepts patient_code for convenience, stores patient_id for integrity.
    
    Args:
        request: Note creation request with content
        patient_code: User-friendly patient identifier (e.g., "P001")
        notes_service: Injected notes service
        author_id: Current authenticated user ID
        
    Returns:
        ClinicalNote: Created note with generated ID and timestamps
        
    Raises:
        HTTPException: 400 for validation errors, 404 for patient not found, 500 for server errors
    """
    try:
        # Validate note type
        if request.note_type != 'patient':
            raise HTTPException(
                status_code=400, 
                detail="Note type must be 'patient' for patient notes"
            )
        
        note = notes_service.create_patient_note(
            patient_code=patient_code,
            content=request.content,
            author_id=author_id
        )
        
        logger.info(f"Patient note created: {note.id} for patient: {patient_code}")
        return note
        
    except ValueError as e:
        # Patient not found or validation error
        if "not found" in str(e):
            logger.warning(f"Patient not found: {patient_code}")
            raise HTTPException(status_code=404, detail=str(e))
        logger.warning(f"Validation error creating patient note: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error creating patient note: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to create patient note: {str(e)}")


@router.get("/file", response_model=NotesListResponse)
async def get_file_notes(
    file_path: str = Query(..., description="C3D file path"),
    notes_service: ClinicalNotesService = Depends(get_clinical_notes_service),
    author_id: UUID = Depends(get_current_user_id)
):
    """
    Retrieve all notes for a specific file by current user.
    
    Args:
        file_path: Storage path to C3D file
        notes_service: Injected notes service
        author_id: Current authenticated user ID
        
    Returns:
        NotesListResponse: List of notes with resolved patient codes
    """
    try:
        notes = notes_service.get_file_notes(
            file_path=file_path,
            author_id=author_id
        )
        
        logger.info(f"Retrieved {len(notes)} file notes for path: {file_path}")
        return NotesListResponse(notes=notes, total_count=len(notes))
        
    except Exception as e:
        logger.error(f"Error retrieving file notes: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to retrieve file notes: {str(e)}")


@router.get("/patient/{patient_code}", response_model=NotesListResponse)
async def get_patient_notes(
    patient_code: str = Path(..., description="Patient code (e.g., P001)"),
    notes_service: ClinicalNotesService = Depends(get_clinical_notes_service),
    author_id: UUID = Depends(get_current_user_id)
):
    """
    Retrieve all notes for a specific patient by current user.
    Accepts patient_code, converts to patient_id for querying.
    
    Args:
        patient_code: User-friendly patient identifier (e.g., "P001")
        notes_service: Injected notes service
        author_id: Current authenticated user ID
        
    Returns:
        NotesListResponse: List of notes with resolved patient codes
    """
    try:
        notes = notes_service.get_patient_notes(
            patient_code=patient_code,
            author_id=author_id
        )
        
        logger.info(f"Retrieved {len(notes)} patient notes for: {patient_code}")
        return NotesListResponse(notes=notes, total_count=len(notes))
        
    except Exception as e:
        logger.error(f"Error retrieving patient notes: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to retrieve patient notes: {str(e)}")


@router.put("/{note_id}", response_model=ClinicalNote)
async def update_note(
    request: UpdateNoteRequest,
    note_id: UUID = Path(..., description="Note UUID"),
    notes_service: ClinicalNotesService = Depends(get_clinical_notes_service),
    author_id: UUID = Depends(get_current_user_id)
):
    """
    Update existing note content. RLS ensures user can only update own notes.
    
    Args:
        request: Note update request with new content
        note_id: UUID of note to update
        notes_service: Injected notes service
        author_id: Current authenticated user ID
        
    Returns:
        ClinicalNote: Updated note with new timestamps
        
    Raises:
        HTTPException: 400 for validation errors, 404 for note not found, 500 for server errors
    """
    try:
        note = notes_service.update_note(
            note_id=note_id,
            content=request.content,
            author_id=author_id
        )
        
        if not note:
            raise HTTPException(
                status_code=404, 
                detail=f"Note not found or unauthorized: {note_id}"
            )
        
        logger.info(f"Note updated: {note_id}")
        return note
        
    except ValueError as e:
        logger.warning(f"Validation error updating note: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error updating note: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to update note: {str(e)}")


@router.delete("/{note_id}")
async def delete_note(
    note_id: UUID = Path(..., description="Note UUID"),
    notes_service: ClinicalNotesService = Depends(get_clinical_notes_service),
    author_id: UUID = Depends(get_current_user_id)
):
    """
    Delete note. RLS ensures user can only delete own notes.
    
    Args:
        note_id: UUID of note to delete
        notes_service: Injected notes service
        author_id: Current authenticated user ID
        
    Returns:
        dict: Success message with deleted note ID
        
    Raises:
        HTTPException: 404 for note not found, 500 for server errors
    """
    try:
        success = notes_service.delete_note(
            note_id=note_id,
            author_id=author_id
        )
        
        if not success:
            raise HTTPException(
                status_code=404, 
                detail=f"Note not found or unauthorized: {note_id}"
            )
        
        logger.info(f"Note deleted: {note_id}")
        return {"message": "Note deleted successfully", "note_id": str(note_id)}
        
    except Exception as e:
        logger.error(f"Error deleting note: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to delete note: {str(e)}")


@router.post("/indicators", response_model=NotesIndicators)
async def get_notes_indicators(
    request: NotesIndicatorsRequest,
    notes_service: ClinicalNotesService = Depends(get_clinical_notes_service),
    author_id: UUID = Depends(get_current_user_id)
):
    """
    Batch retrieve note count indicators for UI performance.
    
    Accepts patient_codes for user convenience, converts to patient_ids for querying.
    
    Args:
        request: Batch indicators request with file paths and patient codes
        notes_service: Injected notes service
        author_id: Current authenticated user ID
        
    Returns:
        NotesIndicators: Count mappings for files and patients
    """
    try:
        indicators = notes_service.get_notes_indicators(
            author_id=author_id,
            file_paths=request.file_paths or [],
            patient_codes=request.patient_codes or []
        )
        
        total_files = len(indicators.file_notes)
        total_patients = len(indicators.patient_notes)
        logger.info(f"Notes indicators loaded: {total_files} files, {total_patients} patients")
        
        return indicators
        
    except Exception as e:
        logger.error(f"Error retrieving notes indicators: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to retrieve notes indicators: {str(e)}")


@router.get("/patient-code/{file_path:path}")
async def extract_patient_code_from_file_path(
    file_path: str = Path(..., description="C3D file path"),
    notes_service: ClinicalNotesService = Depends(get_clinical_notes_service)
):
    """
    Extract patient code from file path for UI integration.
    
    Expected path format: "patients/P001/session_xxx/recording.c3d"
    
    Args:
        file_path: Storage path to C3D file
        notes_service: Injected notes service
        
    Returns:
        dict: Patient code if found in path, None otherwise
    """
    try:
        patient_code = notes_service.extract_patient_code_from_file_path(file_path)
        
        logger.debug(f"Patient code extraction for {file_path}: {patient_code}")
        return {"patient_code": patient_code, "file_path": file_path}
        
    except Exception as e:
        logger.error(f"Error extracting patient code: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to extract patient code: {str(e)}")
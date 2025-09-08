"""
Clinical Notes Service - Domain Service Layer

Handles business logic for clinical note management with hybrid patient identification.
API accepts patient_code for user convenience, stores patient_id UUID for database integrity.

Key Features:
- Hybrid patient identification (patient_code → patient_id conversion)
- File path and patient note support
- Batch loading for UI performance optimization
- Row Level Security (RLS) enforcement
- Integration with existing EMG C3D Analyzer patterns

IMPORTANT: All methods are SYNCHRONOUS (not async) because:
- The Supabase Python client (supabase-py) is synchronous by default
- This follows KISS principle - no unnecessary async complexity
- All database operations use .execute() directly without await
"""

from typing import List, Dict, Optional, Tuple
from uuid import UUID
import logging
from datetime import datetime

from supabase import Client
from models.clinical.clinical_notes import (
    ClinicalNote, 
    ClinicalNoteWithPatientCode,
    CreateNoteRequest, 
    UpdateNoteRequest,
    NotesIndicators,
    ClinicalNotesError
)
from services.shared.repositories.base.abstract_repository import RepositoryError

logger = logging.getLogger(__name__)

class ClinicalNotesService:
    """
    Clinical Notes Service following existing domain architecture.
    
    Hybrid Patient Identification Strategy:
    - API Level: Accept patient_code (P001, P002) for user convenience
    - Service Layer: Convert patient_code → patient_id (UUID) for storage
    - Database Level: Store patient_id UUID for proper relational integrity
    - Response Level: Include patient_code in responses for UI display
    """
    
    def __init__(self, supabase_client: Client):
        self.supabase = supabase_client
        
    def _get_user_email(self, user_id: UUID) -> Optional[str]:
        """
        Get user email from Supabase Auth.
        For now, return a placeholder since we need RLS policy access to auth.users.
        """
        # TODO: Implement proper user email resolution when auth.users access is available
        # This requires either:
        # 1. RLS policy on auth.users table, or  
        # 2. Server-side function with SECURITY DEFINER, or
        # 3. Admin client access
        return None
        
    def _resolve_patient_code_to_id(self, patient_code: str) -> Optional[UUID]:
        """
        Convert patient_code (P001) to patient_id UUID.
        
        Args:
            patient_code: User-friendly patient identifier (e.g., "P001")
            
        Returns:
            UUID: Patient ID if found, None if not found
            
        Raises:
            RepositoryError: Database query failed
        """
        try:
            result = self.supabase.table('patients').select('id').eq(
                'patient_code', patient_code
            ).execute()
            
            if result.data:
                return UUID(result.data[0]['id'])
            return None
            
        except Exception as e:
            logger.error(f"Error resolving patient_code {patient_code}: {str(e)}")
            raise RepositoryError(f"Database error resolving patient: {str(e)}")
    
    def _resolve_patient_id_to_code(self, patient_id: UUID) -> Optional[str]:
        """
        Convert patient_id UUID to patient_code for display.
        
        Args:
            patient_id: Patient UUID
            
        Returns:
            str: Patient code if found, None if not found
        """
        try:
            result = self.supabase.table('patients').select('patient_code').eq(
                'id', str(patient_id)
            ).execute()
            
            if result.data:
                return result.data[0]['patient_code']
            return None
            
        except Exception as e:
            logger.error(f"Error resolving patient_id {patient_id}: {str(e)}")
            return None
    
    def _enrich_notes_with_patient_codes(
        self, 
        notes: List[ClinicalNote]
    ) -> List[ClinicalNoteWithPatientCode]:
        """
        Enrich notes with patient_code for UI display.
        
        Args:
            notes: List of clinical notes
            
        Returns:
            List of notes with resolved patient codes
        """
        enriched_notes = []
        
        # Collect unique patient IDs for batch resolution
        patient_ids = list(set([
            note.patient_id for note in notes 
            if note.patient_id and note.note_type == 'patient'
        ]))
        
        # Batch resolve patient codes if any patient notes exist
        patient_code_map = {}
        if patient_ids:
            try:
                result = self.supabase.table('patients').select(
                    'id, patient_code'
                ).in_('id', [str(pid) for pid in patient_ids]).execute()
                
                patient_code_map = {
                    UUID(row['id']): row['patient_code'] 
                    for row in result.data or []
                }
            except Exception as e:
                logger.warning(f"Failed to batch resolve patient codes: {str(e)}")
        
        # Enrich notes with patient codes
        for note in notes:
            enriched_note = ClinicalNoteWithPatientCode(**note.dict())
            
            if note.patient_id and note.note_type == 'patient':
                enriched_note.patient_code = patient_code_map.get(note.patient_id)
            
            enriched_notes.append(enriched_note)
        
        return enriched_notes
        
    def create_file_note(
        self, 
        file_path: str, 
        content: str, 
        author_id: UUID
    ) -> ClinicalNote:
        """
        Create a clinical note associated with a specific C3D file.
        
        Args:
            file_path: Storage path to C3D file
            content: Markdown-formatted note content
            author_id: UUID of authenticated user
            
        Returns:
            ClinicalNote: Created note with generated ID and timestamps
            
        Raises:
            ValueError: Invalid parameters or content
            RepositoryError: Database operation failed
        """
        logger.info(f"Creating file note for path: {file_path}, author: {author_id}")
        
        # Input validation
        if not content or len(content.strip()) == 0:
            raise ValueError("Note content cannot be empty")
            
        if len(content) > 10000:
            raise ValueError("Note content exceeds maximum length of 10,000 characters")
        
        try:
            # Insert note with RLS automatically enforced
            result = self.supabase.table('clinical_notes').insert({
                'author_id': str(author_id),
                'file_path': file_path,
                'patient_id': None,  # Explicit NULL for file notes
                'content': content.strip(),
                'note_type': 'file'
            }).execute()
            
            if not result.data:
                raise RepositoryError("Failed to create file note - no data returned")
                
            logger.info(f"File note created successfully: {result.data[0]['id']}")
            return ClinicalNote(**result.data[0])
            
        except Exception as e:
            logger.error(f"Database error creating file note: {str(e)}")
            raise RepositoryError(f"Database error creating file note: {str(e)}")
    
    def create_patient_note(
        self,
        patient_code: str,
        content: str,
        author_id: UUID
    ) -> ClinicalNote:
        """
        Create a clinical note associated with a patient across sessions.
        Accepts patient_code for convenience, stores patient_id for integrity.
        
        Args:
            patient_code: User-friendly patient identifier (e.g., "P001")
            content: Markdown-formatted note content
            author_id: UUID of authenticated user
            
        Returns:
            ClinicalNote: Created note with generated ID and timestamps
            
        Raises:
            ValueError: Invalid parameters, content, or patient not found
            RepositoryError: Database operation failed
        """
        logger.info(f"Creating patient note for patient: {patient_code}, author: {author_id}")
        
        # Input validation
        if not content or len(content.strip()) == 0:
            raise ValueError("Note content cannot be empty")
            
        if len(content) > 10000:
            raise ValueError("Note content exceeds maximum length of 10,000 characters")
            
        if not patient_code or not patient_code.strip():
            raise ValueError("Patient code cannot be empty")
        
        # Convert patient_code to patient_id
        patient_id = self._resolve_patient_code_to_id(patient_code)
        if not patient_id:
            raise ValueError(f"Patient not found: {patient_code}")
        
        try:
            # Insert note with patient_id UUID for database integrity
            result = self.supabase.table('clinical_notes').insert({
                'author_id': str(author_id),
                'file_path': None,  # Explicit NULL for patient notes
                'patient_id': str(patient_id),  # Store UUID for relational integrity
                'content': content.strip(),
                'note_type': 'patient'
            }).execute()
            
            if not result.data:
                raise RepositoryError("Failed to create patient note - no data returned")
                
            logger.info(f"Patient note created successfully: {result.data[0]['id']}")
            return ClinicalNote(**result.data[0])
            
        except Exception as e:
            logger.error(f"Database error creating patient note: {str(e)}")
            raise RepositoryError(f"Database error creating patient note: {str(e)}")
    
    def get_notes_indicators(
        self,
        author_id: UUID,
        file_paths: List[str] = None,
        patient_codes: List[str] = None
    ) -> NotesIndicators:
        """
        Batch retrieve note count indicators for UI performance.
        
        Accepts patient_codes for user convenience, converts to patient_ids for querying.
        
        Args:
            author_id: User requesting indicators  
            file_paths: List of file paths to check
            patient_codes: List of patient codes to check (e.g., ["P001", "P002"])
            
        Returns:
            NotesIndicators: Count mappings for files and patients
        """
        logger.info(f"Loading note indicators for author: {author_id}")
        
        try:
            file_counts = {}
            patient_counts = {}
            
            # Handle file note counts
            if file_paths:
                file_result = self.supabase.table('clinical_notes').select(
                    'file_path'
                ).eq('author_id', str(author_id)).eq('note_type', 'file').in_(
                    'file_path', file_paths
                ).execute()
                
                # Count occurrences per file
                for note in file_result.data or []:
                    file_path = note['file_path']
                    if file_path:
                        file_counts[file_path] = file_counts.get(file_path, 0) + 1
            
            # Handle patient note counts (convert patient_codes to patient_ids)
            if patient_codes:
                # Batch resolve patient_codes to patient_ids
                patient_resolve_result = self.supabase.table('patients').select(
                    'id, patient_code'
                ).in_('patient_code', patient_codes).execute()
                
                patient_id_to_code_map = {}
                patient_ids_to_query = []
                
                for row in patient_resolve_result.data or []:
                    patient_id = UUID(row['id'])
                    patient_code = row['patient_code']
                    patient_id_to_code_map[patient_id] = patient_code
                    patient_ids_to_query.append(str(patient_id))
                
                if patient_ids_to_query:
                    # Query notes by patient_ids (UUIDs)
                    patient_result = self.supabase.table('clinical_notes').select(
                        'patient_id'
                    ).eq('author_id', str(author_id)).eq('note_type', 'patient').in_(
                        'patient_id', patient_ids_to_query
                    ).execute()
                    
                    # Count occurrences per patient, mapping back to patient_codes
                    for note in patient_result.data or []:
                        patient_id = UUID(note['patient_id'])
                        patient_code = patient_id_to_code_map.get(patient_id)
                        if patient_code:
                            patient_counts[patient_code] = patient_counts.get(patient_code, 0) + 1
            
            logger.info(f"Note indicators loaded: {len(file_counts)} files, {len(patient_counts)} patients")
            
            return NotesIndicators(
                file_notes=file_counts,
                patient_notes=patient_counts
            )
            
        except Exception as e:
            logger.error(f"Database error retrieving note indicators: {str(e)}")
            raise RepositoryError(f"Database error retrieving note indicators: {str(e)}")
    
    def update_note(
        self,
        note_id: UUID,
        content: str,
        author_id: UUID
    ) -> Optional[ClinicalNote]:
        """Update existing note content. RLS ensures user can only update own notes."""
        logger.info(f"Updating note: {note_id}, author: {author_id}")
        
        # Input validation
        if not content or len(content.strip()) == 0:
            raise ValueError("Note content cannot be empty")
            
        if len(content) > 10000:
            raise ValueError("Note content exceeds maximum length of 10,000 characters")
        
        try:
            result = self.supabase.table('clinical_notes').update({
                'content': content.strip()
            }).eq('id', str(note_id)).eq('author_id', str(author_id)).execute()
            
            if not result.data:
                logger.warning(f"Note not found or unauthorized: {note_id}")
                return None
                
            logger.info(f"Note updated successfully: {note_id}")
            return ClinicalNote(**result.data[0])
            
        except Exception as e:
            logger.error(f"Database error updating note: {str(e)}")
            raise RepositoryError(f"Database error updating note: {str(e)}")
    
    def delete_note(self, note_id: UUID, author_id: UUID) -> bool:
        """Delete note. RLS ensures user can only delete own notes."""
        logger.info(f"Deleting note: {note_id}, author: {author_id}")
        
        try:
            result = self.supabase.table('clinical_notes').delete().eq(
                'id', str(note_id)
            ).eq('author_id', str(author_id)).execute()
            
            success = bool(result.data)
            if success:
                logger.info(f"Note deleted successfully: {note_id}")
            else:
                logger.warning(f"Note not found or unauthorized for deletion: {note_id}")
                
            return success
            
        except Exception as e:
            logger.error(f"Database error deleting note: {str(e)}")
            raise RepositoryError(f"Database error deleting note: {str(e)}")
    
    def get_file_notes(
        self,
        file_path: str,
        author_id: UUID
    ) -> List[ClinicalNoteWithPatientCode]:
        """Retrieve all notes for a specific file by current user."""
        logger.info(f"Getting file notes for: {file_path}, author: {author_id}")
        
        try:
            result = self.supabase.table('clinical_notes').select('*').eq(
                'author_id', str(author_id)
            ).eq('note_type', 'file').eq('file_path', file_path).order(
                'created_at', desc=True
            ).execute()
            
            notes = [ClinicalNote(**note_data) for note_data in (result.data or [])]
            enriched_notes = self._enrich_notes_with_patient_codes(notes)
            
            logger.info(f"Retrieved {len(enriched_notes)} file notes")
            return enriched_notes
            
        except Exception as e:
            logger.error(f"Database error retrieving file notes: {str(e)}")
            raise RepositoryError(f"Database error retrieving file notes: {str(e)}")
    
    def get_patient_notes(
        self,
        patient_code: str,
        author_id: UUID
    ) -> List[ClinicalNoteWithPatientCode]:
        """
        Retrieve all notes for a specific patient by current user.
        Accepts patient_code, converts to patient_id for querying.
        """
        logger.info(f"Getting patient notes for: {patient_code}, author: {author_id}")
        
        # Convert patient_code to patient_id
        patient_id = self._resolve_patient_code_to_id(patient_code)
        if not patient_id:
            logger.warning(f"Patient not found: {patient_code}")
            return []
        
        try:
            result = self.supabase.table('clinical_notes').select('*').eq(
                'author_id', str(author_id)
            ).eq('note_type', 'patient').eq('patient_id', str(patient_id)).order(
                'created_at', desc=True
            ).execute()
            
            notes = [ClinicalNote(**note_data) for note_data in (result.data or [])]
            enriched_notes = self._enrich_notes_with_patient_codes(notes)
            
            logger.info(f"Retrieved {len(enriched_notes)} patient notes")
            return enriched_notes
            
        except Exception as e:
            logger.error(f"Database error retrieving patient notes: {str(e)}")
            raise RepositoryError(f"Database error retrieving patient notes: {str(e)}")
    
    def extract_patient_code_from_file_path(self, file_path: str) -> Optional[str]:
        """
        Extract patient code from file path for UI integration.
        
        Expected path format: "patients/P001/session_xxx/recording.c3d"
        
        Args:
            file_path: Storage path to C3D file
            
        Returns:
            Optional[str]: Patient code if found in path, None otherwise
        """
        try:
            # Split path and look for patient code pattern (P + 3 digits)
            path_parts = file_path.split('/')
            for part in path_parts:
                if part.startswith('P') and len(part) == 4 and part[1:].isdigit():
                    return part
            return None
        except Exception:
            return None
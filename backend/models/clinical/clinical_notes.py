"""
Clinical Notes Data Models

Pydantic models for clinical notes feature with hybrid patient identification.
Follows existing EMG C3D Analyzer patterns and domain-driven design.
"""

from typing import Optional, Dict, Any
from uuid import UUID
from datetime import datetime
from pydantic import BaseModel, Field, field_validator, ConfigDict


class ClinicalNoteBase(BaseModel):
    """Base model for clinical notes with common fields."""
    
    content: str = Field(
        ..., 
        min_length=1, 
        max_length=10000,
        description="Markdown-formatted clinical observations and insights"
    )
    note_type: str = Field(
        ...,
        description="Type of note: 'file' or 'patient'"
    )
    
    @field_validator('note_type')
    @classmethod
    def validate_note_type(cls, v):
        if v not in ['file', 'patient']:
            raise ValueError("note_type must be 'file' or 'patient'")
        return v
    
    @field_validator('content')
    @classmethod
    def validate_content(cls, v):
        if not v or len(v.strip()) == 0:
            raise ValueError("content cannot be empty")
        return v.strip()


class CreateNoteRequest(ClinicalNoteBase):
    """Request model for creating clinical notes."""
    
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "content": "**Session Assessment**\n\n- Good muscle activation in CH1\n- Patient reported minimal fatigue",
                "note_type": "file"
            }
        }
    )


class UpdateNoteRequest(BaseModel):
    """Request model for updating clinical notes."""
    
    content: str = Field(
        ..., 
        min_length=1, 
        max_length=10000,
        description="Updated markdown content"
    )
    
    @field_validator('content')
    @classmethod
    def validate_content(cls, v):
        if not v or len(v.strip()) == 0:
            raise ValueError("content cannot be empty")
        return v.strip()
    
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "content": "**Updated Assessment**\n\n- Improved muscle activation\n- Patient shows progress"
            }
        }
    )


class ClinicalNote(ClinicalNoteBase):
    """Complete clinical note model with all database fields."""
    
    id: UUID = Field(..., description="Unique note identifier")
    author_id: UUID = Field(..., description="Author user ID")
    
    # Targeting fields (exclusive - one OR the other)
    file_path: Optional[str] = Field(None, description="C3D file path for file notes")
    patient_id: Optional[UUID] = Field(None, description="Patient UUID for patient notes")
    
    # Audit fields
    created_at: datetime = Field(..., description="Creation timestamp")
    updated_at: datetime = Field(..., description="Last update timestamp")
    
    model_config = ConfigDict(
        from_attributes=True,
        json_schema_extra={
            "example": {
                "id": "123e4567-e89b-12d3-a456-426614174000",
                "author_id": "456e7890-e12c-34d5-b678-901234567890",
                "file_path": "patients/P001/session_20250905_143022/recording.c3d",
                "patient_id": None,
                "content": "**Initial Assessment**\n\n- Good signal quality\n- Patient cooperative",
                "note_type": "file",
                "created_at": "2025-09-05T14:30:22.123Z",
                "updated_at": "2025-09-05T14:30:22.123Z"
            }
        }
    )


class ClinicalNoteWithPatientCode(ClinicalNote):
    """Clinical note with resolved patient_code and author_email for frontend display."""
    
    patient_code: Optional[str] = Field(None, description="Resolved patient code (P001, P002, etc.)")
    author_email: Optional[str] = Field(None, description="Author email address from auth system")
    
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "id": "123e4567-e89b-12d3-a456-426614174000",
                "author_id": "456e7890-e12c-34d5-b678-901234567890",
                "file_path": None,
                "patient_id": "789e0123-f45g-67h8-i901-234567890123",
                "patient_code": "P001",  # Resolved for display
                "content": "**Patient Progress**\n\n- Shows consistent improvement\n- Compliance excellent",
                "note_type": "patient",
                "created_at": "2025-09-05T14:30:22.123Z",
                "updated_at": "2025-09-05T14:30:22.123Z"
            }
        }
    )


class NotesIndicators(BaseModel):
    """Model for batch note count indicators for UI performance."""
    
    file_notes: Dict[str, int] = Field(
        default_factory=dict,
        description="Map of file_path -> note count"
    )
    patient_notes: Dict[str, int] = Field(
        default_factory=dict,
        description="Map of patient_code -> note count"
    )
    
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "file_notes": {
                    "patients/P001/session_001/recording.c3d": 2,
                    "patients/P001/session_002/recording.c3d": 1
                },
                "patient_notes": {
                    "P001": 5,
                    "P002": 3
                }
            }
        }
    )


class NotesIndicatorsRequest(BaseModel):
    """Request model for batch loading note indicators."""
    
    file_paths: Optional[list[str]] = Field(
        default_factory=list,
        description="List of file paths to check for notes"
    )
    patient_codes: Optional[list[str]] = Field(
        default_factory=list,
        description="List of patient codes to check for notes"
    )
    
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "file_paths": [
                    "patients/P001/session_001/recording.c3d",
                    "patients/P001/session_002/recording.c3d"
                ],
                "patient_codes": ["P001", "P002", "P003"]
            }
        }
    )


# Response models for API consistency
class CreateNoteResponse(ClinicalNote):
    """Response model for note creation."""
    pass


class UpdateNoteResponse(ClinicalNote):
    """Response model for note updates."""
    pass


class NotesListResponse(BaseModel):
    """Response model for listing notes."""
    
    notes: list[ClinicalNoteWithPatientCode] = Field(
        default_factory=list,
        description="List of clinical notes with resolved patient codes"
    )
    total_count: int = Field(0, description="Total number of notes")
    
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "notes": [
                    {
                        "id": "123e4567-e89b-12d3-a456-426614174000",
                        "content": "Patient shows improvement",
                        "note_type": "patient",
                        "patient_code": "P001",
                        "created_at": "2025-09-05T14:30:22.123Z"
                    }
                ],
                "total_count": 1
            }
        }
    )


# Error models for consistent API responses
class ClinicalNotesError(BaseModel):
    """Error model for clinical notes API responses."""
    
    error: str = Field(..., description="Error type")
    message: str = Field(..., description="Human-readable error message")
    details: Optional[Dict[str, Any]] = Field(None, description="Additional error details")
    
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "error": "PATIENT_NOT_FOUND",
                "message": "Patient P999 not found",
                "details": {"patient_code": "P999"}
            }
        }
    )
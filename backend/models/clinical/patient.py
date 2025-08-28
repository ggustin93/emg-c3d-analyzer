"""
Patient Management Models
=========================

Models for patient records including pseudonymized data and PII handling.
Supports GDPR-compliant patient data management with separate PII storage.

Author: EMG C3D Analyzer Team
Date: 2025-08-28
"""

from datetime import datetime, timezone
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field

from ..shared.base import DatabaseBaseModel, TimestampMixin
from ..shared.enums import AgeGroup, Gender


# =============================================================================
# PATIENT MANAGEMENT MODELS
# =============================================================================

class PatientBase(DatabaseBaseModel):
    """Base fields for patient records (pseudonymized)"""
    therapist_id: UUID
    age_group: Optional[AgeGroup] = None
    gender: Optional[Gender] = None
    pathology_category: Optional[str] = None
    active: bool = True


class PatientCreate(PatientBase):
    """Model for creating patient records"""
    pass


class PatientUpdate(BaseModel):
    """Model for updating patient records"""
    age_group: Optional[AgeGroup] = None
    gender: Optional[Gender] = None
    pathology_category: Optional[str] = None
    active: Optional[bool] = None


class Patient(PatientBase, TimestampMixin):
    """Complete patient model (pseudonymized data only)"""
    id: UUID
    patient_code: str = Field(..., description="Auto-generated pseudonymized identifier (P001, P002, etc.)")


class PatientPIIBase(DatabaseBaseModel):
    """Base fields for patient PII (sensitive data)"""
    first_name: str
    last_name: str
    date_of_birth: datetime
    email: Optional[str] = None  # EmailStr when email-validator installed
    phone: Optional[str] = None
    medical_notes: Optional[str] = None
    emergency_contact: Optional[str] = None


class PatientPIICreate(PatientPIIBase):
    """Model for creating patient PII records"""
    patient_id: UUID
    created_by: UUID


class PatientPIIUpdate(BaseModel):
    """Model for updating patient PII"""
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    date_of_birth: Optional[datetime] = None
    email: Optional[str] = None  # EmailStr when email-validator installed
    phone: Optional[str] = None
    medical_notes: Optional[str] = None
    emergency_contact: Optional[str] = None


class PatientPII(PatientPIIBase, TimestampMixin):
    """Complete patient PII model (sensitive data)"""
    patient_id: UUID  # Primary key and foreign key to patients table
    created_by: UUID


class PatientAuthTokenBase(DatabaseBaseModel):
    """Base fields for patient authentication tokens"""
    patient_id: UUID
    token_hash: str
    expires_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc).replace(hour=23, minute=59, second=59, microsecond=0))
    used_at: Optional[datetime] = None
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None


class PatientAuthTokenCreate(PatientAuthTokenBase):
    """Model for creating patient auth tokens"""
    pass


class PatientAuthToken(PatientAuthTokenBase):
    """Complete patient authentication token model"""
    id: UUID
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


# =============================================================================
# COMPOSITE MODELS
# =============================================================================

class PatientWithPII(Patient):
    """Patient model with optional PII data (therapist access only)"""
    pii: Optional[PatientPII] = None


__all__ = [
    'PatientBase', 'PatientCreate', 'PatientUpdate', 'Patient',
    'PatientPIIBase', 'PatientPIICreate', 'PatientPIIUpdate', 'PatientPII',
    'PatientAuthTokenBase', 'PatientAuthTokenCreate', 'PatientAuthToken',
    'PatientWithPII'
]
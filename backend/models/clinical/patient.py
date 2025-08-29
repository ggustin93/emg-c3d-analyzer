"""Patient Management Models.
=========================

Models for patient records including pseudonymized data and PII handling.
Supports GDPR-compliant patient data management with separate PII storage.

Author: EMG C3D Analyzer Team
Date: 2025-08-28
"""

from datetime import datetime, timezone
from uuid import UUID

from pydantic import BaseModel, Field

from models.shared.base import DatabaseBaseModel, TimestampMixin
from models.shared.enums import AgeGroup, Gender

# =============================================================================
# PATIENT MANAGEMENT MODELS
# =============================================================================


class PatientBase(DatabaseBaseModel):
    """Base fields for patient records (pseudonymized)."""

    therapist_id: UUID
    age_group: AgeGroup | None = None
    gender: Gender | None = None
    pathology_category: str | None = None
    active: bool = True


class PatientCreate(PatientBase):
    """Model for creating patient records."""


class PatientUpdate(BaseModel):
    """Model for updating patient records."""

    age_group: AgeGroup | None = None
    gender: Gender | None = None
    pathology_category: str | None = None
    active: bool | None = None


class Patient(PatientBase, TimestampMixin):
    """Complete patient model (pseudonymized data only)."""

    id: UUID
    patient_code: str = Field(
        ..., description="Auto-generated pseudonymized identifier (P001, P002, etc.)"
    )


class PatientPIIBase(DatabaseBaseModel):
    """Base fields for patient PII (sensitive data)."""

    first_name: str
    last_name: str
    date_of_birth: datetime
    email: str | None = None  # EmailStr when email-validator installed
    phone: str | None = None
    medical_notes: str | None = None
    emergency_contact: str | None = None


class PatientPIICreate(PatientPIIBase):
    """Model for creating patient PII records."""

    patient_id: UUID
    created_by: UUID


class PatientPIIUpdate(BaseModel):
    """Model for updating patient PII."""

    first_name: str | None = None
    last_name: str | None = None
    date_of_birth: datetime | None = None
    email: str | None = None  # EmailStr when email-validator installed
    phone: str | None = None
    medical_notes: str | None = None
    emergency_contact: str | None = None


class PatientPII(PatientPIIBase, TimestampMixin):
    """Complete patient PII model (sensitive data)."""

    patient_id: UUID  # Primary key and foreign key to patients table
    created_by: UUID


class PatientAuthTokenBase(DatabaseBaseModel):
    """Base fields for patient authentication tokens."""

    patient_id: UUID
    token_hash: str
    expires_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc).replace(
            hour=23, minute=59, second=59, microsecond=0
        )
    )
    used_at: datetime | None = None
    ip_address: str | None = None
    user_agent: str | None = None


class PatientAuthTokenCreate(PatientAuthTokenBase):
    """Model for creating patient auth tokens."""


class PatientAuthToken(PatientAuthTokenBase):
    """Complete patient authentication token model."""

    id: UUID
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


# =============================================================================
# COMPOSITE MODELS
# =============================================================================


class PatientWithPII(Patient):
    """Patient model with optional PII data (therapist access only)."""

    pii: PatientPII | None = None


__all__ = [
    "Patient",
    "PatientAuthToken",
    "PatientAuthTokenBase",
    "PatientAuthTokenCreate",
    "PatientBase",
    "PatientCreate",
    "PatientPII",
    "PatientPIIBase",
    "PatientPIICreate",
    "PatientPIIUpdate",
    "PatientUpdate",
    "PatientWithPII",
]

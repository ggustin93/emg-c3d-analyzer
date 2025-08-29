"""User Management Models.
======================

Models for user profiles, authentication, and role-based access control.
Supports therapists, researchers, and administrators.

Author: EMG C3D Analyzer Team
Date: 2025-08-28
"""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, field_validator

from models.shared.base import DatabaseBaseModel, TimestampMixin
from models.shared.enums import AccessLevel, UserRole

# =============================================================================
# USER MANAGEMENT MODELS
# =============================================================================


class UserProfileBase(DatabaseBaseModel):
    """Base fields for user profiles."""

    role: UserRole
    first_name: str | None = None
    last_name: str | None = None
    full_name_override: str | None = None

    # Researcher-specific fields
    institution: str | None = None
    department: str | None = None
    access_level: AccessLevel = AccessLevel.BASIC

    # Status
    active: bool = True


class UserProfileCreate(UserProfileBase):
    """Model for creating user profiles."""


class UserProfileUpdate(BaseModel):
    """Model for updating user profiles."""

    role: UserRole | None = None
    first_name: str | None = None
    last_name: str | None = None
    full_name_override: str | None = None
    institution: str | None = None
    department: str | None = None
    access_level: AccessLevel | None = None
    active: bool | None = None


class UserProfile(UserProfileBase, TimestampMixin):
    """Complete user profile model."""

    id: UUID
    full_name: str | None = None  # Generated field from database
    last_login: datetime | None = None

    @field_validator("full_name")
    @classmethod
    def generate_full_name(cls, v, info):
        """Generate full name if not provided."""
        if v:
            return v
        # Access other field values from the model data
        data = info.data if hasattr(info, "data") else {}
        first_name = data.get("first_name")
        last_name = data.get("last_name")
        full_name_override = data.get("full_name_override")

        if first_name and last_name:
            return f"{first_name} {last_name}"
        elif full_name_override:
            return full_name_override
        else:
            return "Unknown User"


__all__ = ["UserProfile", "UserProfileBase", "UserProfileCreate", "UserProfileUpdate"]

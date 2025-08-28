"""
User Management Models
======================

Models for user profiles, authentication, and role-based access control.
Supports therapists, researchers, and administrators.

Author: EMG C3D Analyzer Team
Date: 2025-08-28
"""

from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field, field_validator

from ..shared.base import DatabaseBaseModel, TimestampMixin
from ..shared.enums import UserRole, AccessLevel


# =============================================================================
# USER MANAGEMENT MODELS
# =============================================================================

class UserProfileBase(DatabaseBaseModel):
    """Base fields for user profiles"""
    role: UserRole
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    full_name_override: Optional[str] = None
    
    # Researcher-specific fields
    institution: Optional[str] = None
    department: Optional[str] = None
    access_level: AccessLevel = AccessLevel.BASIC
    
    # Status
    active: bool = True


class UserProfileCreate(UserProfileBase):
    """Model for creating user profiles"""
    pass


class UserProfileUpdate(BaseModel):
    """Model for updating user profiles"""
    role: Optional[UserRole] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    full_name_override: Optional[str] = None
    institution: Optional[str] = None
    department: Optional[str] = None
    access_level: Optional[AccessLevel] = None
    active: Optional[bool] = None


class UserProfile(UserProfileBase, TimestampMixin):
    """Complete user profile model"""
    id: UUID
    full_name: Optional[str] = None  # Generated field from database
    last_login: Optional[datetime] = None
    
    @field_validator('full_name')
    @classmethod
    def generate_full_name(cls, v, info):
        """Generate full name if not provided"""
        if v:
            return v
        # Access other field values from the model data
        data = info.data if hasattr(info, 'data') else {}
        first_name = data.get('first_name')
        last_name = data.get('last_name')
        full_name_override = data.get('full_name_override')
        
        if first_name and last_name:
            return f"{first_name} {last_name}"
        elif full_name_override:
            return full_name_override
        else:
            return "Unknown User"


__all__ = [
    'UserProfileBase', 'UserProfileCreate', 'UserProfileUpdate', 'UserProfile'
]
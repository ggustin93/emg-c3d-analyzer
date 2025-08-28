"""
C3D Technical Data Models
=========================

Models for C3D file technical metadata including sampling rates,
channel information, and file processing details.

Author: EMG C3D Analyzer Team
Date: 2025-08-28
"""

from datetime import datetime, timezone
from typing import List, Optional
from uuid import UUID

from pydantic import Field

from ..shared.base import DatabaseBaseModel


# =============================================================================
# C3D TECHNICAL DATA MODELS
# =============================================================================

class C3DTechnicalDataBase(DatabaseBaseModel):
    """Base fields for C3D technical metadata"""
    # Original file properties
    original_sampling_rate: Optional[float] = Field(None, gt=0)
    original_duration_seconds: Optional[float] = None
    original_sample_count: Optional[int] = None
    
    # Processing properties
    channel_count: Optional[int] = Field(None, gt=0)
    channel_names: List[str] = Field(default_factory=list)
    sampling_rate: Optional[float] = None
    duration_seconds: Optional[float] = None
    frame_count: Optional[int] = None


class C3DTechnicalDataCreate(C3DTechnicalDataBase):
    """Model for creating C3D technical data"""
    session_id: UUID


class C3DTechnicalDataUpdate(C3DTechnicalDataBase):
    """Model for updating C3D technical data"""
    pass


class C3DTechnicalData(C3DTechnicalDataBase):
    """Complete C3D technical data model"""
    session_id: UUID  # Primary key and foreign key
    extracted_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


__all__ = [
    'C3DTechnicalDataBase', 'C3DTechnicalDataCreate', 'C3DTechnicalDataUpdate', 'C3DTechnicalData'
]
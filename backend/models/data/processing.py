"""Processing Parameters Models.
============================

Models for EMG signal processing configuration including filters,
RMS calculations, and MVC parameters.

Author: EMG C3D Analyzer Team
Date: 2025-08-28
"""

from datetime import datetime, timezone
from uuid import UUID

from pydantic import BaseModel, Field

from models.shared.base import DatabaseBaseModel

# =============================================================================
# PROCESSING PARAMETERS MODELS
# =============================================================================


class ProcessingParametersBase(DatabaseBaseModel):
    """Base fields for processing parameters."""

    session_id: UUID

    # Filter configuration
    sampling_rate_hz: float = Field(..., gt=0)
    filter_low_cutoff_hz: float = Field(20.0, gt=0)
    filter_high_cutoff_hz: float = Field(500.0, gt=0)
    filter_order: int = Field(4, gt=0, le=8)

    # RMS configuration
    rms_window_ms: float = Field(50.0, gt=0, le=1000)
    rms_overlap_percent: float = Field(50.0, ge=0, lt=100)

    # MVC configuration
    mvc_window_seconds: float = Field(3.0, gt=0, le=30)
    mvc_threshold_percentage: float = Field(75.0, gt=0, le=100)

    # Version tracking
    processing_version: str = Field("1.0")


class ProcessingParametersCreate(ProcessingParametersBase):
    """Model for creating processing parameters."""


class ProcessingParametersUpdate(BaseModel):
    """Model for updating processing parameters."""

    filter_low_cutoff_hz: float | None = Field(None, gt=0)
    filter_high_cutoff_hz: float | None = Field(None, gt=0)
    filter_order: int | None = Field(None, gt=0, le=8)
    rms_window_ms: float | None = Field(None, gt=0, le=1000)
    rms_overlap_percent: float | None = Field(None, ge=0, lt=100)
    mvc_window_seconds: float | None = Field(None, gt=0, le=30)
    mvc_threshold_percentage: float | None = Field(None, gt=0, le=100)


class ProcessingParameters(ProcessingParametersBase):
    """Complete processing parameters model."""

    id: UUID
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


__all__ = [
    "ProcessingParameters",
    "ProcessingParametersBase",
    "ProcessingParametersCreate",
    "ProcessingParametersUpdate",
]

"""Base Models - EMG C3D Analyzer.
==============================

Base classes and mixins for all database models.
Provides common configuration and behavior patterns.

Author: EMG C3D Analyzer Team
Date: 2025-08-28
"""

from datetime import datetime, timezone
from typing import Any, Dict
from uuid import UUID

from pydantic import BaseModel, Field


class DatabaseBaseModel(BaseModel):
    """Base model for all database entities with common fields."""

    class Config:
        """Pydantic configuration."""

        from_attributes = True
        use_enum_values = True
        validate_by_name = True
        json_encoders = {datetime: lambda v: v.isoformat() if v else None, UUID: str}

    # Note: Pydantic V2 handles datetime parsing automatically


class TimestampMixin(BaseModel):
    """Mixin for entities with created_at and updated_at timestamps."""

    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


__all__ = ["DatabaseBaseModel", "TimestampMixin"]

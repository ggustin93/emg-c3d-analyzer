"""Base Models - EMG C3D Analyzer.
==============================

Base classes and mixins for all database models.
Provides common configuration and behavior patterns.

"""

from datetime import datetime, timezone
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class DatabaseBaseModel(BaseModel):
    """Base model for all database entities with common fields."""

    model_config = ConfigDict(
        from_attributes=True,
        use_enum_values=True,
        validate_by_name=True,
        # Note: Pydantic V2 handles datetime and UUID serialization automatically
        # json_encoders are deprecated - use custom serializers if needed
    )


class TimestampMixin(BaseModel):
    """Mixin for entities with created_at and updated_at timestamps."""

    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


__all__ = ["DatabaseBaseModel", "TimestampMixin"]

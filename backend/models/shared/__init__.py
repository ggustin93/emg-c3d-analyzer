"""
Shared Models - Enums & Base Classes
====================================

Common enums, base models, and mixins used across all domain models.
These provide the foundation for type safety and consistent behavior.
"""

from .enums import *
from .base import *

__all__ = [
    # Enums
    'UserRole', 'AccessLevel', 'Gender', 'AgeGroup', 'ProcessingStatus', 'MeasurementMethod',
    
    # Base models
    'DatabaseBaseModel', 'TimestampMixin',
]
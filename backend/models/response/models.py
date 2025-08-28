"""API Response Models & Validation Helpers.
========================================

Standard response formats for API endpoints and utility validation functions.

Author: EMG C3D Analyzer Team
Date: 2025-08-28
"""

from typing import Any
from uuid import UUID

from pydantic import BaseModel

# =============================================================================
# API RESPONSE MODELS
# =============================================================================


class StandardResponse(BaseModel):
    """Standard API response format."""

    success: bool
    message: str
    data: Any | None = None
    errors: list[str] | None = None


class PaginatedResponse(StandardResponse):
    """Paginated API response format."""

    total: int
    page: int
    per_page: int
    pages: int


# =============================================================================
# VALIDATION HELPERS
# =============================================================================


def validate_uuid4(value: str) -> bool:
    """Validate that a string is a valid UUID4."""
    try:
        UUID(value, version=4)
        return True
    except ValueError:
        return False


def validate_patient_code(value: str) -> bool:
    """Validate patient code format (P001, P002, etc.)."""
    import re

    pattern = r"^P\d{3,}$"
    return bool(re.match(pattern, value))


__all__ = ["PaginatedResponse", "StandardResponse", "validate_patient_code", "validate_uuid4"]

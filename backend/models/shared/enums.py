"""Shared Enums - EMG C3D Analyzer.
===============================

All enumeration types used across the application domains.
Provides type safety and consistent value validation.

"""

from enum import Enum


class UserRole(str, Enum):
    """User roles in the system."""

    THERAPIST = "therapist"
    RESEARCHER = "researcher"
    ADMIN = "admin"


class AccessLevel(str, Enum):
    """Research access levels."""

    BASIC = "basic"
    ADVANCED = "advanced"
    FULL = "full"


class Gender(str, Enum):
    """Gender options for patients."""

    M = "M"
    F = "F"
    NB = "NB"  # Non-binary
    NS = "NS"  # Not specified


class AgeGroup(str, Enum):
    """Age group categories for pseudonymized patient data."""

    YOUNG_ADULT = "18-30"
    ADULT = "31-50"
    MIDDLE_AGED = "51-70"
    SENIOR = "71+"


class ProcessingStatus(str, Enum):
    """Therapy session processing status."""

    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"
    REPROCESSING = "reprocessing"


class MeasurementMethod(str, Enum):
    """BFR measurement methods."""

    AUTOMATIC = "automatic"
    MANUAL = "manual"
    ESTIMATED = "estimated"


__all__ = ["AccessLevel", "AgeGroup", "Gender", "MeasurementMethod", "ProcessingStatus", "UserRole"]

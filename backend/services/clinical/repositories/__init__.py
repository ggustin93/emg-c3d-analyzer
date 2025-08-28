"""Clinical Repository Package
===========================

Domain-driven repository pattern for EMG C3D Analyzer clinical data management.
Each repository handles a single clinical domain with Supabase-optimized patterns.

Repositories:
- AbstractRepository: Base class with common Supabase patterns
- PatientRepository: Patient profiles + PII data (RGPD compliant)
- TherapySessionRepository: Session lifecycle + metadata
- EMGDataRepository: EMG statistics + processing parameters

Note: UserRepository moved to services.user.repositories (proper domain separation)

Author: EMG C3D Analyzer Team
Date: 2025-08-27
"""

from ...shared.repositories.base.abstract_repository import AbstractRepository, RepositoryError
from .emg_data_repository import EMGDataRepository
from .patient_repository import PatientRepository
from .therapy_session_repository import TherapySessionRepository

__all__ = [
    "AbstractRepository",
    "EMGDataRepository",
    "PatientRepository",
    "RepositoryError",
    "TherapySessionRepository"
]

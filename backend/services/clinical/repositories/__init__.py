"""Clinical Repository Package.
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

from services.clinical.repositories.emg_data_repository import EMGDataRepository
from services.clinical.repositories.patient_repository import PatientRepository
from services.clinical.repositories.therapy_session_repository import (
    TherapySessionRepository,
)
from services.shared.repositories.base.abstract_repository import (
    AbstractRepository,
    RepositoryError,
)

__all__ = [
    "AbstractRepository",
    "EMGDataRepository",
    "PatientRepository",
    "RepositoryError",
    "TherapySessionRepository",
]

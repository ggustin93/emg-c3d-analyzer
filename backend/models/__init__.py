"""EMG C3D Analyzer Data Models.
============================

Domain-driven model architecture aligned with services layer.
Provides centralized import aggregation with backward compatibility.

Architecture:
- shared/: Foundational enums and base models
- api/: API request/response models
- user/: User management domain
- clinical/: Clinical workflow domain (patients, sessions, scoring)
- data/: Data processing domain (C3D, processing parameters)
- response/: Standard API response formats

Author: EMG C3D Analyzer Team
Date: 2025-08-28
"""

# =============================================================================
# SHARED COMPONENTS (FOUNDATIONAL)
# =============================================================================
# =============================================================================
# API MODELS (INTERFACE LAYER)
# =============================================================================
from backend.models.api import *
from backend.models.clinical import *
from backend.models.data import *

# =============================================================================
# RESPONSE MODELS (OUTPUT LAYER)
# =============================================================================
from backend.models.response import *
from backend.models.shared import *

# =============================================================================
# DOMAIN MODELS (BUSINESS LOGIC)
# =============================================================================
from backend.models.user import *

# =============================================================================
# BACKWARD COMPATIBILITY EXPORTS
# =============================================================================
# All imports from the original models.py and database_models.py continue to work
__all__ = [
    "AccessLevel",
    "AgeGroup",
    # Monitoring models
    "BFRMonitoring",
    "BFRMonitoringCreate",
    "BFRMonitoringUpdate",
    # =======================================================================
    # DATA DOMAIN
    # =======================================================================
    "C3DTechnicalData",
    "C3DTechnicalDataCreate",
    "C3DTechnicalDataUpdate",
    "ChannelAnalytics",
    "Contraction",
    # Base models
    "DatabaseBaseModel",
    "EMGAnalysisResult",
    "EMGChannelSignalData",
    "EMGRawData",
    "EMGStatistics",
    "EMGStatisticsCreate",
    "EMGStatisticsUpdate",
    "GameMetadata",
    "GameSessionParameters",
    "Gender",
    "MeasurementMethod",
    "PaginatedResponse",
    # =======================================================================
    # CLINICAL DOMAIN
    # =======================================================================
    # Patient models
    "Patient",
    "PatientAuthToken",
    "PatientAuthTokenCreate",
    "PatientCreate",
    "PatientPII",
    "PatientPIICreate",
    "PatientPIIUpdate",
    "PatientUpdate",
    "PatientWithPII",
    "PerformanceScores",
    "PerformanceScoresCreate",
    "PerformanceScoresUpdate",
    "ProcessingOptions",
    "ProcessingParameters",
    "ProcessingParametersCreate",
    "ProcessingParametersUpdate",
    "ProcessingStatus",
    # Scoring models
    "ScoringConfiguration",
    "ScoringConfigurationCreate",
    "ScoringConfigurationUpdate",
    "ScoringConfigurationWithScores",
    "SessionSettings",
    "SessionSettingsCreate",
    "SessionSettingsUpdate",
    # =======================================================================
    # RESPONSE MODELS
    # =======================================================================
    "StandardResponse",
    # =======================================================================
    # API MODELS (from original models.py)
    # =======================================================================
    "TemporalAnalysisStats",
    # Session models
    "TherapySession",
    "TherapySessionCreate",
    "TherapySessionUpdate",
    "TherapySessionWithDetails",
    "TimestampMixin",
    # =======================================================================
    # USER DOMAIN
    # =======================================================================
    "UserProfile",
    "UserProfileCreate",
    "UserProfileUpdate",
    # =======================================================================
    # SHARED COMPONENTS
    # =======================================================================
    # Enums
    "UserRole",
    "validate_patient_code",
    # =======================================================================
    # VALIDATION HELPERS
    # =======================================================================
    "validate_uuid4",
]

# =============================================================================
# DOMAIN-SPECIFIC IMPORT ALIASES (NEW STYLE)
# =============================================================================
# Enable focused imports by domain for new code:
# from models.clinical import Patient, TherapySession, PerformanceScores
# from models.user import UserProfile
# from models.shared import ProcessingStatus, UserRole
# from models.api import EMGAnalysisResult, GameSessionParameters

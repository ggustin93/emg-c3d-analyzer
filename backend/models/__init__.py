"""
EMG C3D Analyzer Data Models
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
from .shared import *

# =============================================================================
# API MODELS (INTERFACE LAYER)
# =============================================================================
from .api import *

# =============================================================================
# DOMAIN MODELS (BUSINESS LOGIC)
# =============================================================================
from .user import *
from .clinical import *
from .data import *

# =============================================================================
# RESPONSE MODELS (OUTPUT LAYER)
# =============================================================================
from .response import *

# =============================================================================
# BACKWARD COMPATIBILITY EXPORTS
# =============================================================================
# All imports from the original models.py and database_models.py continue to work
__all__ = [
    # =======================================================================
    # SHARED COMPONENTS
    # =======================================================================
    # Enums
    'UserRole', 'AccessLevel', 'Gender', 'AgeGroup', 'ProcessingStatus', 'MeasurementMethod',
    
    # Base models
    'DatabaseBaseModel', 'TimestampMixin',
    
    # =======================================================================
    # API MODELS (from original models.py)
    # =======================================================================
    'TemporalAnalysisStats', 'Contraction', 'ChannelAnalytics', 'GameSessionParameters',
    'GameMetadata', 'ProcessingOptions', 'EMGChannelSignalData', 'EMGAnalysisResult', 'EMGRawData',
    
    # =======================================================================
    # USER DOMAIN
    # =======================================================================
    'UserProfile', 'UserProfileCreate', 'UserProfileUpdate',
    
    # =======================================================================
    # CLINICAL DOMAIN
    # =======================================================================
    # Patient models
    'Patient', 'PatientCreate', 'PatientUpdate', 'PatientPII', 'PatientPIICreate', 'PatientPIIUpdate',
    'PatientAuthToken', 'PatientAuthTokenCreate', 'PatientWithPII',
    
    # Session models
    'TherapySession', 'TherapySessionCreate', 'TherapySessionUpdate',
    'EMGStatistics', 'EMGStatisticsCreate', 'EMGStatisticsUpdate',
    'SessionSettings', 'SessionSettingsCreate', 'SessionSettingsUpdate',
    'TherapySessionWithDetails',
    
    # Scoring models
    'ScoringConfiguration', 'ScoringConfigurationCreate', 'ScoringConfigurationUpdate',
    'PerformanceScores', 'PerformanceScoresCreate', 'PerformanceScoresUpdate',
    'ScoringConfigurationWithScores',
    
    # Monitoring models
    'BFRMonitoring', 'BFRMonitoringCreate', 'BFRMonitoringUpdate',
    
    # =======================================================================
    # DATA DOMAIN
    # =======================================================================
    'C3DTechnicalData', 'C3DTechnicalDataCreate', 'C3DTechnicalDataUpdate',
    'ProcessingParameters', 'ProcessingParametersCreate', 'ProcessingParametersUpdate',
    
    # =======================================================================
    # RESPONSE MODELS
    # =======================================================================
    'StandardResponse', 'PaginatedResponse',
    
    # =======================================================================
    # VALIDATION HELPERS
    # =======================================================================
    'validate_uuid4', 'validate_patient_code'
]

# =============================================================================
# DOMAIN-SPECIFIC IMPORT ALIASES (NEW STYLE)
# =============================================================================
# Enable focused imports by domain for new code:
# from models.clinical import Patient, TherapySession, PerformanceScores
# from models.user import UserProfile
# from models.shared import ProcessingStatus, UserRole
# from models.api import EMGAnalysisResult, GameSessionParameters
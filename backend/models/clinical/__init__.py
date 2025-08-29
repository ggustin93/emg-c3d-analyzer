"""Clinical Domain Models.
======================

Models for clinical workflow including patients, therapy sessions, scoring, and monitoring.
Aligned with services/clinical/ domain architecture.
"""

from models.clinical.monitoring import *
from models.clinical.patient import *
from models.clinical.scoring import *
from models.clinical.session import *

__all__ = [
    # Monitoring models
    "BFRMonitoring",
    "BFRMonitoringCreate",
    "BFRMonitoringUpdate",
    "EMGStatistics",
    "EMGStatisticsCreate",
    "EMGStatisticsUpdate",
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
    # Scoring models
    "ScoringConfiguration",
    "ScoringConfigurationCreate",
    "ScoringConfigurationUpdate",
    "ScoringConfigurationWithScores",
    "SessionSettings",
    "SessionSettingsCreate",
    "SessionSettingsUpdate",
    # Session models
    "TherapySession",
    "TherapySessionCreate",
    "TherapySessionUpdate",
    "TherapySessionWithDetails",
]

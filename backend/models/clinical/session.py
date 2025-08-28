"""
Therapy Session Models
======================

Models for therapy sessions, EMG statistics, and session settings.
Manages the core clinical workflow from C3D upload to analysis completion.

Author: EMG C3D Analyzer Team
Date: 2025-08-28
"""

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from uuid import UUID

from pydantic import BaseModel, Field

from ..shared.base import DatabaseBaseModel, TimestampMixin
from ..shared.enums import ProcessingStatus


# =============================================================================
# THERAPY SESSION MODELS
# =============================================================================

class TherapySessionBase(DatabaseBaseModel):
    """Base fields for therapy sessions"""
    file_path: str = Field(..., description="Unique path to C3D file in storage")
    file_hash: str = Field(..., description="SHA256 hash of file for deduplication")
    file_size_bytes: int = Field(..., gt=0, description="File size in bytes")
    
    # Relationships
    patient_id: Optional[UUID] = None
    therapist_id: Optional[UUID] = None
    
    # Session metadata
    session_id: Optional[str] = None  # From C3D metadata
    session_date: Optional[datetime] = None  # Extracted from C3D TIME field
    
    # Processing status
    processing_status: ProcessingStatus = ProcessingStatus.PENDING
    processing_error_message: Optional[str] = None
    processing_time_ms: Optional[float] = Field(None, ge=0)
    
    # Game metadata
    game_metadata: Dict[str, Any] = Field(default_factory=dict)


class TherapySessionCreate(TherapySessionBase):
    """Model for creating therapy sessions"""
    pass


class TherapySessionUpdate(BaseModel):
    """Model for updating therapy sessions"""
    processing_status: Optional[ProcessingStatus] = None
    processing_error_message: Optional[str] = None
    processing_time_ms: Optional[float] = None
    session_date: Optional[datetime] = None
    game_metadata: Optional[Dict[str, Any]] = None
    processed_at: Optional[datetime] = None


class TherapySession(TherapySessionBase, TimestampMixin):
    """Complete therapy session model"""
    id: UUID
    processed_at: Optional[datetime] = None


# =============================================================================
# EMG STATISTICS MODELS
# =============================================================================

class EMGStatisticsBase(DatabaseBaseModel):
    """Base fields for EMG statistics per channel"""
    session_id: UUID
    channel_name: str
    
    # Contraction metrics
    total_contractions: int = Field(0, ge=0)
    good_contractions: int = Field(0, ge=0)
    mvc_contraction_count: int = Field(0, ge=0)
    duration_contraction_count: int = Field(0, ge=0)
    compliance_rate: float = Field(0.0, ge=0.0, le=1.0)
    
    # MVC analysis
    mvc_value: Optional[float] = Field(None, gt=0)
    mvc_threshold: Optional[float] = Field(None, gt=0)
    mvc_threshold_actual_value: Optional[float] = None
    
    # Duration analysis
    duration_threshold_actual_value: Optional[float] = None
    total_time_under_tension_ms: Optional[float] = Field(None, ge=0)
    avg_duration_ms: Optional[float] = Field(None, ge=0)
    max_duration_ms: Optional[float] = Field(None, ge=0)
    min_duration_ms: Optional[float] = Field(None, ge=0)
    
    # Amplitude analysis
    avg_amplitude: Optional[float] = Field(None, ge=0)
    max_amplitude: Optional[float] = Field(None, ge=0)
    
    # Temporal statistics
    rms_mean: Optional[float] = Field(None, ge=0)
    rms_std: Optional[float] = Field(None, ge=0)
    mav_mean: Optional[float] = Field(None, ge=0)
    mav_std: Optional[float] = Field(None, ge=0)
    mpf_mean: Optional[float] = Field(None, ge=0)
    mpf_std: Optional[float] = Field(None, ge=0)
    mdf_mean: Optional[float] = Field(None, ge=0)
    mdf_std: Optional[float] = Field(None, ge=0)
    
    # Fatigue analysis
    fatigue_index_mean: Optional[float] = None
    fatigue_index_std: Optional[float] = Field(None, ge=0)
    fatigue_index_fi_nsm5: Optional[float] = None
    
    # Quality metrics
    signal_quality_score: Optional[float] = Field(None, ge=0.0, le=1.0)


class EMGStatisticsCreate(EMGStatisticsBase):
    """Model for creating EMG statistics"""
    pass


class EMGStatisticsUpdate(BaseModel):
    """Model for updating EMG statistics"""
    total_contractions: Optional[int] = Field(None, ge=0)
    good_contractions: Optional[int] = Field(None, ge=0)
    mvc_contraction_count: Optional[int] = Field(None, ge=0)
    duration_contraction_count: Optional[int] = Field(None, ge=0)
    compliance_rate: Optional[float] = Field(None, ge=0.0, le=1.0)
    signal_quality_score: Optional[float] = Field(None, ge=0.0, le=1.0)
    # Add other fields as needed


class EMGStatistics(EMGStatisticsBase):
    """Complete EMG statistics model"""
    id: UUID
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


# =============================================================================
# SESSION SETTINGS MODELS
# =============================================================================

class SessionSettingsBase(DatabaseBaseModel):
    """Base fields for session settings"""
    session_id: UUID
    
    # MVC configuration
    mvc_threshold_percentage: float = Field(75.0, gt=0, le=100)
    
    # Duration thresholds
    duration_threshold_seconds: float = Field(2.0, gt=0)
    
    # Target parameters
    target_contractions: int = Field(12, gt=0)
    expected_contractions_per_muscle: int = Field(12, gt=0)
    
    # BFR settings
    bfr_enabled: bool = True


class SessionSettingsCreate(SessionSettingsBase):
    """Model for creating session settings"""
    pass


class SessionSettingsUpdate(BaseModel):
    """Model for updating session settings"""
    mvc_threshold_percentage: Optional[float] = Field(None, gt=0, le=100)
    duration_threshold_seconds: Optional[float] = Field(None, gt=0)
    target_contractions: Optional[int] = Field(None, gt=0)
    expected_contractions_per_muscle: Optional[int] = Field(None, gt=0)
    bfr_enabled: Optional[bool] = None


class SessionSettings(SessionSettingsBase):
    """Complete session settings model"""
    id: UUID
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


# =============================================================================
# COMPOSITE MODELS
# =============================================================================

class TherapySessionWithDetails(TherapySession):
    """Therapy session with related data for comprehensive responses"""
    # Import types will be resolved at runtime to avoid circular imports
    patient: Optional[Any] = None  # Patient
    therapist: Optional[Any] = None  # UserProfile
    c3d_technical_data: Optional[Any] = None  # C3DTechnicalData
    emg_statistics: List[EMGStatistics] = Field(default_factory=list)
    performance_scores: Optional[Any] = None  # PerformanceScores
    session_settings: Optional[SessionSettings] = None
    processing_parameters: Optional[Any] = None  # ProcessingParameters
    bfr_monitoring: List[Any] = Field(default_factory=list)  # BFRMonitoring


__all__ = [
    'TherapySessionBase', 'TherapySessionCreate', 'TherapySessionUpdate', 'TherapySession',
    'EMGStatisticsBase', 'EMGStatisticsCreate', 'EMGStatisticsUpdate', 'EMGStatistics',
    'SessionSettingsBase', 'SessionSettingsCreate', 'SessionSettingsUpdate', 'SessionSettings',
    'TherapySessionWithDetails'
]
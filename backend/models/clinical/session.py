"""Therapy Session Models.
======================

Models for therapy sessions, EMG statistics, and session settings.
Manages the core clinical workflow from C3D upload to analysis completion.

Author: EMG C3D Analyzer Team
Date: 2025-08-28
"""

from datetime import datetime, timezone
from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field, field_validator

from models.shared.base import DatabaseBaseModel, TimestampMixin
from models.shared.enums import ProcessingStatus

# =============================================================================
# THERAPY SESSION MODELS
# =============================================================================


class TherapySessionBase(DatabaseBaseModel):
    """Base fields for therapy sessions."""

    file_path: str = Field(..., description="Unique path to C3D file in storage")
    file_hash: str = Field(..., description="SHA256 hash of file for deduplication")
    file_size_bytes: int = Field(..., gt=0, description="File size in bytes")

    # Relationships
    patient_id: UUID | None = None
    therapist_id: UUID | None = None

    # Session metadata
    session_id: str | None = None  # From C3D metadata
    session_date: datetime | None = None  # Extracted from C3D TIME field

    # Processing status
    processing_status: ProcessingStatus = ProcessingStatus.PENDING
    processing_error_message: str | None = None
    processing_time_ms: float | None = Field(None, ge=0)

    # Game metadata
    game_metadata: dict[str, Any] = Field(default_factory=dict)


class TherapySessionCreate(TherapySessionBase):
    """Model for creating therapy sessions."""


class TherapySessionUpdate(BaseModel):
    """Model for updating therapy sessions."""

    processing_status: ProcessingStatus | None = None
    processing_error_message: str | None = None
    processing_time_ms: float | None = None
    session_date: datetime | None = None
    game_metadata: dict[str, Any] | None = None
    processed_at: datetime | None = None


class TherapySession(TherapySessionBase, TimestampMixin):
    """Complete therapy session model."""

    id: UUID
    processed_at: datetime | None = None


# =============================================================================
# EMG STATISTICS MODELS
# =============================================================================


class EMGStatisticsBase(DatabaseBaseModel):
    """Base fields for EMG statistics per channel."""

    session_id: UUID
    channel_name: str

    # Core MVC fields (preserved for backwards compatibility)
    mvc_value: float | None = Field(None, gt=0)
    mvc75_threshold: float | None = None
    signal_quality_score: float | None = Field(None, ge=0.0, le=1.0)

    # New JSONB clinical groups (primary structure)
    contraction_quality_metrics: dict[str, Any] = Field(
        default_factory=dict,
        description="Clinical contraction quality metrics: total counts, compliance rates, MVC75 and duration compliance"
    )
    contraction_timing_metrics: dict[str, Any] = Field(
        default_factory=dict,
        description="Clinical timing metrics: durations (avg, min, max), time under tension, duration thresholds"
    )
    muscle_activation_metrics: dict[str, Any] = Field(
        default_factory=dict,
        description="Clinical muscle activation metrics: RMS, MAV, amplitude measurements with variability measures"
    )
    fatigue_assessment_metrics: dict[str, Any] = Field(
        default_factory=dict,
        description="Clinical fatigue assessment metrics: MPF, MDF frequency analysis, fatigue indices, slopes"
    )

    # Existing JSONB fields (preserved)
    contractions_detail: list[dict] | None = Field(None, description="Detailed contraction data array")
    signal_quality_metrics: dict | None = Field(None, description="Signal quality metrics object")
    processing_config: dict | None = Field(None, description="Processing parameters used for analysis")
    temporal_metrics: dict | None = Field(None, description="Temporal analysis results including slopes and trends")

    # Deprecated fields - maintained temporarily for backwards compatibility
    # Will be removed in future migration after validation period
    total_contractions: int = Field(0, ge=0, description="DEPRECATED: Use contraction_quality_metrics.total_contractions")
    good_contractions: int = Field(0, ge=0, description="DEPRECATED: Use contraction_quality_metrics.overall_compliant_contractions")
    compliance_rate: float = Field(0.0, ge=0.0, le=1.0, description="DEPRECATED: Use computed rate from contraction_quality_metrics")

    # Deprecated MVC fields
    mvc_threshold: float | None = Field(None, gt=0, description="DEPRECATED: Duplicate of mvc75_threshold")
    
    # Deprecated duration fields
    duration_threshold_actual_value: float | None = Field(None, description="DEPRECATED: Stored in processing_config JSONB")
    total_time_under_tension_ms: float | None = Field(None, ge=0, description="DEPRECATED: Use contraction_timing_metrics.total_time_under_tension_ms")
    avg_duration_ms: float | None = Field(None, ge=0, description="DEPRECATED: Use contraction_timing_metrics.avg_duration_ms")
    max_duration_ms: float | None = Field(None, ge=0, description="DEPRECATED: Use contraction_timing_metrics.max_duration_ms")
    min_duration_ms: float | None = Field(None, ge=0, description="DEPRECATED: Use contraction_timing_metrics.min_duration_ms")

    # Deprecated amplitude fields
    avg_amplitude: float | None = Field(None, ge=0, description="DEPRECATED: Use muscle_activation_metrics.avg_amplitude")
    max_amplitude: float | None = Field(None, ge=0, description="DEPRECATED: Use muscle_activation_metrics.max_amplitude")
    std_amplitude: float | None = Field(None, ge=0, description="DEPRECATED: Use muscle_activation_metrics.std_amplitude")

    # Deprecated temporal statistics
    rms_mean: float | None = Field(None, ge=0, description="DEPRECATED: Use muscle_activation_metrics.rms_mean")
    rms_std: float | None = Field(None, ge=0, description="DEPRECATED: Use muscle_activation_metrics.rms_std")
    mav_mean: float | None = Field(None, ge=0, description="DEPRECATED: Use muscle_activation_metrics.mav_mean")
    mav_std: float | None = Field(None, ge=0, description="DEPRECATED: Use muscle_activation_metrics.mav_std")
    mpf_mean: float | None = Field(None, ge=0, description="DEPRECATED: Use fatigue_assessment_metrics.mpf_mean")
    mpf_std: float | None = Field(None, ge=0, description="DEPRECATED: Use fatigue_assessment_metrics.mpf_std")
    mdf_mean: float | None = Field(None, ge=0, description="DEPRECATED: Use fatigue_assessment_metrics.mdf_mean")
    mdf_std: float | None = Field(None, ge=0, description="DEPRECATED: Use fatigue_assessment_metrics.mdf_std")

    # Deprecated fatigue analysis
    fatigue_index_mean: float | None = Field(None, description="DEPRECATED: Use fatigue_assessment_metrics.fatigue_index_mean")
    fatigue_index_std: float | None = Field(None, ge=0, description="DEPRECATED: Use fatigue_assessment_metrics.fatigue_index_std")
    fatigue_index_fi_nsm5: float | None = Field(None, description="DEPRECATED: Use fatigue_assessment_metrics.fatigue_index_fi_nsm5")

    # New clarity field for backwards compatibility
    overall_compliant_contractions: int = Field(0, ge=0, description="Number of contractions meeting BOTH MVC75 AND duration criteria (renamed from good_contractions)")

    # JSONB field validators for clinical data integrity
    @field_validator('contraction_quality_metrics')
    @classmethod
    def validate_contraction_quality_metrics(cls, v: dict[str, Any]) -> dict[str, Any]:
        """Validate contraction quality metrics JSONB structure and clinical bounds."""
        if not v:
            return {}
        
        # Expected fields with validation
        expected_fields = {
            'total_contractions': (int, 0, 1000),  # (type, min, max)
            'overall_compliant_contractions': (int, 0, 1000),
            'mvc75_compliant_contractions': (int, 0, 1000),
            'duration_compliant_contractions': (int, 0, 1000),
            'mvc75_compliance_percentage': (float, 0.0, 100.0),
            'duration_compliance_percentage': (float, 0.0, 100.0),
            'overall_compliance_percentage': (float, 0.0, 100.0)
        }
        
        validated = {}
        for field, (expected_type, min_val, max_val) in expected_fields.items():
            if field in v:
                value = v[field]
                if isinstance(value, expected_type):
                    if min_val <= value <= max_val:
                        validated[field] = value
                    else:
                        raise ValueError(f"contraction_quality_metrics.{field} must be between {min_val} and {max_val}, got {value}")
                else:
                    raise ValueError(f"contraction_quality_metrics.{field} must be {expected_type.__name__}, got {type(value).__name__}")
        
        return validated

    @field_validator('contraction_timing_metrics')
    @classmethod
    def validate_contraction_timing_metrics(cls, v: dict[str, Any]) -> dict[str, Any]:
        """Validate contraction timing metrics JSONB structure and clinical bounds."""
        if not v:
            return {}
        
        # Expected fields with validation
        expected_fields = {
            'avg_duration_ms': (float, 0.0, 30000.0),  # Up to 30 seconds per contraction
            'max_duration_ms': (float, 0.0, 60000.0),  # Up to 60 seconds max
            'min_duration_ms': (float, 0.0, 30000.0),
            'total_time_under_tension_ms': (float, 0.0, 1800000.0),  # Up to 30 minutes total
            'std_duration_ms': (float, 0.0, 10000.0),
            'duration_threshold_ms': (float, 100.0, 10000.0)  # Clinical threshold range
        }
        
        validated = {}
        for field, (expected_type, min_val, max_val) in expected_fields.items():
            if field in v:
                value = v[field]
                if isinstance(value, expected_type):
                    if min_val <= value <= max_val:
                        validated[field] = value
                    else:
                        raise ValueError(f"contraction_timing_metrics.{field} must be between {min_val} and {max_val}, got {value}")
                else:
                    raise ValueError(f"contraction_timing_metrics.{field} must be {expected_type.__name__}, got {type(value).__name__}")
        
        return validated

    @field_validator('muscle_activation_metrics')
    @classmethod
    def validate_muscle_activation_metrics(cls, v: dict[str, Any]) -> dict[str, Any]:
        """Validate muscle activation metrics JSONB structure and clinical bounds."""
        if not v:
            return {}
        
        # Expected fields with validation
        expected_fields = {
            'rms_mean': (float, 0.0, 10000.0),  # Clinical EMG range in microvolts
            'rms_std': (float, 0.0, 5000.0),
            'mav_mean': (float, 0.0, 10000.0),
            'mav_std': (float, 0.0, 5000.0),
            'avg_amplitude': (float, 0.0, 10000.0),
            'max_amplitude': (float, 0.0, 20000.0),
            'std_amplitude': (float, 0.0, 5000.0),
            'rms_coefficient_of_variation': (float, 0.0, 500.0),  # CV% up to 500%
            'mav_coefficient_of_variation': (float, 0.0, 500.0)
        }
        
        validated = {}
        for field, (expected_type, min_val, max_val) in expected_fields.items():
            if field in v:
                value = v[field]
                if isinstance(value, expected_type):
                    if min_val <= value <= max_val:
                        validated[field] = value
                    else:
                        raise ValueError(f"muscle_activation_metrics.{field} must be between {min_val} and {max_val}, got {value}")
                else:
                    raise ValueError(f"muscle_activation_metrics.{field} must be {expected_type.__name__}, got {type(value).__name__}")
        
        return validated

    @field_validator('fatigue_assessment_metrics')
    @classmethod
    def validate_fatigue_assessment_metrics(cls, v: dict[str, Any]) -> dict[str, Any]:
        """Validate fatigue assessment metrics JSONB structure and clinical bounds."""
        if not v:
            return {}
        
        # Expected fields with validation
        expected_fields = {
            'mpf_mean': (float, 0.0, 500.0),  # Mean Power Frequency in Hz
            'mpf_std': (float, 0.0, 100.0),
            'mdf_mean': (float, 0.0, 500.0),  # Median Frequency in Hz
            'mdf_std': (float, 0.0, 100.0),
            'fatigue_index_mean': (float, -5.0, 5.0),  # Fatigue index range
            'fatigue_index_std': (float, 0.0, 10.0),
            'fatigue_index_fi_nsm5': (float, -5.0, 5.0),
            'mpf_coefficient_of_variation': (float, 0.0, 200.0),  # CV% 
            'mdf_coefficient_of_variation': (float, 0.0, 200.0),
            'fatigue_slope_mpf': (float, -10.0, 10.0),  # Fatigue slope range
            'fatigue_slope_mdf': (float, -10.0, 10.0)
        }
        
        validated = {}
        for field, (expected_type, min_val, max_val) in expected_fields.items():
            if field in v:
                value = v[field]
                if isinstance(value, expected_type):
                    if min_val <= value <= max_val:
                        validated[field] = value
                    else:
                        raise ValueError(f"fatigue_assessment_metrics.{field} must be between {min_val} and {max_val}, got {value}")
                else:
                    raise ValueError(f"fatigue_assessment_metrics.{field} must be {expected_type.__name__}, got {type(value).__name__}")
        
        return validated


class EMGStatisticsCreate(EMGStatisticsBase):
    """Model for creating EMG statistics."""


class EMGStatisticsUpdate(BaseModel):
    """Model for updating EMG statistics."""

    # New JSONB clinical groups (primary update fields)
    contraction_quality_metrics: dict[str, Any] | None = Field(
        None,
        description="Clinical contraction quality metrics: total counts, compliance rates, MVC75 and duration compliance"
    )
    contraction_timing_metrics: dict[str, Any] | None = Field(
        None,
        description="Clinical timing metrics: durations (avg, min, max), time under tension, duration thresholds"
    )
    muscle_activation_metrics: dict[str, Any] | None = Field(
        None,
        description="Clinical muscle activation metrics: RMS, MAV, amplitude measurements with variability measures"
    )
    fatigue_assessment_metrics: dict[str, Any] | None = Field(
        None,
        description="Clinical fatigue assessment metrics: MPF, MDF frequency analysis, fatigue indices, slopes"
    )

    # Core fields that may be updated
    mvc_value: float | None = Field(None, gt=0)
    mvc75_threshold: float | None = None
    signal_quality_score: float | None = Field(None, ge=0.0, le=1.0)
    overall_compliant_contractions: int | None = Field(None, ge=0)

    # Existing JSONB fields
    contractions_detail: list[dict] | None = None
    signal_quality_metrics: dict | None = None
    processing_config: dict | None = None
    temporal_metrics: dict | None = None

    # Deprecated fields - maintained temporarily for backwards compatibility
    total_contractions: int | None = Field(None, ge=0, description="DEPRECATED: Use contraction_quality_metrics.total_contractions")
    good_contractions: int | None = Field(None, ge=0, description="DEPRECATED: Use contraction_quality_metrics.overall_compliant_contractions")
    compliance_rate: float | None = Field(None, ge=0.0, le=1.0, description="DEPRECATED: Use computed rate from contraction_quality_metrics")

    # Apply the same validators as the base model
    @field_validator('contraction_quality_metrics')
    @classmethod
    def validate_contraction_quality_metrics(cls, v: dict[str, Any] | None) -> dict[str, Any] | None:
        """Validate contraction quality metrics JSONB structure and clinical bounds."""
        if v is None:
            return None
        return EMGStatisticsBase.validate_contraction_quality_metrics(v)

    @field_validator('contraction_timing_metrics')
    @classmethod
    def validate_contraction_timing_metrics(cls, v: dict[str, Any] | None) -> dict[str, Any] | None:
        """Validate contraction timing metrics JSONB structure and clinical bounds."""
        if v is None:
            return None
        return EMGStatisticsBase.validate_contraction_timing_metrics(v)

    @field_validator('muscle_activation_metrics')
    @classmethod
    def validate_muscle_activation_metrics(cls, v: dict[str, Any] | None) -> dict[str, Any] | None:
        """Validate muscle activation metrics JSONB structure and clinical bounds."""
        if v is None:
            return None
        return EMGStatisticsBase.validate_muscle_activation_metrics(v)

    @field_validator('fatigue_assessment_metrics')
    @classmethod
    def validate_fatigue_assessment_metrics(cls, v: dict[str, Any] | None) -> dict[str, Any] | None:
        """Validate fatigue assessment metrics JSONB structure and clinical bounds."""
        if v is None:
            return None
        return EMGStatisticsBase.validate_fatigue_assessment_metrics(v)


class EMGStatistics(EMGStatisticsBase):
    """Complete EMG statistics model."""

    id: UUID
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


# =============================================================================
# SESSION SETTINGS MODELS
# =============================================================================


class SessionSettingsBase(DatabaseBaseModel):
    """Base fields for session settings."""

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
    """Model for creating session settings."""


class SessionSettingsUpdate(BaseModel):
    """Model for updating session settings."""

    mvc_threshold_percentage: float | None = Field(None, gt=0, le=100)
    duration_threshold_seconds: float | None = Field(None, gt=0)
    target_contractions: int | None = Field(None, gt=0)
    expected_contractions_per_muscle: int | None = Field(None, gt=0)
    bfr_enabled: bool | None = None


class SessionSettings(SessionSettingsBase):
    """Complete session settings model."""

    id: UUID
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


# =============================================================================
# COMPOSITE MODELS
# =============================================================================


class TherapySessionWithDetails(TherapySession):
    """Therapy session with related data for comprehensive responses."""

    # Import types will be resolved at runtime to avoid circular imports
    patient: Any | None = None  # Patient
    therapist: Any | None = None  # UserProfile
    # c3d_technical_data moved to game_metadata.technical_data
    emg_statistics: list[EMGStatistics] = Field(default_factory=list)
    performance_scores: Any | None = None  # PerformanceScores
    session_settings: SessionSettings | None = None
    processing_parameters: Any | None = None  # ProcessingParameters
    bfr_monitoring: list[Any] = Field(default_factory=list)  # BFRMonitoring


__all__ = [
    "EMGStatistics",
    "EMGStatisticsBase",
    "EMGStatisticsCreate",
    "EMGStatisticsUpdate",
    "SessionSettings",
    "SessionSettingsBase",
    "SessionSettingsCreate",
    "SessionSettingsUpdate",
    "TherapySession",
    "TherapySessionBase",
    "TherapySessionCreate",
    "TherapySessionUpdate",
    "TherapySessionWithDetails",
]

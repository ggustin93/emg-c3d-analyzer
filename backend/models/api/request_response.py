# backend/models.py
"""GHOSTLY+ Pydantic Models.
===================================

Data models for the FastAPI implementation to validate
and serialize/deserialize data.
"""

from typing import Any

# Import default parameters from config
from config import (
    DEFAULT_MIN_DURATION_MS,
    DEFAULT_MVC_THRESHOLD_PERCENTAGE,
    DEFAULT_SMOOTHING_WINDOW,
    DEFAULT_THRESHOLD_FACTOR,
)
from pydantic import BaseModel, Field


class TemporalAnalysisStats(BaseModel):
    """Statistics for temporal analysis of EMG metrics."""

    mean_value: float | None = None
    std_value: float | None = None
    min_value: float | None = None
    max_value: float | None = None
    valid_windows: int | None = None
    coefficient_of_variation: float | None = None


class Contraction(BaseModel):
    start_time_ms: float
    end_time_ms: float
    duration_ms: float
    mean_amplitude: float
    max_amplitude: float
    is_good: bool | None = None  # Meets both MVC and duration criteria
    meets_mvc: bool | None = None  # Meets MVC threshold only
    meets_duration: bool | None = None  # Meets duration threshold only


class ChannelAnalytics(BaseModel):
    """Analytics for a single EMG channel."""

    contraction_count: int = 0
    avg_duration_ms: float = 0.0
    min_duration_ms: float = 0.0
    max_duration_ms: float = 0.0
    total_time_under_tension_ms: float = 0.0
    avg_amplitude: float = 0.0
    max_amplitude: float = 0.0
    rms: float = 0.0
    mav: float = 0.0
    mpf: float | None = None
    mdf: float | None = None
    fatigue_index_fi_nsm5: float | None = None
    contractions: list[Contraction] | None = None
    errors: dict[str, str] | None = None

    # New fields for game stats and enhanced quality assessment
    mvc_threshold_actual_value: float | None = None
    duration_threshold_actual_value: float | None = None
    good_contraction_count: int | None = None  # Meets both MVC and duration criteria
    mvc_contraction_count: int | None = None  # Meets MVC criteria only
    duration_contraction_count: int | None = None  # Meets duration criteria only

    # Temporal analysis fields
    rms_temporal_stats: TemporalAnalysisStats | None = None
    mav_temporal_stats: TemporalAnalysisStats | None = None
    mpf_temporal_stats: TemporalAnalysisStats | None = None
    mdf_temporal_stats: TemporalAnalysisStats | None = None
    fatigue_index_temporal_stats: TemporalAnalysisStats | None = None


class GameSessionParameters(BaseModel):
    session_mvc_value: float | None = Field(
        None, description="Patient's MVC for this session/muscle, input by therapist"
    )
    session_mvc_threshold_percentage: float | None = Field(
        DEFAULT_MVC_THRESHOLD_PERCENTAGE,
        ge=0,
        le=100,
        description="Percentage of session_mvc_value to consider a contraction 'good'",
    )
    session_expected_contractions: int | None = Field(
        None, ge=0, description="Target number of contractions for the session"
    )
    session_expected_contractions_ch1: int | None = Field(
        None, ge=0, description="Target number of contractions for channel 1"
    )
    session_expected_contractions_ch2: int | None = Field(
        None, ge=0, description="Target number of contractions for channel 2"
    )

    # Deprecated detailed expected contractions by type (removed)

    # Contraction classification threshold (clinically standard 2.0s default)
    contraction_duration_threshold: int | None = Field(
        2000,
        ge=0,
        description="Global threshold in milliseconds to classify contractions as short or long",
    )

    # Per-muscle duration thresholds (frontend sends in seconds, will be converted to ms)
    session_duration_thresholds_per_muscle: dict[str, float | None] | None = Field(
        None, description="Per-muscle duration thresholds in seconds (converted to ms for analysis)"
    )

    # Channel to muscle name mapping
    channel_muscle_mapping: dict[str, str] | None = Field(
        None, description="Mapping of channel names to muscle names"
    )

    # New fields for channel-specific MVC values and thresholds
    session_mvc_values: dict[str, float | None] | None = Field(
        None, description="Channel-specific MVC values"
    )
    session_mvc_threshold_percentages: dict[str, float | None] | None = Field(
        None, description="Channel-specific MVC threshold percentages"
    )


class GameMetadata(BaseModel):
    game_name: str | None = None
    level: str | None = None
    duration: float | None = None  # Game duration from C3D
    therapist_id: str | None = None
    group_id: str | None = None
    time: str | None = None
    player_name: str | None = None
    score: float | None = None

    # Store the input game parameters used for this analysis
    session_parameters_used: GameSessionParameters | None = None


class ProcessingOptions(BaseModel):
    threshold_factor: float = Field(
        DEFAULT_THRESHOLD_FACTOR,
        description="Factor of max amplitude to use as threshold for initial detection",
    )
    min_duration_ms: int = Field(
        DEFAULT_MIN_DURATION_MS, description="Minimum duration of a contraction in milliseconds"
    )
    smoothing_window: int = Field(
        DEFAULT_SMOOTHING_WINDOW, description="Window size for smoothing the signal"
    )
    # MVC related params are now part of GameSessionParameters, passed to processor


class EMGChannelSignalData(BaseModel):
    sampling_rate: float
    time_axis: list[float]
    data: list[float]  # This will hold the primary C3D signal (e.g., "CH1 Raw")
    rms_envelope: list[float] | None = None  # For the calculated RMS envelope
    activated_data: list[float] | None = (
        None  # If you have a separate "activated" signal processing step
    )
    processed_data: list[float] | None = None  # Our rigorous processing pipeline output


class EMGAnalysisResult(BaseModel):
    """Model for the complete EMG analysis result."""

    file_id: str
    timestamp: str
    source_filename: str
    metadata: GameMetadata  # Will include GameSessionParameters
    analytics: dict[str, ChannelAnalytics]
    available_channels: list[str]
    emg_signals: dict[str, EMGChannelSignalData]
    c3d_parameters: dict[str, Any] | None = None  # Full C3D file parameters
    user_id: str | None = None
    session_id: str | None = None
    patient_id: str | None = None


class EMGRawData(BaseModel):
    """Model for returning raw EMG data for a specific channel."""

    channel_name: str
    sampling_rate: float
    data: list[float]
    time_axis: list[float]
    activated_data: list[float] | None = None
    processed_data: list[float] | None = None  # Our rigorous processing pipeline output
    contractions: list[Contraction] | None = None  # Will include is_good flag

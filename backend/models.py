# backend/models.py
"""
GHOSTLY+ Pydantic Models
===================================

Data models for the FastAPI implementation to validate
and serialize/deserialize data.
"""

from pydantic import BaseModel, Field
from typing import Dict, List, Optional, Union, Any
from datetime import datetime

# Import default parameters from config
from .config import (
    DEFAULT_THRESHOLD_FACTOR,
    DEFAULT_MIN_DURATION_MS,
    DEFAULT_SMOOTHING_WINDOW,
    DEFAULT_MVC_THRESHOLD_PERCENTAGE
)

class TemporalAnalysisStats(BaseModel):
    """Statistics for temporal analysis of EMG metrics."""
    mean_value: Optional[float] = None
    std_value: Optional[float] = None
    min_value: Optional[float] = None
    max_value: Optional[float] = None
    valid_windows: Optional[int] = None
    coefficient_of_variation: Optional[float] = None

class Contraction(BaseModel):
    start_time_ms: float
    end_time_ms: float
    duration_ms: float
    mean_amplitude: float
    max_amplitude: float
    is_good: Optional[bool] = None # New field

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
    mpf: Optional[float] = None
    mdf: Optional[float] = None
    fatigue_index_fi_nsm5: Optional[float] = None
    contractions: Optional[List[Contraction]] = None
    errors: Optional[Dict[str, str]] = None
    
    # New fields for game stats
    mvc_threshold_actual_value: Optional[float] = None
    good_contraction_count: Optional[int] = None
    
    # Temporal analysis fields
    rms_temporal_stats: Optional[TemporalAnalysisStats] = None
    mav_temporal_stats: Optional[TemporalAnalysisStats] = None
    fatigue_index_temporal_stats: Optional[TemporalAnalysisStats] = None


class GameSessionParameters(BaseModel):
    session_mvc_value: Optional[float] = Field(None, description="Patient's MVC for this session/muscle, input by therapist")
    session_mvc_threshold_percentage: Optional[float] = Field(DEFAULT_MVC_THRESHOLD_PERCENTAGE, ge=0, le=100, description="Percentage of session_mvc_value to consider a contraction 'good'")
    session_expected_contractions: Optional[int] = Field(None, ge=0, description="Target number of contractions for the session")
    session_expected_contractions_ch1: Optional[int] = Field(None, ge=0, description="Target number of contractions for channel 1")
    session_expected_contractions_ch2: Optional[int] = Field(None, ge=0, description="Target number of contractions for channel 2")
    
    # Detailed expected contractions by type
    session_expected_long_left: Optional[int] = Field(None, ge=0, description="Target number of long contractions for left muscle")
    session_expected_short_left: Optional[int] = Field(None, ge=0, description="Target number of short contractions for left muscle")
    session_expected_long_right: Optional[int] = Field(None, ge=0, description="Target number of long contractions for right muscle")
    session_expected_short_right: Optional[int] = Field(None, ge=0, description="Target number of short contractions for right muscle")
    
    # Contraction classification threshold
    contraction_duration_threshold: Optional[int] = Field(250, ge=0, description="Threshold in milliseconds to classify contractions as short or long")
    
    # Channel to muscle name mapping
    channel_muscle_mapping: Optional[Dict[str, str]] = Field(None, description="Mapping of channel names to muscle names")
    
    # New fields for channel-specific MVC values and thresholds
    session_mvc_values: Optional[Dict[str, Optional[float]]] = Field(None, description="Channel-specific MVC values")
    session_mvc_threshold_percentages: Optional[Dict[str, Optional[float]]] = Field(None, description="Channel-specific MVC threshold percentages")

class GameMetadata(BaseModel):
    game_name: Optional[str] = None
    level: Optional[str] = None
    duration: Optional[float] = None # Game duration from C3D
    therapist_id: Optional[str] = None
    group_id: Optional[str] = None
    time: Optional[str] = None
    player_name: Optional[str] = None
    score: Optional[float] = None
    
    # Store the input game parameters used for this analysis
    session_parameters_used: Optional[GameSessionParameters] = None


class ProcessingOptions(BaseModel):
    threshold_factor: float = Field(DEFAULT_THRESHOLD_FACTOR, description="Factor of max amplitude to use as threshold for initial detection")
    min_duration_ms: int = Field(DEFAULT_MIN_DURATION_MS, description="Minimum duration of a contraction in milliseconds")
    smoothing_window: int = Field(DEFAULT_SMOOTHING_WINDOW, description="Window size for smoothing the signal")
    # MVC related params are now part of GameSessionParameters, passed to processor

class EMGChannelSignalData(BaseModel):
    sampling_rate: float
    time_axis: List[float]
    data: List[float] # This will hold the primary C3D signal (e.g., "CH1 Raw")
    rms_envelope: Optional[List[float]] = None # For the calculated RMS envelope
    activated_data: Optional[List[float]] = None # If you have a separate "activated" signal processing step

class EMGAnalysisResult(BaseModel):
    """Model for the complete EMG analysis result."""
    file_id: str
    timestamp: str
    source_filename: str
    metadata: GameMetadata # Will include GameSessionParameters
    analytics: Dict[str, ChannelAnalytics]
    available_channels: List[str]
    emg_signals: Dict[str, EMGChannelSignalData]
    user_id: Optional[str] = None
    session_id: Optional[str] = None
    patient_id: Optional[str] = None

class EMGRawData(BaseModel):
    """Model for returning raw EMG data for a specific channel."""
    channel_name: str
    sampling_rate: float
    data: List[float]
    time_axis: List[float]
    activated_data: Optional[List[float]] = None
    contractions: Optional[List[Contraction]] = None # Will include is_good flag
"""
GHOSTLY+ Pydantic Models
===================================

Data models for the FastAPI implementation to validate
and serialize/deserialize data.
"""

from pydantic import BaseModel, Field
from typing import Dict, List, Optional
from datetime import datetime

# Default parameters
DEFAULT_THRESHOLD_FACTOR = 0.3
DEFAULT_MIN_DURATION_MS = 50
DEFAULT_SMOOTHING_WINDOW = 25

class Contraction(BaseModel):
    start_time_ms: float
    end_time_ms: float
    duration_ms: float
    mean_amplitude: float
    max_amplitude: float

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

class GameMetadata(BaseModel):
    game_name: Optional[str] = None
    level: Optional[str] = None
    duration: Optional[float] = None
    therapist_id: Optional[str] = None
    group_id: Optional[str] = None
    time: Optional[str] = None
    player_name: Optional[str] = None
    score: Optional[float] = None

class ProcessingOptions(BaseModel):
    threshold_factor: float = Field(DEFAULT_THRESHOLD_FACTOR, description="Factor of max amplitude to use as threshold")
    min_duration_ms: int = Field(DEFAULT_MIN_DURATION_MS, description="Minimum duration of a contraction in milliseconds")
    smoothing_window: int = Field(DEFAULT_SMOOTHING_WINDOW, description="Window size for smoothing the signal")

class EMGAnalysisResult(BaseModel):
    """Model for the complete EMG analysis result."""
    file_id: str
    timestamp: str
    source_filename: str
    metadata: GameMetadata
    analytics: Dict[str, ChannelAnalytics]
    available_channels: List[str]
    plots: Dict[str, str] = {}
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
    contractions: Optional[List[Contraction]] = None
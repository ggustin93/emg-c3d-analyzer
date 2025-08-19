"""
Request Validation Dependencies
==============================

Common validation patterns and parameter extraction.
Implements DRY principle for repeated parameter patterns.
"""

from typing import Optional
from fastapi import Form
from models.models import (
    ProcessingOptions, GameSessionParameters,
    DEFAULT_THRESHOLD_FACTOR, DEFAULT_MIN_DURATION_MS, DEFAULT_SMOOTHING_WINDOW,
    DEFAULT_MVC_THRESHOLD_PERCENTAGE
)


def get_processing_options(
    threshold_factor: float = Form(DEFAULT_THRESHOLD_FACTOR),
    min_duration_ms: int = Form(DEFAULT_MIN_DURATION_MS),
    smoothing_window: int = Form(DEFAULT_SMOOTHING_WINDOW)
) -> ProcessingOptions:
    """
    Dependency for standard EMG processing options.
    
    Args:
        threshold_factor: Signal threshold multiplier
        min_duration_ms: Minimum contraction duration
        smoothing_window: Signal smoothing window size
        
    Returns:
        ProcessingOptions: Validated processing configuration
    """
    return ProcessingOptions(
        threshold_factor=threshold_factor,
        min_duration_ms=min_duration_ms,
        smoothing_window=smoothing_window
    )


def get_session_parameters(
    session_mvc_value: Optional[float] = Form(None),
    session_mvc_threshold_percentage: Optional[float] = Form(DEFAULT_MVC_THRESHOLD_PERCENTAGE),
    session_expected_contractions: Optional[int] = Form(None),
    session_expected_contractions_ch1: Optional[int] = Form(None),
    session_expected_contractions_ch2: Optional[int] = Form(None),
    contraction_duration_threshold: Optional[int] = Form(2000)
) -> GameSessionParameters:
    """
    Dependency for game session parameters.
    
    Args:
        session_mvc_value: MVC value for session
        session_mvc_threshold_percentage: MVC threshold percentage
        session_expected_contractions: Expected total contractions
        session_expected_contractions_ch1: Expected contractions channel 1
        session_expected_contractions_ch2: Expected contractions channel 2
        contraction_duration_threshold: Duration threshold in milliseconds
        
    Returns:
        GameSessionParameters: Validated session configuration
    """
    return GameSessionParameters(
        session_mvc_value=session_mvc_value,
        session_mvc_threshold_percentage=session_mvc_threshold_percentage,
        session_expected_contractions=session_expected_contractions,
        session_expected_contractions_ch1=session_expected_contractions_ch1,
        session_expected_contractions_ch2=session_expected_contractions_ch2,
        contraction_duration_threshold=contraction_duration_threshold
    )


def get_file_metadata(
    user_id: Optional[str] = Form(None),
    patient_id: Optional[str] = Form(None),
    session_id: Optional[str] = Form(None)
) -> dict:
    """
    Dependency for file metadata extraction.
    
    Args:
        user_id: User identifier
        patient_id: Patient identifier  
        session_id: Session identifier
        
    Returns:
        dict: File metadata
    """
    return {
        "user_id": user_id,
        "patient_id": patient_id,
        "session_id": session_id
    }
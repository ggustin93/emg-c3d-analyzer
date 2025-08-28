"""EMG Signal Processing Module
===========================

⚡ LOW-LEVEL EMG SIGNAL OPERATIONS
This module provides core signal processing functions for EMG data:
- Envelope calculation (RMS, moving averages)
- Signal filtering and smoothing
- Contraction detection algorithms
- Signal quality assessment

🔗 Used by c3d_processor.py for high-level business logic orchestration
🔗 Focuses on pure signal processing without business context

This module provides standardized, reproducible signal processing for EMG analysis.
All processing parameters are explicitly documented and controlled by our system,
ensuring scientific rigor and clinical consistency.

DESIGN PRINCIPLES:
1. Single Source of Truth: Always start with RAW signals
2. Documented Parameters: All processing steps are transparent and reproducible
3. Clinical Consistency: Same processing for all channels and sessions
4. Scientific Rigor: No black-box processing from external systems

Author: EMG C3D Analyzer Team
Date: 2025-08-08
"""

import logging
from typing import Dict, Optional, Tuple

import numpy as np
from scipy.signal import butter, filtfilt

# Configure module logger
logger = logging.getLogger(__name__)

# PROCESSING PARAMETERS - All documented and scientifically justified
class ProcessingParameters:
    """Standardized processing parameters for EMG signal analysis.
    
    These parameters are based on clinical literature and ensure
    consistency across all processing operations.
    """

    # High-pass filtering to remove DC offset and baseline drift
    # Clinical justification: Remove movement artifacts and baseline drift below 20Hz
    HIGHPASS_FILTER_ENABLED = True
    HIGHPASS_CUTOFF_HZ = 20.0  # Hz - Remove baseline drift and movement artifacts

    # Rectification - Convert signal to absolute values for amplitude analysis
    RECTIFICATION_ENABLED = True

    # Low-pass filtering for envelope extraction
    # Clinical justification: Create smooth envelope after rectification
    LOWPASS_FILTER_ENABLED = True
    LOWPASS_CUTOFF_HZ = 10.0  # Hz - For smooth RMS envelope (changed from 500Hz)
    FILTER_ORDER = 4  # 4th order Butterworth filter

    # Smoothing - Moving average window for additional envelope smoothing
    # Clinical justification: 50ms window is standard for EMG envelope extraction
    SMOOTHING_WINDOW_MS = 50.0  # milliseconds

    # Quality validation thresholds
    MIN_SIGNAL_VARIATION = 1e-10  # Minimum std deviation to consider signal valid
    MIN_SAMPLES_REQUIRED = 1000  # Minimum samples for reliable processing

def validate_signal_quality(signal: np.ndarray, sampling_rate: int) -> tuple[bool, str]:
    """Validate signal quality before processing.
    
    Args:
        signal: Raw EMG signal array
        sampling_rate: Sampling rate in Hz
        
    Returns:
        (is_valid, message): Tuple indicating validity and description
    """
    if len(signal) < ProcessingParameters.MIN_SAMPLES_REQUIRED:
        return False, f"Signal too short: {len(signal)} samples < {ProcessingParameters.MIN_SAMPLES_REQUIRED} required"

    if np.std(signal) < ProcessingParameters.MIN_SIGNAL_VARIATION:
        return False, f"Signal lacks variation: std={np.std(signal):.2e} < {ProcessingParameters.MIN_SIGNAL_VARIATION:.2e}"

    if np.any(np.isnan(signal)) or np.any(np.isinf(signal)):
        return False, "Signal contains NaN or infinite values"

    return True, "Signal quality acceptable"

def preprocess_emg_signal(
    raw_signal: np.ndarray,
    sampling_rate: int,
    enable_filtering: bool = True,
    enable_rectification: bool = True,
    enable_smoothing: bool = True,
    custom_smoothing_window_ms: float | None = None
) -> dict:
    """Apply standardized EMG signal preprocessing pipeline.
    
    This function implements our controlled, documented processing chain:
    Raw → [High-pass Filter] → [Rectify] → [Low-pass Filter] → [Smooth] → RMS Envelope
    
    Clinical Rationale:
    1. High-pass filtering removes DC offset and baseline drift (20Hz)
    2. Rectification converts to positive values for amplitude analysis  
    3. Low-pass filtering creates smooth envelope (10Hz)
    4. Additional smoothing for final envelope refinement
    
    Args:
        raw_signal: Original EMG signal from C3D file
        sampling_rate: Sampling frequency in Hz
        enable_filtering: Apply low-pass filter for noise reduction
        enable_rectification: Convert to absolute values
        enable_smoothing: Apply moving average smoothing
        custom_smoothing_window_ms: Override default smoothing window
        
    Returns:
        Dictionary containing:
        - 'processed_signal': Final processed signal array
        - 'processing_steps': List of applied processing steps
        - 'parameters_used': Processing parameters for reproducibility
        - 'quality_metrics': Signal quality assessment
    """
    # Validate input signal quality
    is_valid, quality_message = validate_signal_quality(raw_signal, sampling_rate)
    if not is_valid:
        logger.warning(f"Signal quality issue: {quality_message}")
        return {
            "processed_signal": None,
            "processing_steps": [],
            "parameters_used": {},
            "quality_metrics": {"valid": False, "message": quality_message},
            "error": quality_message
        }

    # Initialize processing pipeline
    processed_signal = np.array(raw_signal, dtype=np.float64)  # Work with float64 for precision
    processing_steps = []
    parameters_used = {}

    # Step 1: High-pass filtering to remove DC offset and baseline drift
    if enable_filtering and ProcessingParameters.HIGHPASS_FILTER_ENABLED:
        try:
            nyquist = sampling_rate / 2
            highpass_normalized = ProcessingParameters.HIGHPASS_CUTOFF_HZ / nyquist

            if highpass_normalized >= 1.0:
                logger.warning("High-pass cutoff too high for sampling rate, skipping high-pass filtering")
            else:
                b_hp, a_hp = butter(ProcessingParameters.FILTER_ORDER, highpass_normalized, btype="high")
                processed_signal = filtfilt(b_hp, a_hp, processed_signal)
                processing_steps.append(f"High-pass filter: {ProcessingParameters.HIGHPASS_CUTOFF_HZ}Hz, order {ProcessingParameters.FILTER_ORDER}")
                parameters_used["highpass_cutoff_hz"] = ProcessingParameters.HIGHPASS_CUTOFF_HZ

        except Exception as e:
            logger.error(f"High-pass filtering failed: {e!s}")
            processing_steps.append(f"High-pass filtering FAILED: {e!s}")

    # Step 2: Rectification (if enabled)
    if enable_rectification and ProcessingParameters.RECTIFICATION_ENABLED:
        processed_signal = np.abs(processed_signal)
        processing_steps.append("Full-wave rectification")
        parameters_used["rectification_enabled"] = True

    # Step 3: Low-pass filtering for envelope extraction (if enabled)
    if enable_filtering and ProcessingParameters.LOWPASS_FILTER_ENABLED:
        try:
            # Design Butterworth low-pass filter
            nyquist = sampling_rate / 2
            cutoff_normalized = ProcessingParameters.LOWPASS_CUTOFF_HZ / nyquist

            if cutoff_normalized >= 1.0:
                logger.warning("Cutoff frequency too high for sampling rate, skipping filtering")
            else:
                b, a = butter(ProcessingParameters.FILTER_ORDER, cutoff_normalized, btype="low")
                processed_signal = filtfilt(b, a, processed_signal)
                processing_steps.append(f"Low-pass filter for envelope: {ProcessingParameters.LOWPASS_CUTOFF_HZ}Hz, order {ProcessingParameters.FILTER_ORDER}")
                parameters_used["lowpass_cutoff_hz"] = ProcessingParameters.LOWPASS_CUTOFF_HZ
                parameters_used["filter_order"] = ProcessingParameters.FILTER_ORDER

        except Exception as e:
            logger.error(f"Filtering failed: {e!s}")
            processing_steps.append(f"Filtering FAILED: {e!s}")

    # Step 4: Smoothing (if enabled)
    if enable_smoothing:
        smoothing_window_ms = custom_smoothing_window_ms or ProcessingParameters.SMOOTHING_WINDOW_MS
        smoothing_window_samples = int((smoothing_window_ms / 1000.0) * sampling_rate)

        if smoothing_window_samples > 0:
            # Apply moving average smoothing
            window = np.ones(smoothing_window_samples) / smoothing_window_samples
            processed_signal = np.convolve(processed_signal, window, mode="same")
            processing_steps.append(f"Moving average smoothing: {smoothing_window_ms}ms window ({smoothing_window_samples} samples)")
            parameters_used["smoothing_window_ms"] = smoothing_window_ms
            parameters_used["smoothing_window_samples"] = smoothing_window_samples

    # Calculate quality metrics
    quality_metrics = {
        "valid": True,
        "message": quality_message,
        "original_signal_stats": {
            "mean": float(np.mean(raw_signal)),
            "std": float(np.std(raw_signal)),
            "min": float(np.min(raw_signal)),
            "max": float(np.max(raw_signal)),
            "samples": len(raw_signal)
        },
        "processed_signal_stats": {
            "mean": float(np.mean(processed_signal)),
            "std": float(np.std(processed_signal)),
            "min": float(np.min(processed_signal)),
            "max": float(np.max(processed_signal)),
            "samples": len(processed_signal)
        }
    }

    logger.info(f"Signal processing completed: {len(processing_steps)} steps applied")
    for step in processing_steps:
        logger.info(f"  - {step}")

    return {
        "processed_signal": processed_signal,
        "processing_steps": processing_steps,
        "parameters_used": parameters_used,
        "quality_metrics": quality_metrics
    }

def get_processing_metadata() -> dict:
    """Get complete metadata about our signal processing pipeline.
    
    Returns:
        Dictionary with all processing parameters and their clinical justifications
    """
    return {
        "version": "1.0.0",
        "date": "2025-08-08",
        "author": "EMG C3D Analyzer Team",
        "parameters": {
            "highpass_filter_enabled": ProcessingParameters.HIGHPASS_FILTER_ENABLED,
            "highpass_cutoff_hz": ProcessingParameters.HIGHPASS_CUTOFF_HZ,
            "rectification_enabled": ProcessingParameters.RECTIFICATION_ENABLED,
            "lowpass_filter_enabled": ProcessingParameters.LOWPASS_FILTER_ENABLED,
            "lowpass_cutoff_hz": ProcessingParameters.LOWPASS_CUTOFF_HZ,
            "filter_order": ProcessingParameters.FILTER_ORDER,
            "smoothing_window_ms": ProcessingParameters.SMOOTHING_WINDOW_MS,
            "min_signal_variation": ProcessingParameters.MIN_SIGNAL_VARIATION,
            "min_samples_required": ProcessingParameters.MIN_SAMPLES_REQUIRED
        },
        "clinical_justifications": {
            "highpass_filter": "Remove DC offset and baseline drift below 20Hz for stable signal baseline",
            "rectification": "Full-wave rectification converts bipolar EMG to unipolar amplitude for muscle activation analysis",
            "lowpass_filter": "Create smooth envelope by filtering rectified signal at 10Hz",
            "smoothing": "50ms moving average window for additional envelope refinement",
            "quality_validation": "Ensure signal has sufficient variation and samples for reliable analysis"
        },
        "pipeline": [
            "Raw Signal Input",
            "Quality Validation",
            "High-pass Filtering (20Hz) - Remove DC offset",
            "Full-wave Rectification",
            "Low-pass Filtering (10Hz) - Create envelope",
            "Moving Average Smoothing (50ms)",
            "RMS Envelope Output"
        ]
    }

# Export for use in processor
__all__ = ["ProcessingParameters", "get_processing_metadata", "preprocess_emg_signal", "validate_signal_quality"]

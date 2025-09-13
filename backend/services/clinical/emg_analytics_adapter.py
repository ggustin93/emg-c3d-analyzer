"""EMG Analytics to Clinical Adapter.
=============================================

🔌 Clean adapter for converting EMG processor analytics format to clinical SessionMetrics format.

ARCHITECTURAL PRINCIPLE: Single Responsibility
- EMG Processor: Handles C3D file processing and signal analysis
- Clinical Service: Handles performance scoring and therapeutic assessment  
- THIS ADAPTER: Converts between the two data formats (DRY compliance)

USAGE: Upload route orchestration between EMG processing and clinical scoring

Author: EMG C3D Analyzer Team
Date: 2025-09-11
"""

import logging
import uuid
from typing import Any

from services.clinical.performance_scoring_service import SessionMetrics

logger = logging.getLogger(__name__)


def convert_emg_analytics_to_clinical_session_metrics(
    emg_analytics: dict[str, Any], 
    session_game_params = None
) -> SessionMetrics:
    """Convert EMG analytics format to SessionMetrics format for clinical service.
    
    CLEAN DATA TRANSFORMATION: 
    - Input: EMG processor analytics (CH1/CH2 channel format)
    - Output: Clinical SessionMetrics (left/right muscle format) 
    - Mapping: CH1 → Left muscle, CH2 → Right muscle
    
    Args:
        emg_analytics: Analytics from GHOSTLYC3DProcessor.process_file()
        session_game_params: Optional session parameters (for expected contractions)
        
    Returns:
        SessionMetrics object ready for clinical service performance scoring
        
    Raises:
        ValueError: If required analytics data is missing or malformed
    """
    try:
        # Extract CH1 (left) and CH2 (right) channel data
        left_channel = emg_analytics.get("CH1", {})
        right_channel = emg_analytics.get("CH2", {})
        
        # Validate that we have meaningful data
        if not left_channel and not right_channel:
            raise ValueError("No EMG analytics data found - expected CH1 and/or CH2 channels")
        
        # Log channel availability for debugging
        available_channels = [ch for ch in ["CH1", "CH2"] if emg_analytics.get(ch)]
        logger.info(f"🔌 Converting {len(available_channels)} channels to clinical format: {available_channels}")
        
        # Extract expected contractions from session parameters (with fallback)
        expected_contractions = 12  # Default from clinical protocol
        if session_game_params and hasattr(session_game_params, 'expected_contractions_per_muscle'):
            expected_contractions = session_game_params.expected_contractions_per_muscle
        
        # Build SessionMetrics using exact field mapping from therapy_session_processor.py
        session_metrics = SessionMetrics(
            session_id=str(uuid.uuid4()),  # Generate unique ID for stateless mode
            
            # Left muscle (CH1) metrics - direct field mapping
            left_total_contractions=left_channel.get("contraction_count", 0),
            left_good_contractions=left_channel.get("good_contraction_count", 0),
            left_mvc_contractions=left_channel.get("mvc_compliant_count", 0),
            left_duration_contractions=left_channel.get("duration_compliant_count", 0),
            
            # Right muscle (CH2) metrics - direct field mapping  
            right_total_contractions=right_channel.get("contraction_count", 0),
            right_good_contractions=right_channel.get("good_contraction_count", 0),
            right_mvc_contractions=right_channel.get("mvc_compliant_count", 0),
            right_duration_contractions=right_channel.get("duration_compliant_count", 0),
            
            # Clinical defaults for stateless upload mode
            bfr_pressure_aop=None,  # Not available in stateless C3D processing
            bfr_compliant=True,  # Assume compliant unless specified
            rpe_post_session=None,  # User subjective data - collected separately
            game_points_achieved=None,  # Game metrics - may add later
            game_points_max=None,  # Game metrics - may add later
            
            # Expected contractions from protocol configuration
            expected_contractions_per_muscle=expected_contractions
        )
        
        # Log successful conversion with key metrics
        total_contractions = (session_metrics.left_total_contractions + 
                            session_metrics.right_total_contractions)
        total_good_contractions = (session_metrics.left_good_contractions + 
                                 session_metrics.right_good_contractions)
        
        logger.info(f"✅ Successfully converted to clinical format: "
                   f"{total_contractions} total contractions, "
                   f"{total_good_contractions} good contractions")
        
        return session_metrics
        
    except Exception as e:
        logger.exception(f"❌ Failed to convert EMG analytics to clinical format: {e}")
        # Return minimal SessionMetrics on error to maintain system stability
        return SessionMetrics(
            session_id=str(uuid.uuid4()),
            # Zero metrics indicate conversion failure
            left_total_contractions=0,
            left_good_contractions=0,
            left_mvc_contractions=0,
            left_duration_contractions=0,
            right_total_contractions=0,
            right_good_contractions=0,
            right_mvc_contractions=0,
            right_duration_contractions=0,
            # Defaults
            bfr_pressure_aop=None,
            bfr_compliant=True,
            rpe_post_session=None,
            game_points_achieved=None,
            game_points_max=None,
            expected_contractions_per_muscle=12  # Protocol default
        )


def validate_emg_analytics_for_clinical_conversion(emg_analytics: dict[str, Any]) -> tuple[bool, str]:
    """Validate EMG analytics data before clinical conversion.
    
    QUALITY GATE: Ensure data integrity before clinical scoring
    
    Args:
        emg_analytics: Analytics from EMG processor
        
    Returns:
        Tuple of (is_valid: bool, error_message: str)
    """
    try:
        if not isinstance(emg_analytics, dict):
            return False, "EMG analytics must be a dictionary"
        
        if not emg_analytics:
            return False, "EMG analytics is empty"
        
        # Check for at least one valid channel
        valid_channels = []
        for channel in ["CH1", "CH2"]:
            channel_data = emg_analytics.get(channel)
            if isinstance(channel_data, dict) and "contraction_count" in channel_data:
                valid_channels.append(channel)
        
        if not valid_channels:
            return False, "No valid EMG channels found (expected CH1/CH2 with contraction_count)"
        
        # Validate required fields for each valid channel
        required_fields = [
            "contraction_count",
            "good_contraction_count", 
            "mvc_compliant_count",
            "duration_compliant_count"
        ]
        
        for channel in valid_channels:
            channel_data = emg_analytics[channel]
            missing_fields = [field for field in required_fields if field not in channel_data]
            if missing_fields:
                return False, f"Channel {channel} missing required fields: {missing_fields}"
        
        return True, "Valid EMG analytics data"
        
    except Exception as e:
        return False, f"Validation error: {str(e)}"
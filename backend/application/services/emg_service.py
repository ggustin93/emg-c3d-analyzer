"""
EMG Analysis Service

Service layer for EMG signal analysis operations.
Coordinates between domain logic and application concerns.
"""

from typing import Dict, List, Optional, Any, Tuple
import numpy as np
from ...domain.analysis import ANALYSIS_FUNCTIONS, analyze_contractions, moving_rms
from ...domain.processing import preprocess_emg_signal, get_processing_metadata, ProcessingParameters
from ...domain.models import GameSessionParameters
from ...core.constants import (
    DEFAULT_MVC_THRESHOLD_PERCENTAGE,
    DEFAULT_CONTRACTION_DURATION_THRESHOLD_MS,
    MIN_CONTRACTION_DURATION_MS
)


class EMGAnalysisService:
    """
    Service for EMG signal analysis operations.
    
    Provides high-level EMG analysis functionality by coordinating
    domain objects and maintaining separation of concerns.
    """
    
    def __init__(self):
        self.processing_params = ProcessingParameters()
    
    def analyze_channel_data(
        self, 
        channel_data: np.ndarray, 
        channel_name: str,
        sampling_rate: float,
        session_params: Optional[GameSessionParameters] = None
    ) -> Dict[str, Any]:
        """
        Analyze a single EMG channel.
        
        Args:
            channel_data: Raw EMG signal data
            channel_name: Name of the channel
            sampling_rate: Signal sampling rate in Hz
            session_params: Session parameters for analysis
            
        Returns:
            Dictionary containing analysis results
        """
        # Preprocess the signal
        processed_signal = preprocess_emg_signal(
            channel_data, 
            sampling_rate, 
            self.processing_params
        )
        
        # Calculate analytics
        analytics = {}
        for metric_name, analysis_func in ANALYSIS_FUNCTIONS.items():
            try:
                analytics[metric_name] = analysis_func(processed_signal, sampling_rate)
            except Exception as e:
                analytics[metric_name] = None
                # Log error in production
                
        # Detect contractions
        contractions = self._detect_contractions(
            processed_signal, 
            sampling_rate, 
            session_params
        )
        
        return {
            'analytics': analytics,
            'contractions': contractions,
            'processed_signal': processed_signal,
            'processing_metadata': get_processing_metadata(self.processing_params)
        }
    
    def _detect_contractions(
        self, 
        signal: np.ndarray, 
        sampling_rate: float,
        session_params: Optional[GameSessionParameters] = None
    ) -> List[Dict[str, Any]]:
        """
        Detect contractions in processed EMG signal.
        
        Args:
            signal: Processed EMG signal
            sampling_rate: Signal sampling rate
            session_params: Session parameters for thresholds
            
        Returns:
            List of detected contractions with metadata
        """
        # Get thresholds from session params or defaults
        mvc_threshold_pct = DEFAULT_MVC_THRESHOLD_PERCENTAGE
        duration_threshold_ms = DEFAULT_CONTRACTION_DURATION_THRESHOLD_MS
        
        if session_params:
            mvc_threshold_pct = getattr(session_params, 'mvc_threshold_percentage', mvc_threshold_pct)
            duration_threshold_ms = getattr(session_params, 'contraction_duration_threshold', duration_threshold_ms)
        
        # Use domain function for contraction analysis
        return analyze_contractions(
            signal, 
            sampling_rate,
            mvc_threshold_percentage=mvc_threshold_pct,
            duration_threshold_ms=duration_threshold_ms
        )
    
    def calculate_mvc_values(
        self, 
        emg_data: Dict[str, np.ndarray], 
        session_params: Optional[GameSessionParameters] = None
    ) -> Dict[str, float]:
        """
        Calculate MVC (Maximum Voluntary Contraction) values for channels.
        
        Args:
            emg_data: Dictionary of channel name to EMG data
            session_params: Session parameters with existing MVC values
            
        Returns:
            Dictionary of channel name to MVC value
        """
        mvc_values = {}
        
        for channel_name, channel_data in emg_data.items():
            if session_params and hasattr(session_params, 'session_mvc_values'):
                # Use existing MVC value if available
                existing_mvc = session_params.session_mvc_values.get(channel_name)
                if existing_mvc:
                    mvc_values[channel_name] = existing_mvc
                    continue
            
            # Calculate MVC as maximum RMS value
            rms_signal = moving_rms(channel_data, window_size=50)  # 50ms window
            mvc_values[channel_name] = float(np.max(rms_signal))
            
        return mvc_values
    
    def generate_time_axis(self, data_length: int, sampling_rate: float) -> np.ndarray:
        """
        Generate time axis for EMG data plotting.
        
        Args:
            data_length: Length of data array
            sampling_rate: Sampling rate in Hz
            
        Returns:
            Time axis array in seconds
        """
        return np.arange(data_length) / sampling_rate
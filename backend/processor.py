"""
GHOSTLY+ C3D File Processing Module
===================================

Core functionality for processing C3D files from the GHOSTLY game,
extracting EMG data, and generating analytics for rehabilitation monitoring.

ASSUMPTIONS & PARAMETERS:
========================
1. EMG DATA PROCESSING:
   - Sampling rate: Default 1000 Hz if not specified in C3D file
   - Channel naming: Assumes channels with 'activated' or activity names ('jumping', 'shooting')
   - Signal processing: Smoothing window applied to reduce noise

2. CONTRACTION DETECTION:
   - Threshold: 30% of maximum amplitude by default (threshold_factor=0.3)
   - Minimum duration: 50ms by default (min_duration_ms=50)
   - Smoothing window size: 25 samples by default (smoothing_window=25)
"""

import os
import numpy as np
import ezc3d
from datetime import datetime
from typing import Dict, List, Optional, Any, Tuple
import json
from .emg_analysis import ANALYSIS_FUNCTIONS, analyze_contractions, moving_rms
from .models import GameSessionParameters

# Import configuration
from .config import (
    DEFAULT_SAMPLING_RATE,
    DEFAULT_THRESHOLD_FACTOR,
    DEFAULT_MIN_DURATION_MS,
    DEFAULT_SMOOTHING_WINDOW,
    RMS_ENVELOPE_WINDOW_MS,
    EMG_COLOR,
    CONTRACTION_COLOR,
    ACTIVITY_COLORS
)


class GHOSTLYC3DProcessor:
    """Class for processing C3D files from the GHOSTLY game."""

    def __init__(self, file_path: str, analysis_functions: Optional[Dict] = None):
        self.file_path = file_path
        self.c3d = None
        self.emg_data = {}
        self.game_metadata = {}
        self.analytics = {}
        self.analysis_functions = analysis_functions if analysis_functions is not None else ANALYSIS_FUNCTIONS
        self.session_game_params_used: Optional[GameSessionParameters] = None

    def load_file(self) -> None:
        """Load the C3D file using ezc3d library."""
        try:
            self.c3d = ezc3d.c3d(self.file_path)
        except Exception as e:
            raise ValueError(f"Error loading C3D file: {str(e)}")

    def extract_metadata(self) -> Dict:
        """Extract game metadata from the C3D file."""
        if not self.c3d:
            self.load_file()

        metadata = {}

        try:
            # Game information
            if 'INFO' in self.c3d['parameters']:
                info_params = self.c3d['parameters']['INFO']

                field_mappings = {
                    'GAME_NAME': 'game_name',
                    'GAME_LEVEL': 'level',
                    'DURATION': 'duration',
                    'THERAPIST_ID': 'therapist_id',
                    'GROUP_ID': 'group_id',
                    'TIME': 'time'
                }

                for c3d_field, output_field in field_mappings.items():
                    if c3d_field in info_params:
                        # Convert all values to string to prevent type errors
                        metadata[output_field] = str(
                            info_params[c3d_field]['value'][0])

            # Player information
            if 'SUBJECTS' in self.c3d['parameters']:
                subject_params = self.c3d['parameters']['SUBJECTS']
                if 'PLAYER_NAME' in subject_params:
                    metadata['player_name'] = str(
                        subject_params['PLAYER_NAME']['value'][0])
                if 'GAME_SCORE' in subject_params:
                    metadata['score'] = str(
                        subject_params['GAME_SCORE']['value'][0])

            # If we couldn't find a level, set a default
            if 'level' not in metadata:
                metadata['level'] = '1'

            # If we couldn't find a time, use current time
            if 'time' not in metadata:
                metadata['time'] = datetime.now().strftime('%Y-%m-%d %H:%M:%S')

            self.game_metadata = metadata
            return metadata

        except Exception as e:
            # Return basic metadata with defaults
            default_metadata = {
                'level': '1',
                'time': datetime.now().strftime('%Y-%m-%d %H:%M:%S')
            }
            self.game_metadata = default_metadata
            return default_metadata

    def extract_emg_data(self) -> Dict[str, Dict]:
        """Extract raw and activated EMG data from the C3D file."""
        if not self.c3d:
            self.load_file()

        emg_data = {}
        errors = []

        try:
            analog_data = self.c3d['data']['analogs']
            
            # Safely get labels from C3D parameters
            labels = []
            if 'ANALOG' in self.c3d['parameters'] and 'LABELS' in self.c3d['parameters']['ANALOG']:
                labels = self.c3d['parameters']['ANALOG']['LABELS']['value']

            # Safely get sampling rate from C3D parameters
            sampling_rate = DEFAULT_SAMPLING_RATE
            if 'ANALOG' in self.c3d['parameters'] and 'RATE' in self.c3d['parameters']['ANALOG']:
                rate_value = self.c3d['parameters']['ANALOG']['RATE']['value']
                if rate_value and len(rate_value) > 0:
                    sampling_rate = float(rate_value[0])

            # Extract each analog channel
            for i in range(analog_data.shape[1]):
                # Use the label if available, otherwise fall back to a default name like CH1, CH2, etc.
                channel_name = labels[i].strip() if i < len(labels) else f"CH{i + 1}"
                
                try:
                    signal_data = analog_data[0, i, :].flatten()
                    if signal_data.size == 0:
                        errors.append(f"No data for channel {channel_name}")
                        continue

                    time_axis = np.arange(len(signal_data)) / sampling_rate

                    # Calculate RMS envelope
                    rms_env_window_samples = int((RMS_ENVELOPE_WINDOW_MS / 1000) * sampling_rate)
                    calculated_rms_envelope = moving_rms(signal_data, rms_env_window_samples).tolist()

                    emg_data[channel_name] = {
                        'data': signal_data.tolist(),
                        'time_axis': time_axis.tolist(),
                        'sampling_rate': sampling_rate,
                        'rms_envelope': calculated_rms_envelope,
                        'activated_data': None  # This can be populated later if needed
                    }
                except IndexError:
                    errors.append(f"Data index out of range for channel {channel_name}")
                except Exception as e:
                    errors.append(f"Failed to load data for {channel_name}: {str(e)}")

            if errors:
                print(f"Completed EMG data extraction with errors: {'; '.join(errors)}")

            self.emg_data = emg_data
            return emg_data

        except KeyError as e:
            raise ValueError(f"C3D file is missing required parameter group: {e}")
        except Exception as e:
            raise ValueError(f"An unexpected error occurred during EMG data extraction: {str(e)}")

    def calculate_analytics(self,
                           threshold_factor: float,
                           min_duration_ms: int,
                           smoothing_window: int,
                           session_params: GameSessionParameters
                          ) -> Dict:
        """
        Calculate analytics for all EMG channels.
        
        Args:
            threshold_factor: Factor of max amplitude to use as threshold for contraction detection
            min_duration_ms: Minimum duration (ms) for a valid contraction
            smoothing_window: Window size for signal smoothing
            session_params: Session parameters including MVC values and thresholds
            
        Returns:
            Dictionary of analytics for each channel
        """
        if not self.emg_data:
            raise ValueError("No EMG data loaded. Call extract_emg_data() first.")
        
        # Initialize per-muscle MVC values if they don't exist
        if not hasattr(session_params, 'session_mvc_values') or not session_params.session_mvc_values:
            session_params.session_mvc_values = {}
            
        if not hasattr(session_params, 'session_mvc_threshold_percentages') or not session_params.session_mvc_threshold_percentages:
            session_params.session_mvc_threshold_percentages = {}
        
        # Determine global MVC threshold if session MVC value is provided - used as fallback
        global_mvc_threshold: Optional[float] = None
        if session_params.session_mvc_value is not None and session_params.session_mvc_threshold_percentage is not None:
            global_mvc_threshold = session_params.session_mvc_value * (session_params.session_mvc_threshold_percentage / 100.0)
        
        all_analytics = {}
        
        # RESILIENT CHANNEL HANDLING:
        # The system preserves raw C3D channel names as keys but extracts base names for analysis.
        # This approach allows the system to handle various C3D naming conventions while maintaining 
        # data integrity and supporting user-defined muscle mappings for display purposes.
        
        # Find unique base channel names (e.g., "CH1" from "CH1 Raw", "CH1 activated")
        # This pattern accommodates different C3D naming conventions:
        # - "CH1 Raw" and "CH1 activated" -> base name "CH1"
        # - "EMG Left Quad Raw" and "EMG Left Quad activated" -> base name "EMG Left Quad"
        base_names = sorted(list(set(
            name.replace(' Raw', '').replace(' activated', '') 
            for name in self.emg_data.keys()
        )))
        
        # Process each base channel
        for i, base_name in enumerate(base_names):
            channel_analytics = {}
            channel_errors = {}
            
            # Determine expected contractions for this channel
            expected_contractions = session_params.session_expected_contractions
            if i == 0 and session_params.session_expected_contractions_ch1 is not None:
                expected_contractions = session_params.session_expected_contractions_ch1
            elif i == 1 and session_params.session_expected_contractions_ch2 is not None:
                expected_contractions = session_params.session_expected_contractions_ch2
            
            # Store expected contractions in analytics
            channel_analytics['expected_contractions'] = expected_contractions
            
            # Determine channel-specific MVC threshold
            actual_mvc_threshold: Optional[float] = None
            
            # First check if we have channel-specific MVC values
            if (hasattr(session_params, 'session_mvc_values') and 
                session_params.session_mvc_values and 
                base_name in session_params.session_mvc_values):
                
                channel_mvc = session_params.session_mvc_values.get(base_name)
                
                # Use channel-specific threshold percentage if available
                if (hasattr(session_params, 'session_mvc_threshold_percentages') and 
                    session_params.session_mvc_threshold_percentages and 
                    base_name in session_params.session_mvc_threshold_percentages):
                    
                    threshold_percentage = session_params.session_mvc_threshold_percentages.get(base_name)
                    if channel_mvc is not None and threshold_percentage is not None:
                        actual_mvc_threshold = channel_mvc * (threshold_percentage / 100.0)
                
                # Fall back to global threshold percentage
                elif channel_mvc is not None and session_params.session_mvc_threshold_percentage is not None:
                    actual_mvc_threshold = channel_mvc * (session_params.session_mvc_threshold_percentage / 100.0)
            
            # Fall back to global MVC threshold
            else:
                actual_mvc_threshold = global_mvc_threshold
            
            # --- Full-Signal Analysis on RAW data ---
            raw_channel_name = f"{base_name} Raw"
            if raw_channel_name in self.emg_data:
                raw_signal = np.array(self.emg_data[raw_channel_name]['data'])
                sampling_rate = self.emg_data[raw_channel_name]['sampling_rate']
                
                # Apply all registered analysis functions to the raw signal
                for func_name, func in self.analysis_functions.items():
                    try:
                        result = func(raw_signal, sampling_rate)
                        channel_analytics.update(result)
                    except Exception as e:
                        channel_errors[func_name] = f"Analysis failed: {str(e)}"
                        channel_analytics[func_name] = None

            # --- Contraction Analysis ---
            # SIGNAL SELECTION STRATEGY:
            # The system uses a hierarchical approach to select the most appropriate signal for contraction analysis:
            # 1. Prefer "activated" signals (processed by GHOSTLY game) for contraction detection
            # 2. Fall back to "Raw" signals if activated signals are not available
            # 3. Use base channel name as final fallback for different C3D naming conventions
            # This ensures robust analysis across various C3D file formats and processing pipelines.
            
            signal_for_contraction = None
            activated_channel_name = f"{base_name} activated"
            
            if activated_channel_name in self.emg_data:
                # Use activated signal - preferred for contraction analysis
                signal_for_contraction = np.array(self.emg_data[activated_channel_name]['data'])
                sampling_rate = self.emg_data[activated_channel_name]['sampling_rate']
            elif raw_channel_name in self.emg_data:
                # Fall back to raw signal if activated is not available
                signal_for_contraction = np.array(self.emg_data[raw_channel_name]['data'])
                sampling_rate = self.emg_data[raw_channel_name]['sampling_rate']
                channel_errors['contractions_source'] = "Used Raw signal for contractions (Activated not found)"
            else:
                # Try the base name itself as a fallback for different naming conventions
                if base_name in self.emg_data:
                    signal_for_contraction = np.array(self.emg_data[base_name]['data'])
                    sampling_rate = self.emg_data[base_name]['sampling_rate']
                    channel_errors['contractions_source'] = f"Used {base_name} signal for contractions"

            if signal_for_contraction is not None:
                try:
                    contraction_stats = analyze_contractions(
                        signal=signal_for_contraction,
                        sampling_rate=sampling_rate,
                        threshold_factor=threshold_factor,
                        min_duration_ms=min_duration_ms,
                        smoothing_window=smoothing_window,
                        mvc_amplitude_threshold=actual_mvc_threshold
                    )
                    channel_analytics.update(contraction_stats)
                    
                    # Initialize MVC value to max amplitude if not provided
                    max_amplitude = contraction_stats.get('max_amplitude', 0.0)
                    if (not session_params.session_mvc_values or 
                        base_name not in session_params.session_mvc_values or 
                        session_params.session_mvc_values[base_name] is None):
                        print(f"Initializing MVC value for {base_name} to max amplitude: {max_amplitude}")
                        if not session_params.session_mvc_values:
                            session_params.session_mvc_values = {}
                        session_params.session_mvc_values[base_name] = max_amplitude
                        
                        # Recalculate MVC threshold with the new MVC value
                        if session_params.session_mvc_threshold_percentages and base_name in session_params.session_mvc_threshold_percentages:
                            threshold_percentage = session_params.session_mvc_threshold_percentages[base_name]
                            if threshold_percentage is not None:
                                actual_mvc_threshold = max_amplitude * (threshold_percentage / 100.0)
                                # Update the threshold in the analytics
                                channel_analytics['mvc_threshold_actual_value'] = actual_mvc_threshold
                        elif session_params.session_mvc_threshold_percentage:
                            actual_mvc_threshold = max_amplitude * (session_params.session_mvc_threshold_percentage / 100.0)
                            # Update the threshold in the analytics
                            channel_analytics['mvc_threshold_actual_value'] = actual_mvc_threshold
                    
                    # Initialize MVC threshold percentage if not provided
                    if (not session_params.session_mvc_threshold_percentages or 
                        base_name not in session_params.session_mvc_threshold_percentages or 
                        session_params.session_mvc_threshold_percentages[base_name] is None):
                        default_threshold = session_params.session_mvc_threshold_percentage or 70
                        print(f"Initializing MVC threshold percentage for {base_name} to default: {default_threshold}%")
                        if not session_params.session_mvc_threshold_percentages:
                            session_params.session_mvc_threshold_percentages = {}
                        session_params.session_mvc_threshold_percentages[base_name] = default_threshold
                        
                        # Recalculate MVC threshold with the new threshold percentage
                        if session_params.session_mvc_values and base_name in session_params.session_mvc_values:
                            mvc_value = session_params.session_mvc_values[base_name]
                            if mvc_value is not None:
                                actual_mvc_threshold = mvc_value * (default_threshold / 100.0)
                                # Update the threshold in the analytics
                                channel_analytics['mvc_threshold_actual_value'] = actual_mvc_threshold
                    
                except Exception as e:
                    channel_errors['contractions'] = f"Contraction analysis failed: {str(e)}"
                    # Provide default values for required fields
                    channel_analytics.update({
                        'contraction_count': 0,
                        'avg_duration_ms': 0.0,
                        'min_duration_ms': 0.0,
                        'max_duration_ms': 0.0,
                        'total_time_under_tension_ms': 0.0,
                        'avg_amplitude': 0.0,
                        'max_amplitude': 0.0,
                        'contractions': [],
                        'good_contraction_count': 0 if actual_mvc_threshold is not None else None,
                        'mvc_threshold_actual_value': actual_mvc_threshold
                    })
            else:
                channel_errors['contractions'] = "No suitable signal found for contraction analysis"
                # Provide default values for required fields
                channel_analytics.update({
                    'contraction_count': 0,
                    'avg_duration_ms': 0.0,
                    'min_duration_ms': 0.0,
                    'max_duration_ms': 0.0,
                    'total_time_under_tension_ms': 0.0,
                    'avg_amplitude': 0.0,
                    'max_amplitude': 0.0,
                    'contractions': [],
                    'good_contraction_count': 0 if actual_mvc_threshold is not None else None,
                    'mvc_threshold_actual_value': actual_mvc_threshold
                })

            if channel_errors:
                channel_analytics['errors'] = channel_errors

            all_analytics[base_name] = channel_analytics

        self.analytics = all_analytics
        return all_analytics

    def process_file(self,
                     processing_opts,
                     session_game_params: GameSessionParameters
                    ) -> Dict:
        """
        Process the C3D file and return complete analysis results.
        
        STATELESS ARCHITECTURE:
        This method implements a stateless processing pattern where all analysis is performed
        in-memory and results are returned in a single comprehensive response. No files are
        persisted to disk, making the system ideal for cloud deployment and eliminating
        the need for cache management or cleanup processes.
        
        The bundled response includes:
        - Complete metadata from the C3D file
        - All calculated analytics for each channel
        - List of available channels for frontend consumption
        - All signal data (raw, activated, RMS envelopes) for client-side visualization
        """
        self.load_file()
        self.game_metadata = self.extract_metadata()
        self.emg_data = self.extract_emg_data()
        self.analytics = self.calculate_analytics(
            threshold_factor=processing_opts.threshold_factor,
            min_duration_ms=processing_opts.min_duration_ms,
            smoothing_window=processing_opts.smoothing_window,
            session_params=session_game_params
        )
        
        return {
            "metadata": self.game_metadata,
            "analytics": self.analytics,
            "available_channels": list(self.emg_data.keys())
        }

    def _determine_effective_mvc_threshold(self, logical_muscle_name: str, session_params: GameSessionParameters) -> Optional[float]:
        """
        Determine the effective MVC threshold for a given muscle.
        
        Args:
            logical_muscle_name: Name of the muscle
            session_params: Session parameters including MVC values and thresholds
            
        Returns:
            Effective MVC threshold for the muscle
        """
        # If no specific value, but there is a global one, use it as a fallback
        if session_params.session_mvc_value is not None and session_params.session_mvc_threshold_percentage is not None:
             return session_params.session_mvc_value * (session_params.session_mvc_threshold_percentage / 100.0)

        return None # No MVC-based threshold can be determined

    def recalculate_scores_from_data(self,
                                     existing_analytics: Dict,
                                     session_game_params: GameSessionParameters
                                    ) -> Dict:
        """
        Recalculate scores for an existing result with updated session parameters.
        
        Args:
            existing_analytics: The existing result data
            session_game_params: Updated session parameters
            
        Returns:
            Updated result data with recalculated scores
        """
        # Store the session game parameters that were used for this processing run
        self.session_game_params_used = session_game_params
        
        # Update the metadata with the new session parameters
        updated_metadata = existing_analytics.get('metadata', {})
        updated_metadata['session_parameters_used'] = session_game_params.model_dump()
        
        # Get the existing analytics
        existing_analytics = existing_analytics.get('analytics', {})
        updated_analytics = {}
        
        # Get available channels
        available_channels = existing_analytics.keys()
        
        # Find unique base channel names (e.g., "CH1" from "CH1 Raw", "CH1 activated")
        base_names = sorted(list(set(
            name.replace(' Raw', '').replace(' activated', '') 
            for name in available_channels
        )))
        
        # Initialize per-muscle MVC values if they don't exist
        if not hasattr(session_game_params, 'session_mvc_values') or not session_game_params.session_mvc_values:
            session_game_params.session_mvc_values = {}
            
        if not hasattr(session_game_params, 'session_mvc_threshold_percentages') or not session_game_params.session_mvc_threshold_percentages:
            session_game_params.session_mvc_threshold_percentages = {}
            
        # Ensure all base channels have MVC values
        for base_name in base_names:
            if base_name not in session_game_params.session_mvc_values:
                # Use global value as fallback if available
                session_game_params.session_mvc_values[base_name] = session_game_params.session_mvc_value
                
            if base_name not in session_game_params.session_mvc_threshold_percentages:
                # Use global threshold as fallback
                session_game_params.session_mvc_threshold_percentages[base_name] = session_game_params.session_mvc_threshold_percentage
            
        # Process each channel
        for i, base_name in enumerate(base_names):
            # Get the existing analytics for this channel
            channel_analytics = existing_analytics.get(base_name, {})
            
            # Get the contractions for this channel
            contractions = channel_analytics.get('contractions', [])
            
            # Determine which expected contractions count to use
            expected_contractions = session_game_params.session_expected_contractions
            if i == 0 and session_game_params.session_expected_contractions_ch1 is not None:
                expected_contractions = session_game_params.session_expected_contractions_ch1
            elif i == 1 and session_game_params.session_expected_contractions_ch2 is not None:
                expected_contractions = session_game_params.session_expected_contractions_ch2
            
            # Determine channel-specific MVC threshold
            actual_mvc_threshold: Optional[float] = None
            
            # First check if we have channel-specific MVC values
            if (hasattr(session_game_params, 'session_mvc_values') and 
                session_game_params.session_mvc_values and 
                base_name in session_game_params.session_mvc_values):
                
                channel_mvc = session_game_params.session_mvc_values.get(base_name)
                
                # Use channel-specific threshold percentage if available
                if (hasattr(session_game_params, 'session_mvc_threshold_percentages') and 
                    session_game_params.session_mvc_threshold_percentages and 
                    base_name in session_game_params.session_mvc_threshold_percentages):
                    
                    threshold_percentage = session_game_params.session_mvc_threshold_percentages.get(base_name)
                    if channel_mvc is not None and threshold_percentage is not None:
                        actual_mvc_threshold = channel_mvc * (threshold_percentage / 100.0)
                
                # Fall back to global threshold percentage
                elif channel_mvc is not None and session_game_params.session_mvc_threshold_percentage is not None:
                    actual_mvc_threshold = channel_mvc * (session_game_params.session_mvc_threshold_percentage / 100.0)
            
            # Fall back to global MVC value and threshold
            elif session_game_params.session_mvc_value is not None and session_game_params.session_mvc_threshold_percentage is not None:
                actual_mvc_threshold = session_game_params.session_mvc_value * (session_game_params.session_mvc_threshold_percentage / 100.0)
            
            # Count good contractions based on MVC threshold
            good_contraction_count = 0
            if actual_mvc_threshold is not None:
                for contraction in contractions:
                    if contraction.get('max_amplitude', 0) >= actual_mvc_threshold:
                        contraction['is_good'] = True
                        good_contraction_count += 1
                    else:
                        contraction['is_good'] = False
            
            # Update the channel analytics
            channel_analytics['mvc_threshold_actual_value'] = actual_mvc_threshold
            channel_analytics['good_contraction_count'] = good_contraction_count
            channel_analytics['contractions'] = contractions
            channel_analytics['expected_contractions'] = expected_contractions  # Add expected contractions to analytics
            
            # Add the updated analytics to the result
            updated_analytics[base_name] = channel_analytics
        
        # Return the updated result
        return {
            "metadata": updated_metadata,
            "analytics": updated_analytics,
            "available_channels": available_channels
        }

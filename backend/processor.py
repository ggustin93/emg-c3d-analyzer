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
from .emg_analysis import ANALYSIS_FUNCTIONS, analyze_contractions
from .models import GameSessionParameters

# Default parameters for EMG processing
DEFAULT_SAMPLING_RATE = 1000  # Hz
DEFAULT_THRESHOLD_FACTOR = 0.3  # 30% of max amplitude
DEFAULT_MIN_DURATION_MS = 50  # Minimum contraction duration in ms
DEFAULT_SMOOTHING_WINDOW = 25  # Smoothing window size in samples

# Visualization settings
EMG_COLOR = '#1abc9c'  # Teal color for EMG signal
CONTRACTION_COLOR = '#3498db'  # Blue color for contractions
ACTIVITY_COLORS = {
    'jumping': '#1abc9c',  # Teal
    'shooting': '#e67e22'  # Orange
}


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
                    emg_data[channel_name] = {
                        'data': signal_data.tolist(),
                        'time_axis': time_axis.tolist(),
                        'sampling_rate': sampling_rate
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
        Calculate summary analytics by applying the correct analysis to the correct signal type.
        - Contraction analysis is run on "activated" signals.
        - Full-signal metrics (RMS, MAV, MPF, etc.) are run on "Raw" signals.
        """
        if not self.emg_data:
            self.extract_emg_data()

        all_analytics = {}
        
        # Determine actual MVC amplitude threshold if session MVC value is provided
        actual_mvc_threshold: Optional[float] = None
        if session_params.session_mvc_value is not None and session_params.session_mvc_threshold_percentage is not None:
            actual_mvc_threshold = session_params.session_mvc_value * (session_params.session_mvc_threshold_percentage / 100.0)
        
        # Find unique base channel names (e.g., "CH1" from "CH1 Raw", "CH1 activated")
        base_names = sorted(list(set(
            name.replace(' Raw', '').replace(' activated', '') 
            for name in self.emg_data.keys()
        )))

        for base_name in base_names:
            channel_analytics = {}
            channel_errors = {}

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
            # Prefer activated signal for contraction analysis, fall back to raw if needed
            signal_for_contraction = None
            activated_channel_name = f"{base_name} activated"
            
            if activated_channel_name in self.emg_data:
                signal_for_contraction = np.array(self.emg_data[activated_channel_name]['data'])
                sampling_rate = self.emg_data[activated_channel_name]['sampling_rate']
            elif raw_channel_name in self.emg_data:
                signal_for_contraction = np.array(self.emg_data[raw_channel_name]['data'])
                sampling_rate = self.emg_data[raw_channel_name]['sampling_rate']
                channel_errors['contractions_source'] = "Used Raw signal for contractions (Activated not found)"
            else:
                # Try the base name itself as a fallback
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
        """
        self.load_file()
        c3d_metadata = self.extract_metadata()
        
        # Store the session game parameters that were used for this processing run
        self.session_game_params_used = session_game_params
        
        # Combine C3D metadata with session game parameters for the final metadata object
        final_metadata_dict = {**c3d_metadata, "session_parameters_used": session_game_params.model_dump()}
        self.game_metadata = final_metadata_dict

        self.extract_emg_data()
        
        self.calculate_analytics(
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

    def plot_ghostly_report(self, save_path: str):
        """Generates and saves the GHOSTLY-style summary report."""
        if not self.game_metadata or not self.analytics or not self.emg_data:
            self.process_file()

        return plot_ghostly_report(game_metadata=self.game_metadata,
                                   analytics_data=self.analytics,
                                   emg_data=self.emg_data,
                                   save_path=save_path,
                                   show_plot=False)

    def plot_emg_with_contractions(self, channel: str, save_path: str):
        """
        Plots the EMG signal with identified contractions for a given channel.

        Args:
            channel: Name of the EMG channel to plot
            save_path: Path to save the plot
        """
        if channel not in self.emg_data:
            raise ValueError(f"Channel {channel} not found in EMG data")

        # Get base channel name without 'Raw' or 'activated' suffix
        base_name = channel.replace(' Raw', '').replace(' activated', '')
        
        # Get signal data
        signal_data = np.array(self.emg_data[channel]['data'])
        time_axis = np.array(self.emg_data[channel]['time_axis'])
        
        # Get contractions from analytics if available
        contractions = []
        if base_name in self.analytics and 'contractions' in self.analytics[base_name]:
            contractions = self.analytics[base_name]['contractions']
        
        # Get analytics for the channel
        analytics = self.analytics.get(base_name, None)
        
        # Use the imported plotting function
        return plot_emg_with_contractions(
            channel_name=channel,
            signal_data=signal_data,
            time_axis=time_axis,
            contractions=contractions,
            analytics=analytics,
            save_path=save_path,
            show_plot=False
        )

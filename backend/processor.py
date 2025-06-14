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
import matplotlib.pyplot as plt
import ezc3d
from datetime import datetime
from typing import Dict, List, Optional, Any, Tuple
import json
from .emg_analysis import ANALYSIS_FUNCTIONS, analyze_contractions
from .plotting import plot_emg_with_contractions, plot_ghostly_report

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
                            smoothing_window: int
                            ) -> Dict:
        """
        Calculate summary analytics by applying the correct analysis to the correct signal type.
        - Contraction analysis is run on "activated" signals.
        - Full-signal metrics (RMS, MAV, MPF, etc.) are run on "Raw" signals.
        """
        if not self.emg_data:
            self.extract_emg_data()

        all_analytics = {}
        
        # Find unique base channel names (e.g., "CH1" from "CH1 Raw", "CH1 activated")
        base_names = sorted(list(set(
            name.replace(' Raw', '').replace(' activated', '') 
            for name in self.emg_data.keys()
        )))

        for base_name in base_names:
            channel_analytics = {}
            channel_errors = {}

            # Define potential channel names
            raw_channel_name = f"{base_name} Raw"
            activated_channel_name = f"{base_name} activated"

            # --- Full-Signal Analysis on RAW data ---
            if raw_channel_name in self.emg_data:
                raw_signal_data = np.array(self.emg_data[raw_channel_name]['data'])
                sampling_rate = self.emg_data[raw_channel_name]['sampling_rate']
                
                if raw_signal_data.size > 0:
                    for func_name, func in self.analysis_functions.items():
                        try:
                            result = func(raw_signal_data, sampling_rate)
                            channel_analytics.update(result)
                        except Exception as e:
                            channel_analytics[func_name] = None
                            channel_errors[func_name] = f"Calculation failed: {e}"
                else:
                    channel_errors['raw_signal'] = "Empty raw signal"

            # --- Contraction Analysis on ACTIVATED data ---
            if activated_channel_name in self.emg_data:
                activated_signal_data = np.array(self.emg_data[activated_channel_name]['data'])
                sampling_rate = self.emg_data[activated_channel_name]['sampling_rate']

                if activated_signal_data.size > 0:
                    try:
                        contraction_stats = analyze_contractions(
                            signal=activated_signal_data,
                            sampling_rate=sampling_rate,
                            threshold_factor=threshold_factor,
                            min_duration_ms=min_duration_ms,
                            smoothing_window=smoothing_window
                        )
                        channel_analytics.update(contraction_stats)
                    except Exception as e:
                        channel_errors['contractions'] = f"Contraction analysis failed: {e}"
                else:
                    channel_errors['activated_signal'] = "Empty activated signal"

            # Fallback for channels that are neither "Raw" nor "activated"
            if not raw_channel_name in self.emg_data and not activated_channel_name in self.emg_data and base_name in self.emg_data:
                 # This is a standalone channel, run all analytics on it.
                signal_data = np.array(self.emg_data[base_name]['data'])
                sampling_rate = self.emg_data[base_name]['sampling_rate']
                if signal_data.size > 0:
                    # Contractions
                    try:
                        contraction_stats = analyze_contractions(
                            signal=signal_data, sampling_rate=sampling_rate,
                            threshold_factor=threshold_factor, min_duration_ms=min_duration_ms,
                            smoothing_window=smoothing_window
                        )
                        channel_analytics.update(contraction_stats)
                    except Exception as e:
                        channel_errors['contractions'] = f"Contraction analysis failed: {e}"
                    # Full signal
                    for func_name, func in self.analysis_functions.items():
                        try:
                            result = func(signal_data, sampling_rate)
                            channel_analytics.update(result)
                        except Exception as e:
                            channel_analytics[func_name] = None
                            channel_errors[func_name] = f"Calculation failed for {func_name}: {e}"

            # Add any collected errors to the final output
            if channel_errors:
                # Ensure values are initialized even if calculations fail
                channel_analytics.setdefault('contraction_count', 0)
                channel_analytics.setdefault('avg_duration_ms', 0)
                channel_analytics.setdefault('rms', 0)
                # ... etc for other key metrics ...
                channel_analytics['errors'] = channel_errors
            
            all_analytics[base_name] = channel_analytics

        self.analytics = all_analytics
        return self.analytics

    def process_file(self,
                     threshold_factor: float = DEFAULT_THRESHOLD_FACTOR,
                     min_duration_ms: int = DEFAULT_MIN_DURATION_MS,
                     smoothing_window: int = DEFAULT_SMOOTHING_WINDOW) -> Dict:
        """
        Process the C3D file and return complete analysis results.

        Args:
            threshold_factor: Factor of max amplitude to use as threshold
            min_duration_ms: Minimum duration of a contraction in milliseconds
            smoothing_window: Window size for smoothing the signal

        Returns:
            Dictionary with analysis results
        """
        self.load_file()
        self.extract_metadata()
        self.extract_emg_data()
        self.calculate_analytics(
            threshold_factor=threshold_factor,
            min_duration_ms=min_duration_ms,
            smoothing_window=smoothing_window
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

        signal_data = np.array(self.emg_data[channel]['data'])
        time_axis = np.array(self.emg_data[channel]['time_axis'])
        sampling_rate = self.emg_data[channel]['sampling_rate']

        plt.figure(figsize=(12, 4))
        plt.plot(time_axis, signal_data, label='EMG Signal', color=EMG_COLOR)
        plt.title(f'EMG Signal for {channel}')
        plt.xlabel('Time (s)')
        plt.ylabel('Amplitude')
        plt.legend()

        # Plot identified contractions
        contractions = analyze_contractions(signal_data, sampling_rate)
        for contraction in contractions:
            plt.axvspan(contraction['start_time'], contraction['end_time'], color=CONTRACTION_COLOR, alpha=0.3)

        plt.savefig(save_path)
        plt.close()

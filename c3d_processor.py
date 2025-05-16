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

    def __init__(self, file_path: str):
        self.file_path = file_path
        self.c3d = None
        self.emg_data = {}
        self.game_metadata = {}
        self.contractions = {}
        self.analytics = {}

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
                        metadata[output_field] = info_params[c3d_field]['value'][0]

            # Player information
            if 'SUBJECTS' in self.c3d['parameters']:
                subject_params = self.c3d['parameters']['SUBJECTS']
                if 'PLAYER_NAME' in subject_params:
                    metadata['player_name'] = subject_params['PLAYER_NAME']['value'][0]
                if 'GAME_SCORE' in subject_params:
                    metadata['score'] = subject_params['GAME_SCORE']['value'][0]

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

        try:
            # Extract analog data
            analog_data = self.c3d['data']['analogs']

            # Create dictionary to store EMG channels
            emg_data = {}

            # Get labels if available
            labels = []
            if 'ANALOG' in self.c3d['parameters']:
                if 'LABELS' in self.c3d['parameters']['ANALOG']:
                    labels = self.c3d['parameters']['ANALOG']['LABELS']['value']

            # Get sampling rate
            sampling_rate = DEFAULT_SAMPLING_RATE
            if 'ANALOG' in self.c3d['parameters']:
                if 'RATE' in self.c3d['parameters']['ANALOG']:
                    sampling_rate = float(self.c3d['parameters']['ANALOG']['RATE']['value'][0])

            # Extract each channel
            for i in range(analog_data.shape[1]):
                # Use label if available, otherwise use channel number
                channel_name = f"CH{i+1}" if i >= len(labels) else labels[i]

                # Store the channel data
                signal_data = analog_data[:, i, :].flatten()
                time_axis = np.arange(len(signal_data)) / sampling_rate

                emg_data[channel_name] = {
                    'data': signal_data.tolist(),
                    'time_axis': time_axis.tolist(),
                    'sampling_rate': sampling_rate
                }

                # Detect if this is a raw or activated channel (based on naming convention)
                if "Raw" in channel_name:
                    base_name = channel_name.replace("Raw", "")
                    activated_name = f"{base_name}activated"
                    emg_data[f"{base_name}_raw"] = {
                        'data': signal_data.tolist(),
                        'time_axis': time_axis.tolist(),
                        'sampling_rate': sampling_rate
                    }
                elif "activated" in channel_name:
                    base_name = channel_name.replace("activated", "")
                    emg_data[f"{base_name}_activated"] = {
                        'data': signal_data.tolist(),
                        'time_axis': time_axis.tolist(),
                        'sampling_rate': sampling_rate
                    }

            self.emg_data = emg_data
            return emg_data

        except Exception as e:
            raise ValueError(f"Error extracting EMG data: {str(e)}")

    def detect_contractions(self, 
                           threshold_factor: float = DEFAULT_THRESHOLD_FACTOR, 
                           min_duration_ms: int = DEFAULT_MIN_DURATION_MS,
                           smoothing_window: int = DEFAULT_SMOOTHING_WINDOW) -> Dict[str, List]:
        """Detect muscle contractions from EMG channels."""
        if not self.emg_data:
            self.extract_emg_data()

        contractions = {}

        # Process each channel
        for channel_name, channel_data in self.emg_data.items():
            # Skip channels with zero or constant data
            signal_data = np.array(channel_data['data'])
            if len(signal_data) == 0 or np.all(signal_data == signal_data[0]):
                continue

            sampling_rate = channel_data['sampling_rate']

            # Convert min_duration from ms to samples
            min_duration_samples = int(min_duration_ms * sampling_rate / 1000)

            # Apply smoothing
            if smoothing_window > 0:
                signal_data = np.convolve(signal_data, np.ones(smoothing_window)/smoothing_window, mode='same')

            # Calculate threshold based on the signal
            signal_max = np.max(signal_data)
            if signal_max <= 0:
                continue  # Skip channels with no significant activity

            threshold = threshold_factor * signal_max

            # Find regions above threshold
            above_threshold = signal_data > threshold

            # Find contraction start and end indices
            contractions_list = []
            in_contraction = False
            start_idx = 0

            for i, val in enumerate(above_threshold):
                if val and not in_contraction:
                    # Start of a contraction
                    in_contraction = True
                    start_idx = i
                elif not val and in_contraction:
                    # End of a contraction
                    in_contraction = False
                    duration = i - start_idx

                    # Only count if longer than minimum duration
                    if duration >= min_duration_samples:
                        # Convert indices to time (ms)
                        start_time = start_idx / sampling_rate * 1000
                        end_time = i / sampling_rate * 1000
                        duration_ms = end_time - start_time

                        # Calculate mean and max amplitude during contraction
                        contraction_data = signal_data[start_idx:i]
                        mean_amplitude = float(np.mean(contraction_data))
                        max_amplitude = float(np.max(contraction_data))

                        contractions_list.append({
                            'start_time_ms': float(start_time),
                            'end_time_ms': float(end_time),
                            'duration_ms': float(duration_ms),
                            'mean_amplitude': mean_amplitude,
                            'max_amplitude': max_amplitude
                        })

            # Only add to contractions if we found any
            if contractions_list:
                # Clean up the channel name to use as the activity type
                activity_type = channel_name.strip()
                if '_' in activity_type:
                    activity_type = activity_type.split('_')[0]

                contractions[activity_type] = contractions_list

        self.contractions = contractions
        return contractions

    def calculate_analytics(self) -> Dict:
        """Calculate analytics based on the detected contractions."""
        if not self.contractions:
            self.detect_contractions()

        analytics = {}

        for channel, contractions in self.contractions.items():
            if contractions:
                # Calculate statistics
                durations = [c['duration_ms'] for c in contractions]
                amplitudes = [c['max_amplitude'] for c in contractions]

                channel_analytics = {
                    'contraction_count': len(contractions),
                    'avg_duration_ms': float(np.mean(durations)),
                    'total_duration_ms': float(np.sum(durations)),
                    'max_duration_ms': float(np.max(durations)),
                    'min_duration_ms': float(np.min(durations)),
                    'avg_amplitude': float(np.mean(amplitudes)),
                    'max_amplitude': float(np.max(amplitudes))
                }

                analytics[channel] = channel_analytics

        self.analytics = analytics
        return analytics

    def plot_emg_with_contractions(self, 
                                  channel: str, 
                                  save_path: Optional[str] = None,
                                  show_plot: bool = False) -> None:
        """
        Plot EMG data with highlighted contractions.

        Args:
            channel: Channel name to plot
            save_path: Path to save the plot image, or None to not save
            show_plot: Whether to display the plot
        """
        if not self.emg_data or not self.contractions:
            raise ValueError("EMG data or contractions not extracted yet")

        # Get the corresponding data
        channel_data = None
        for ch_name, data in self.emg_data.items():
            if channel.lower() in ch_name.lower():
                channel_data = data
                break

        if channel_data is None:
            raise ValueError(f"Channel {channel} not found in EMG data")

        # Create time axis in seconds
        signal_data = np.array(channel_data['data'])
        time_axis = np.array(channel_data['time_axis'])

        # Setup the plot
        plt.figure(figsize=(12, 6))

        # Plot the EMG signal
        plt.plot(time_axis, signal_data, color=EMG_COLOR, linewidth=1, alpha=0.8)

        # Highlight contractions if available
        contraction_key = None
        for key in self.contractions.keys():
            if channel.lower() in key.lower():
                contraction_key = key
                break

        if contraction_key and contraction_key in self.contractions:
            for contraction in self.contractions[contraction_key]:
                start_s = contraction['start_time_ms'] / 1000
                end_s = contraction['end_time_ms'] / 1000
                plt.axvspan(start_s, end_s, color=CONTRACTION_COLOR, alpha=0.3)

        # Set plot properties
        plt.title(f'EMG Signal: {channel}', fontsize=14)
        plt.xlabel('Time (seconds)', fontsize=12)
        plt.ylabel('Amplitude', fontsize=12)
        plt.grid(True, linestyle='--', alpha=0.7)

        # Add analytics if available
        if self.analytics and contraction_key in self.analytics:
            analytics = self.analytics[contraction_key]
            info_text = (
                f"Contractions: {analytics['contraction_count']}\n"
                f"Avg Duration: {analytics['avg_duration_ms']:.2f} ms\n"
                f"Max Amplitude: {analytics['max_amplitude']:.2f}"
            )
            plt.figtext(0.02, 0.02, info_text, fontsize=10, bbox=dict(facecolor='white', alpha=0.8))

        # Save if requested
        if save_path:
            plt.savefig(save_path, dpi=300, bbox_inches='tight')

        # Show if requested
        if show_plot:
            plt.show()
        else:
            plt.close()

        return save_path

    def plot_ghostly_report(self, save_path: Optional[str] = None, show_plot: bool = False) -> str:
        """
        Generate a GHOSTLY-style report with EMG data visualization.

        Args:
            save_path: Path to save the report image, or None to not save
            show_plot: Whether to display the plot

        Returns:
            Path to the saved plot file or None if not saved
        """
        if not self.analytics:
            self.calculate_analytics()

        # Setup the figure
        fig = plt.figure(figsize=(12, 8))  # Reduced height since we're removing the level plot

        # Add logo and title
        plt.figtext(0.05, 0.93, "GHOSTLY", fontsize=28, fontweight='bold', color=EMG_COLOR)
        plt.figtext(0.2, 0.93, "GAME", fontsize=28, fontweight='bold', color='#34495e')
        plt.figtext(0.37, 0.93, "REPORT", fontsize=28, fontweight='bold', color='#7f8c8d')

        # Add metadata
        date_str = self.game_metadata.get('time', datetime.now().strftime('%d/%m/%Y %H:%M'))
        level_str = f"Level: {self.game_metadata.get('level', 'N/A')}"

        plt.figtext(0.75, 0.93, f"Date: {date_str}", fontsize=14)
        plt.figtext(0.75, 0.89, level_str, fontsize=14)

        # Determine available activities to plot
        activities_to_plot = [act for act in self.analytics.keys() if act in ['jumping', 'shooting'] 
                              or any(a in act.lower() for a in ['jump', 'shoot'])]

        if not activities_to_plot:
            # Use whatever we have
            activities_to_plot = list(self.analytics.keys())[:min(2, len(self.analytics.keys()))]

        if not activities_to_plot:
            # If still no activities, use the channels directly
            activities_to_plot = []
            for key in self.emg_data.keys():
                base_key = key.split('_')[0] if '_' in key else key
                if base_key not in activities_to_plot:
                    activities_to_plot.append(base_key)
                    if len(activities_to_plot) >= 2:
                        break

        # Plot each activity - now using 1/2 instead of 1/3 of the figure space
        for i, activity in enumerate(activities_to_plot[:min(2, len(activities_to_plot))]):
            # Get corresponding data
            channel_data = None
            for ch_name, data in self.emg_data.items():
                if activity.lower() in ch_name.lower() and ('activated' in ch_name.lower() or not '_' in ch_name):
                    channel_data = data
                    break

            if channel_data is None:
                # Try raw data as fallback
                for ch_name, data in self.emg_data.items():
                    if activity.lower() in ch_name.lower():
                        channel_data = data
                        break

            if channel_data is None:
                continue

            signal_data = np.array(channel_data['data'])
            time_axis = np.array(channel_data['time_axis'])

            # Create subplot (using 1/2 of the figure instead of 1/3)
            ax = plt.subplot(2, 1, i+1)

            # Plot the EMG signal
            color = ACTIVITY_COLORS.get(activity, f'C{i}')
            ax.plot(time_axis, signal_data, color=color, linewidth=1, alpha=0.8)

            # Add activity name and stats
            activity_stats = self.analytics.get(activity, {})
            contraction_count = activity_stats.get('contraction_count', 'N/A')
            avg_duration = activity_stats.get('avg_duration_ms', 'N/A')

            if avg_duration != 'N/A':
                avg_duration = f"{avg_duration:.2f} ms"

            ax.text(0.02, 0.85, activity, transform=ax.transAxes, fontsize=16, 
                   fontweight='bold', color=color)
            ax.text(0.25, 0.85, f"{contraction_count} contractions", 
                   transform=ax.transAxes, fontsize=12)
            ax.text(0.45, 0.85, f"{avg_duration} (avg. duration)", 
                   transform=ax.transAxes, fontsize=12)

            # Set x-axis ticks every 10 seconds
            max_time = time_axis[-1] if len(time_axis) > 0 else 60
            ax.set_xticks(np.arange(0, max_time, 10))
            ax.set_xlim(0, max_time)

            # Remove y-axis labels and set grid
            ax.set_yticks([])
            ax.grid(True, linestyle='--', alpha=0.3)

            # Add x-labels to all plots since we don't have the level plot anymore
            ax.set_xlabel('Time (seconds)')

        """
        # LEVEL LAYOUT PLOT - COMMENTED OUT 
        """

        # Adjust layout
        plt.tight_layout(rect=[0, 0, 1, 0.87])

        # Save if requested
        if save_path:
            plt.savefig(save_path, dpi=300, bbox_inches='tight')

        if show_plot:
            plt.show()
        else:
            plt.close()

        return save_path if save_path else ""

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
        self.detect_contractions(
            threshold_factor=threshold_factor,
            min_duration_ms=min_duration_ms,
            smoothing_window=smoothing_window
        )
        self.calculate_analytics()

        # Create result dictionary
        result = {
            'metadata': self.game_metadata,
            'analytics': self.analytics,
            'timestamp': datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        }

        return result
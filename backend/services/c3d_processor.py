"""
GHOSTLY+ C3D File Processor Service
==================================

🏗️ HIGH-LEVEL BUSINESS LOGIC SERVICE
This module handles the complete workflow of processing C3D files:
- Reads C3D files from GHOSTLY game
- Extracts EMG channel data  
- Orchestrates signal processing and analysis
- Generates complete analytics results

🔗 Uses signal_processing.py for low-level EMG signal operations
🔗 Uses emg_analysis.py for EMG metric calculations

ASSUMPTIONS & PARAMETERS:
========================
1. EMG DATA PROCESSING:
   - Sampling rate: Default 1000 Hz if not specified in C3D file
   - Channel naming: Assumes channels with 'activated' or activity names ('jumping', 'shooting')
   - Signal processing: Smoothing window applied to reduce noise

2. CONTRACTION DETECTION:
   - Threshold: 10% of maximum amplitude by default (threshold_factor=0.10)
     * Optimized based on 2024-2025 clinical research (5-20% range standard)
     * 10% provides optimal sensitivity/specificity balance for rehabilitation therapy
   - Minimum duration: 100ms by default (min_duration_ms=100)
     * Increased from 50ms for clinical relevance and noise reduction
   - Smoothing window size: 100 samples by default (smoothing_window=100)
     * Increased from 25 for better stability (100-160ms optimal range per research)
   - Merge threshold: 200ms for physiologically related contractions
   - Refractory period: 50ms to prevent artifact detection
"""

import os
import logging
import numpy as np
import ezc3d
from datetime import datetime
from typing import Dict, List, Optional, Any, Tuple
import json

# Configure logger
logger = logging.getLogger(__name__)
from emg.emg_analysis import ANALYSIS_FUNCTIONS, analyze_contractions, moving_rms, calculate_temporal_stats
from models.models import GameSessionParameters
from emg.signal_processing import preprocess_emg_signal, get_processing_metadata, ProcessingParameters

# Import configuration
from config import (
    DEFAULT_SAMPLING_RATE,
    DEFAULT_THRESHOLD_FACTOR,
    ACTIVATED_THRESHOLD_FACTOR,
    DEFAULT_MIN_DURATION_MS,
    DEFAULT_SMOOTHING_WINDOW,
    MERGE_THRESHOLD_MS,
    REFRACTORY_PERIOD_MS,
    # RMS envelope window is centralized in ProcessingParameters.SMOOTHING_WINDOW_MS
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

                    # Calculate RMS envelope using centralized processing window
                    rms_env_window_samples = int((ProcessingParameters.SMOOTHING_WINDOW_MS / 1000) * sampling_rate)
                    # Use rectified signal for RMS per clinical practice
                    calculated_rms_envelope = moving_rms(np.abs(signal_data), rms_env_window_samples).tolist()

                    # Channel data structure
                    channel_data = {
                        'data': signal_data.tolist(),
                        'time_axis': time_axis.tolist(),
                        'sampling_rate': sampling_rate,
                        'rms_envelope': calculated_rms_envelope,
                        'activated_data': None,  # Legacy field - not used in rigorous pipeline
                        'processed_data': None  # Will be populated during analysis with our processing
                    }
                    
                    # Store channel with original C3D name (e.g., "CH1")
                    emg_data[channel_name] = channel_data
                    
                    # ALSO store with "Raw" suffix for analysis pipeline compatibility
                    # This ensures the analysis pipeline can find "{base_name} Raw" channels
                    # But avoid creating duplicate "Raw Raw" entries
                    if not channel_name.endswith(" Raw"):
                        raw_channel_name = f"{channel_name} Raw"
                        emg_data[raw_channel_name] = channel_data.copy()
                        logger.info(f"✅ Created raw channel entries: '{channel_name}' and '{raw_channel_name}'")
                except IndexError:
                    errors.append(f"Data index out of range for channel {channel_name}")
                except Exception as e:
                    errors.append(f"Failed to load data for {channel_name}: {str(e)}")

            if errors:
                logger.warning(f"Completed EMG data extraction with errors: {'; '.join(errors)}")

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
            
            # CLINICAL MVC THRESHOLD ESTIMATION
            # Priority: User-provided > Backend estimation > No threshold (limited quality assessment)
            actual_mvc_threshold: Optional[float] = None
            mvc_estimation_method = "none"
            
            # First check if we have explicitly provided MVC values
            if (hasattr(session_params, 'session_mvc_values') and 
                session_params.session_mvc_values and 
                base_name in session_params.session_mvc_values and
                session_params.session_mvc_values[base_name] is not None):
                
                channel_mvc = session_params.session_mvc_values.get(base_name)
                threshold_percentage = 75.0  # Default clinical standard
                
                # Use channel-specific threshold percentage if available
                if (hasattr(session_params, 'session_mvc_threshold_percentages') and 
                    session_params.session_mvc_threshold_percentages and 
                    base_name in session_params.session_mvc_threshold_percentages and
                    session_params.session_mvc_threshold_percentages[base_name] is not None):
                    threshold_percentage = session_params.session_mvc_threshold_percentages[base_name]
                elif session_params.session_mvc_threshold_percentage is not None:
                    threshold_percentage = session_params.session_mvc_threshold_percentage
                
                actual_mvc_threshold = channel_mvc * (threshold_percentage / 100.0)
                mvc_estimation_method = "user_provided"
                
            # Fall back to global MVC if provided
            elif global_mvc_threshold is not None:
                actual_mvc_threshold = global_mvc_threshold
                mvc_estimation_method = "global_provided"
                
            # Backend clinical estimation based on signal characteristics (when no MVC provided)
            else:
                # We'll estimate after getting the signal - for now set to None
                actual_mvc_threshold = None
                mvc_estimation_method = "backend_estimation"
            
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

                # Compute temporal stats (mean ± std over windows) on raw signal for amplitude/fatigue metrics
                try:
                    temporal = calculate_temporal_stats(raw_signal, sampling_rate)
                    channel_analytics['rms_temporal_stats'] = {
                        'mean_value': temporal['rms']['mean'],
                        'std_value': temporal['rms']['std'],
                        'min_value': temporal['rms'].get('min'),
                        'max_value': temporal['rms'].get('max'),
                        'valid_windows': temporal['rms'].get('n'),
                        'coefficient_of_variation': temporal['rms'].get('cv')
                    }
                    channel_analytics['mav_temporal_stats'] = {
                        'mean_value': temporal['mav']['mean'],
                        'std_value': temporal['mav']['std'],
                        'min_value': temporal['mav'].get('min'),
                        'max_value': temporal['mav'].get('max'),
                        'valid_windows': temporal['mav'].get('n'),
                        'coefficient_of_variation': temporal['mav'].get('cv')
                    }
                    channel_analytics['fatigue_index_temporal_stats'] = {
                        'mean_value': temporal['fatigue_index_fi_nsm5']['mean'],
                        'std_value': temporal['fatigue_index_fi_nsm5']['std'],
                        'min_value': temporal['fatigue_index_fi_nsm5'].get('min'),
                        'max_value': temporal['fatigue_index_fi_nsm5'].get('max'),
                        'valid_windows': temporal['fatigue_index_fi_nsm5'].get('n'),
                        'coefficient_of_variation': temporal['fatigue_index_fi_nsm5'].get('cv')
                    }
                    # Also surface MPF/MDF temporal stats for UI
                    channel_analytics['mpf_temporal_stats'] = {
                        'mean_value': temporal['mpf']['mean'],
                        'std_value': temporal['mpf']['std'],
                        'min_value': temporal['mpf'].get('min'),
                        'max_value': temporal['mpf'].get('max'),
                        'valid_windows': temporal['mpf'].get('n'),
                        'coefficient_of_variation': temporal['mpf'].get('cv')
                    }
                    channel_analytics['mdf_temporal_stats'] = {
                        'mean_value': temporal['mdf']['mean'],
                        'std_value': temporal['mdf']['std'],
                        'min_value': temporal['mdf'].get('min'),
                        'max_value': temporal['mdf'].get('max'),
                        'valid_windows': temporal['mdf'].get('n'),
                        'coefficient_of_variation': temporal['mdf'].get('cv')
                    }
                except Exception as e:
                    channel_errors['temporal_stats'] = f"Temporal analysis failed: {str(e)}"

            # --- RIGOROUS SIGNAL PROCESSING PIPELINE ---
            # DESIGN PRINCIPLE: Single Source of Truth
            # 1. ALWAYS start with RAW signals (scientific rigor)
            # 2. Apply OUR controlled, documented processing
            # 3. Use this processed signal for ALL analysis
            # 4. NEVER use "activated" signals from C3D (unknown processing)
            # 5. Ensure MVC thresholds match the processed signal
            
            raw_signal = None
            sampling_rate = None
            signal_source = ""
            processing_result = None
            
            # Step 1: Find RAW signal (required for scientific rigor)
            if raw_channel_name in self.emg_data:
                raw_signal = np.array(self.emg_data[raw_channel_name]['data'])
                sampling_rate = self.emg_data[raw_channel_name]['sampling_rate']
                signal_source = "RAW"
                logger.info(f"✅ Found RAW signal for {base_name}: {len(raw_signal)} samples at {sampling_rate}Hz")
            else:
                # Try base channel name as fallback for different naming conventions
                if base_name in self.emg_data:
                    raw_signal = np.array(self.emg_data[base_name]['data'])
                    sampling_rate = self.emg_data[base_name]['sampling_rate']
                    signal_source = f"BASE ({base_name})"
                    logger.warning(f"⚠️ RAW signal not found, using base channel {base_name}")
                else:
                    # Critical error: No raw signal available
                    channel_errors['signal_processing'] = f"No RAW signal available for {base_name} - cannot perform rigorous analysis"
                    logger.error(f"❌ CRITICAL: No RAW signal available for {base_name}")
                    continue  # Skip this channel
            
            # Step 2: Apply our rigorous processing pipeline
            if raw_signal is not None:
                logger.info(f"\n{'='*60}")
                logger.info(f"🔬 RIGOROUS SIGNAL PROCESSING for {base_name}")
                logger.info(f"{'='*60}")
                
                processing_result = preprocess_emg_signal(
                    raw_signal=raw_signal,
                    sampling_rate=sampling_rate,
                    enable_filtering=True,  # Remove high-frequency noise
                    enable_rectification=True,  # Full-wave rectification for amplitude
                    enable_smoothing=True  # Envelope extraction
                )
                
                if processing_result['processed_signal'] is None:
                    # Processing failed
                    channel_errors['signal_processing'] = f"Signal processing failed: {processing_result.get('error', 'Unknown error')}"
                    logger.error(f"❌ Signal processing failed for {base_name}: {processing_result.get('error')}")
                    continue  # Skip this channel
                
                # Log processing details
                logger.debug(f"📊 Processing Results:")
                logger.debug(f"  - Source: {signal_source}")
                logger.debug(f"  - Steps applied: {len(processing_result['processing_steps'])}")
                for step in processing_result['processing_steps']:
                    logger.debug(f"    • {step}")
                
                quality = processing_result['quality_metrics']
                logger.debug(f"  - Quality: {'✅ Valid' if quality['valid'] else '❌ Invalid'}")
                logger.debug(f"  - Original signal: mean={quality['original_signal_stats']['mean']:.6e}V, std={quality['original_signal_stats']['std']:.6e}V")
                logger.debug(f"  - Processed signal: mean={quality['processed_signal_stats']['mean']:.6e}V, std={quality['processed_signal_stats']['std']:.6e}V")
                
                # Store processing metadata for transparency
                channel_analytics['signal_processing'] = {
                    'source': signal_source,
                    'processing_steps': processing_result['processing_steps'],
                    'parameters_used': processing_result['parameters_used'],
                    'quality_metrics': processing_result['quality_metrics']
                }
                
                # Store processed signal for frontend access
                # Create processed channel name for frontend display options
                processed_channel_name = f"{base_name} Processed"
                if raw_channel_name in self.emg_data:
                    # Add processed data to the raw channel entry
                    self.emg_data[raw_channel_name]['processed_data'] = processing_result['processed_signal'].tolist()
                    
                    # Also create separate processed channel for frontend flexibility
                    time_axis = self.emg_data[raw_channel_name]['time_axis']
                    
                    # Import signal processing metadata to include in each processed signal
                    from emg.signal_processing import get_processing_metadata
                    
                    self.emg_data[processed_channel_name] = {
                        'data': processing_result['processed_signal'].tolist(),
                        'time_axis': time_axis,
                        'sampling_rate': sampling_rate,
                        'rms_envelope': processing_result['processed_signal'].tolist(),  # Processed signal IS the envelope
                        'activated_data': None,  # Not used
                        'processed_data': None,  # This IS the processed data
                        'is_processed': True,  # Flag to identify processed signals
                        'processing_metadata': {
                            # Include parameters actually used during processing
                            **processing_result['parameters_used'],
                            # Include complete pipeline metadata for export
                            'complete_pipeline_metadata': get_processing_metadata(),
                            # Processing steps applied to this specific signal
                            'processing_steps_applied': processing_result['processing_steps'],
                            # Quality assessment for this signal
                            'quality_metrics': processing_result['quality_metrics'],
                            # Clinical context
                            'signal_info': f"RMS envelope (processed) from rigorous clinical pipeline - {len(processing_result['processing_steps'])} steps applied"
                        }
                    }
                    logger.info(f"✅ Stored processed signal as '{processed_channel_name}'")
                
                logger.info(f"{'='*60}\n")
            
            # Step 3: Use processed signal for ALL analysis
            signal_for_analysis = processing_result['processed_signal'] if processing_result else None

            if signal_for_analysis is not None:
                try:
                    # Get duration threshold from session params
                    # Priority: per-muscle threshold (seconds) > global threshold (milliseconds)
                    duration_threshold_ms = None
                    
                    logger.debug(f"🔍 Backend Duration Threshold Debug for {base_name}:")
                    logger.debug(f"  - session_duration_thresholds_per_muscle: {getattr(session_params, 'session_duration_thresholds_per_muscle', None)}")
                    logger.debug(f"  - contraction_duration_threshold: {getattr(session_params, 'contraction_duration_threshold', None)}")
                    
                    # First check for per-muscle duration threshold (in seconds)
                    if (hasattr(session_params, 'session_duration_thresholds_per_muscle') and 
                        session_params.session_duration_thresholds_per_muscle and 
                        base_name in session_params.session_duration_thresholds_per_muscle):
                        
                        muscle_duration_seconds = session_params.session_duration_thresholds_per_muscle.get(base_name)
                        if muscle_duration_seconds is not None:
                            duration_threshold_ms = float(muscle_duration_seconds) * 1000.0  # Convert seconds to milliseconds
                            logger.debug(f"  ✅ Using per-muscle threshold: {muscle_duration_seconds}s -> {duration_threshold_ms}ms")
                    
                    # Fall back to global duration threshold (already in milliseconds)
                    elif (hasattr(session_params, 'contraction_duration_threshold') and 
                          session_params.contraction_duration_threshold is not None):
                        duration_threshold_ms = float(session_params.contraction_duration_threshold)
                        logger.debug(f"  ✅ Using global threshold: {duration_threshold_ms}ms")
                    else:
                        logger.debug(f"  ❌ No duration threshold found - will use default")
                    
                    # Backend MVC estimation if no threshold provided
                    if mvc_estimation_method == "backend_estimation":
                        # Clinical estimation: Use 95th percentile of rectified signal as MVC estimate
                        # This represents a strong voluntary contraction level
                        rectified_signal = np.abs(signal_for_analysis)
                        estimated_mvc = np.percentile(rectified_signal, 95)
                        threshold_percentage = session_params.session_mvc_threshold_percentage or 75.0
                        actual_mvc_threshold = estimated_mvc * (threshold_percentage / 100.0)
                        
                        logger.debug(f"🤖 Backend MVC Estimation for {base_name}:")
                        logger.debug(f"  - Signal 95th percentile: {estimated_mvc:.6e}V")
                        logger.debug(f"  - Estimated MVC threshold ({threshold_percentage}%): {actual_mvc_threshold:.6e}V")
                        logger.debug(f"  - Method: Clinical estimation from signal statistics")
                        
                        # Store the estimated MVC value for frontend use
                        if not hasattr(session_params, 'session_mvc_values') or not session_params.session_mvc_values:
                            session_params.session_mvc_values = {}
                        session_params.session_mvc_values[base_name] = estimated_mvc
                    
                    # Extract Activated signal for dual signal detection (MVP implementation)
                    activated_signal = None
                    detection_threshold_factor = threshold_factor  # Default for single signal
                    activated_channel_name = f"{base_name} activated"
                    if activated_channel_name in self.emg_data:
                        activated_signal = np.array(self.emg_data[activated_channel_name]['data'])
                        detection_threshold_factor = ACTIVATED_THRESHOLD_FACTOR  # Lower threshold for cleaner Activated signal
                        logger.info(f"🎯 Using dual signal detection: Activated signal ({ACTIVATED_THRESHOLD_FACTOR*100:.1f}% threshold) for timing, RMS envelope for amplitude")
                    else:
                        logger.info(f"ℹ️  Using single signal detection: RMS envelope ({threshold_factor*100:.1f}% threshold) for both timing and amplitude")
                        
                    contraction_stats = analyze_contractions(
                        signal=signal_for_analysis,  # RMS envelope for amplitude assessment
                        sampling_rate=sampling_rate,
                        threshold_factor=detection_threshold_factor,  # Use lower threshold for activated signal timing
                        min_duration_ms=min_duration_ms,
                        smoothing_window=smoothing_window,
                        mvc_amplitude_threshold=actual_mvc_threshold,
                        contraction_duration_threshold_ms=duration_threshold_ms,
                        merge_threshold_ms=MERGE_THRESHOLD_MS,
                        refractory_period_ms=REFRACTORY_PERIOD_MS,
                        temporal_signal=activated_signal  # Activated signal for timing detection
                    )
                    channel_analytics.update(contraction_stats)
                    
                    # Store estimation metadata for frontend
                    channel_analytics['mvc_estimation_method'] = mvc_estimation_method
                    
                    # Store the actual duration threshold used for this channel
                    channel_analytics['duration_threshold_actual_value'] = duration_threshold_ms
                    
                    # CRITICAL FIX: Only initialize MVC if explicitly requested or in development mode
                    # Auto-initializing to max amplitude creates inflated thresholds that mark all contractions as "good"
                    max_amplitude = contraction_stats.get('max_amplitude', 0.0)
                    
                    # Store the actual MVC threshold that was used for quality calculation
                    channel_analytics['mvc_threshold_actual_value'] = actual_mvc_threshold
                    
                    # Enhanced debug logging for contraction analysis
                    logger.debug(f"\n{'='*60}")
                    logger.debug(f"🎯 CONTRACTION ANALYSIS DEBUG for {base_name}")
                    logger.debug(f"{'='*60}")
                    logger.debug(f"📊 Signal Information:")
                    logger.debug(f"  - Signal source: {signal_source}")
                    logger.debug(f"  - Signal min/max: {np.min(signal_for_analysis):.6e}V / {np.max(signal_for_analysis):.6e}V")
                    logger.debug(f"  - Signal mean: {np.mean(np.abs(signal_for_analysis)):.6e}V")
                    logger.debug(f"  - Max amplitude from contractions: {max_amplitude:.6e}V")
                    
                    logger.debug(f"\n⚙️ Thresholds:")
                    logger.debug(f"  - MVC base value: {session_params.session_mvc_values.get(base_name) if session_params.session_mvc_values else None}")
                    logger.debug(f"  - MVC threshold percentage: {session_params.session_mvc_threshold_percentages.get(base_name) if session_params.session_mvc_threshold_percentages else session_params.session_mvc_threshold_percentage}%")
                    logger.debug(f"  - Actual MVC threshold: {actual_mvc_threshold:.6e}V" if actual_mvc_threshold else "  - Actual MVC threshold: None")
                    logger.debug(f"  - Duration threshold: {duration_threshold_ms}ms")
                    
                    # PhD-Level Comprehensive Contraction Analysis
                    contractions = contraction_stats.get('contractions', [])
                    if contractions:
                        # Signal processing context
                        signal_duration_s = len(signal_for_analysis) / sampling_rate
                        print(f"\n🔬 CONTRACTION DETECTION RESULTS")
                        print(f"{'='*80}")
                        print(f"📊 Signal Processing Context:")
                        print(f"  - Input signal: {len(signal_for_analysis):,} samples at {sampling_rate}Hz ({signal_duration_s:.1f}s duration)")
                        print(f"  - Processing pipeline: {' → '.join(processing_result['processing_steps'])}")
                        
                        # Detection algorithm parameters
                        print(f"\n🎯 Detection Algorithm Parameters:")
                        signal_max = np.max(signal_for_analysis)
                        detection_threshold = signal_max * threshold_factor
                        print(f"  - Detection threshold: {threshold_factor*100:.0f}% of max amplitude = {detection_threshold:.6e}V")
                        print(f"  - Minimum duration: {min_duration_ms}ms ({int(min_duration_ms/1000*sampling_rate)} samples)")
                        print(f"  - Smoothing window: {smoothing_window} samples ({smoothing_window/sampling_rate*1000:.1f}ms)")
                        if actual_mvc_threshold:
                            print(f"  - MVC threshold: {actual_mvc_threshold:.6e}V ({session_params.session_mvc_threshold_percentages.get(base_name, session_params.session_mvc_threshold_percentage or 75):.0f}% of MVC)")
                        print(f"  - Duration threshold: {duration_threshold_ms}ms")
                        
                        # Comprehensive contraction listing
                        print(f"\n📋 DETECTED CONTRACTIONS ({len(contractions)} total):")
                        print(f"{'='*80}")
                        
                        # Statistical calculations
                        durations = [c['duration_ms'] for c in contractions]
                        amplitudes = [c['max_amplitude'] for c in contractions]
                        good_contractions = [c for c in contractions if c.get('is_good')]
                        mvc_compliant = [c for c in contractions if c.get('meets_mvc')]
                        duration_compliant = [c for c in contractions if c.get('meets_duration')]
                        
                        # Show ALL contractions with detailed analysis
                        for idx, contraction in enumerate(contractions, 1):
                            start_time_s = contraction['start_time_ms'] / 1000
                            end_time_s = contraction['end_time_ms'] / 1000
                            duration_ms = contraction['duration_ms']
                            max_amp = contraction['max_amplitude']
                            mean_amp = contraction['mean_amplitude']
                            
                            # Classification
                            meets_mvc = contraction.get('meets_mvc', False)
                            meets_duration = contraction.get('meets_duration', False) 
                            is_good = contraction.get('is_good', False)
                            
                            # Status indicators
                            mvc_indicator = "✓" if meets_mvc else "✗"
                            dur_indicator = "✓" if meets_duration else "✗"
                            quality_status = "EXCELLENT" if is_good else "ADEQUATE" if (meets_mvc or meets_duration) else "INSUFFICIENT"
                            quality_color = "🟢" if is_good else "🟡" if (meets_mvc or meets_duration) else "🔴"
                            
                            print(f"  [{idx:02d}] {start_time_s:6.2f}-{end_time_s:6.2f}s ({duration_ms:6.0f}ms): "
                                  f"amp={max_amp:.6e}V, mvc={mvc_indicator}, dur={dur_indicator} → "
                                  f"{quality_color} {quality_status}")
                            
                            # Detailed breakdown for first few contractions
                            if idx <= 3:
                                print(f"       ├─ Peak amplitude: {max_amp:.6e}V (mean: {mean_amp:.6e}V)")
                                if actual_mvc_threshold:
                                    mvc_ratio = (max_amp / actual_mvc_threshold) * 100
                                    print(f"       ├─ MVC compliance: {max_amp:.6e}V {'≥' if meets_mvc else '<'} {actual_mvc_threshold:.6e}V ({mvc_ratio:.1f}% of MVC)")
                                duration_ratio = (duration_ms / duration_threshold_ms) * 100
                                print(f"       └─ Duration compliance: {duration_ms:.0f}ms {'≥' if meets_duration else '<'} {duration_threshold_ms}ms ({duration_ratio:.1f}% of target)")
                        
                        if len(contractions) > 3:
                            print(f"       ... {len(contractions) - 3} additional contractions logged above")
                        
                        # Advanced Statistical Analysis
                        print(f"\n📈 STATISTICAL ANALYSIS:")
                        print(f"{'='*80}")
                        
                        # Quality distribution
                        excellent_count = len(good_contractions)
                        adequate_count = len(mvc_compliant) + len(duration_compliant) - len(good_contractions)  # Remove double counting
                        insufficient_count = len(contractions) - excellent_count - adequate_count
                        
                        print(f"📊 Quality Distribution:")
                        print(f"  • Excellent (both criteria):  {excellent_count:2d}/{len(contractions)} ({excellent_count/len(contractions)*100:5.1f}%)")
                        print(f"  • Adequate (one criterion):   {adequate_count:2d}/{len(contractions)} ({adequate_count/len(contractions)*100:5.1f}%)")
                        print(f"  • Insufficient (neither):     {insufficient_count:2d}/{len(contractions)} ({insufficient_count/len(contractions)*100:5.1f}%)")
                        
                        # Compliance analysis
                        print(f"\n📊 Compliance Analysis:")
                        mvc_compliance_rate = len(mvc_compliant) / len(contractions) * 100 if contractions else 0
                        duration_compliance_rate = len(duration_compliant) / len(contractions) * 100 if contractions else 0
                        overall_compliance_rate = len(good_contractions) / len(contractions) * 100 if contractions else 0
                        
                        print(f"  • MVC compliance:      {len(mvc_compliant):2d}/{len(contractions)} ({mvc_compliance_rate:5.1f}%)")
                        print(f"  • Duration compliance: {len(duration_compliant):2d}/{len(contractions)} ({duration_compliance_rate:5.1f}%)")
                        print(f"  • Overall compliance:  {len(good_contractions):2d}/{len(contractions)} ({overall_compliance_rate:5.1f}%)")
                        
                        # Temporal analysis
                        if durations:
                            print(f"\n📊 Temporal Characteristics:")
                            print(f"  • Duration stats: mean={np.mean(durations):.0f}ms, std={np.std(durations):.0f}ms")
                            print(f"  • Duration range: {np.min(durations):.0f}ms - {np.max(durations):.0f}ms")
                            print(f"  • Total active time: {np.sum(durations)/1000:.1f}s ({np.sum(durations)/1000/signal_duration_s*100:.1f}% of recording)")
                        
                        # Amplitude analysis
                        if amplitudes:
                            print(f"\n📊 Amplitude Characteristics:")
                            print(f"  • Amplitude stats: mean={np.mean(amplitudes):.6e}V, std={np.std(amplitudes):.6e}V")
                            print(f"  • Amplitude range: {np.min(amplitudes):.6e}V - {np.max(amplitudes):.6e}V")
                            if actual_mvc_threshold:
                                max_mvc_percentage = np.max(amplitudes) / actual_mvc_threshold * 100
                                mean_mvc_percentage = np.mean(amplitudes) / actual_mvc_threshold * 100
                                print(f"  • MVC percentages: max={max_mvc_percentage:.1f}%, mean={mean_mvc_percentage:.1f}%")
                        
                        # Clinical recommendations
                        print(f"\n🏥 CLINICAL ASSESSMENT:")
                        print(f"{'='*80}")
                        if overall_compliance_rate >= 80:
                            print(f"  ✅ EXCELLENT therapeutic compliance ({overall_compliance_rate:.1f}%)")
                        elif overall_compliance_rate >= 60:
                            print(f"  🟡 MODERATE therapeutic compliance ({overall_compliance_rate:.1f}%) - consider coaching")
                        else:
                            print(f"  🔴 POOR therapeutic compliance ({overall_compliance_rate:.1f}%) - intervention needed")
                        
                        if mvc_compliance_rate < 70:
                            print(f"  📝 Recommendation: Focus on force generation (only {mvc_compliance_rate:.1f}% meet MVC threshold)")
                        if duration_compliance_rate < 70:
                            print(f"  📝 Recommendation: Focus on contraction duration (only {duration_compliance_rate:.1f}% meet duration threshold)")
                        
                        print(f"{'='*80}")
                    else:
                        print(f"\n⚠️ NO CONTRACTIONS DETECTED")
                        print(f"  - Signal max amplitude: {np.max(signal_for_analysis):.6e}V")
                        print(f"  - Detection threshold: {np.max(signal_for_analysis) * threshold_factor:.6e}V")
                        print(f"  - Consider adjusting detection parameters or signal quality")
                    
                    logger.debug(f"\n{'='*80}\n")
                    logger.debug(f"  - Threshold percentage: {session_params.session_mvc_threshold_percentage}%")
                    
                    # Initialize MVC threshold percentage if not provided
                    if (not session_params.session_mvc_threshold_percentages or 
                        base_name not in session_params.session_mvc_threshold_percentages or 
                        session_params.session_mvc_threshold_percentages[base_name] is None):
                        default_threshold = session_params.session_mvc_threshold_percentage or 70
                        logger.info(f"Initializing MVC threshold percentage for {base_name} to default: {default_threshold}%")
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
            
            # Determine duration threshold for this channel (ms)
            duration_threshold_ms: Optional[float] = None
            try:
                if (hasattr(session_game_params, 'session_duration_thresholds_per_muscle') and
                    session_game_params.session_duration_thresholds_per_muscle and
                    base_name in session_game_params.session_duration_thresholds_per_muscle):
                    per_muscle_seconds = session_game_params.session_duration_thresholds_per_muscle.get(base_name)
                    if per_muscle_seconds is not None:
                        duration_threshold_ms = float(per_muscle_seconds) * 1000.0
                elif session_game_params.contraction_duration_threshold is not None:
                    duration_threshold_ms = float(session_game_params.contraction_duration_threshold)
            except Exception:
                duration_threshold_ms = channel_analytics.get('duration_threshold_actual_value')

            # Recompute flags and counts from existing contraction measurements
            good_contraction_count = 0
            mvc_contraction_count = 0
            duration_contraction_count = 0
            updated_contractions: List[Dict[str, Any]] = []
            try:
                for c in contractions:
                    max_amp = c.get('max_amplitude')
                    dur_ms = c.get('duration_ms')
                    meets_mvc = bool(actual_mvc_threshold is not None and max_amp is not None and max_amp >= actual_mvc_threshold)
                    meets_duration = bool(duration_threshold_ms is not None and dur_ms is not None and dur_ms >= duration_threshold_ms)
                    # Align with backend analyze_contractions semantics
                    if actual_mvc_threshold is not None and duration_threshold_ms is not None:
                        is_good = meets_mvc and meets_duration
                    elif actual_mvc_threshold is not None and duration_threshold_ms is None:
                        is_good = meets_mvc
                    elif actual_mvc_threshold is None and duration_threshold_ms is not None:
                        is_good = meets_duration
                    else:
                        is_good = False
                    if meets_mvc:
                        mvc_contraction_count += 1
                    if meets_duration:
                        duration_contraction_count += 1
                    if is_good:
                        good_contraction_count += 1
                    # Update contraction entry
                    updated = dict(c)
                    updated['meets_mvc'] = meets_mvc
                    updated['meets_duration'] = meets_duration
                    updated['is_good'] = is_good
                    updated_contractions.append(updated)
            except Exception:
                # Fallback to original if malformed
                updated_contractions = contractions
                mvc_contraction_count = channel_analytics.get('mvc_contraction_count', 0) or 0
                duration_contraction_count = channel_analytics.get('duration_contraction_count', 0) or 0
                good_contraction_count = channel_analytics.get('good_contraction_count', 0) or 0
            
            # Update the channel analytics
            channel_analytics['mvc_threshold_actual_value'] = actual_mvc_threshold
            channel_analytics['duration_threshold_actual_value'] = duration_threshold_ms
            channel_analytics['good_contraction_count'] = good_contraction_count
            channel_analytics['mvc_contraction_count'] = mvc_contraction_count
            channel_analytics['duration_contraction_count'] = duration_contraction_count
            channel_analytics['contractions'] = updated_contractions
            channel_analytics['expected_contractions'] = expected_contractions  # Add expected contractions to analytics
            
            # Add the updated analytics to the result
            updated_analytics[base_name] = channel_analytics
        
        # Return the updated result
        return {
            "metadata": updated_metadata,
            "analytics": updated_analytics,
            "available_channels": available_channels
        }

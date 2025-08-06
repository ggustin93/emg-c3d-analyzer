"""
EMG Analysis Functions Module
=============================

This module contains a collection of functions for calculating various
EMG (Electromyography) metrics from signal data. Each function is designed
to be a standalone calculation that can be easily integrated into a larger
processing pipeline. The hypotheses and implementation choices for each metric are documented below.

DISCLAIMER: This module was written with AI assistance (Claude and Perplexity AI, June 2025) 
and requires validation by qualified medical professionals before clinical application.

Key parameters requiring clinical validation:

1. Signal Processing:
   - Minimum samples: 256 for spectral analysis
   - Welch's method with nperseg=256 for PSD estimation

2. Amplitude Metrics:
   - RMS/MAV correlation with muscle activation level

3. Fatigue Analysis:
   - MPF/MDF decrease threshold for clinical fatigue (typically >10%)
   - Dimitrov's FI_nsm5 index clinical significance threshold

4. Contraction Detection:
   - Threshold factor: 20-30% of max amplitude
   - Minimum contraction duration (ms)
   - Smoothing window size (recommend ~50ms)
   - Merge threshold: 200ms for physiological contractions
   - Refractory period: currently 0ms (disabled)

5. MVC Analysis:
   - Threshold for "good" contractions

Detailed hypotheses for each parameter are documented within the relevant function docstrings.
"""

import numpy as np
from scipy.signal import welch
from typing import Dict, Optional

# --- Contraction Analysis ---

def analyze_contractions(
    signal: np.ndarray, 
    sampling_rate: int,
    threshold_factor: float,
    min_duration_ms: int,
    smoothing_window: int,
    mvc_amplitude_threshold: Optional[float] = None,
    contraction_duration_threshold_ms: Optional[float] = None,
    merge_threshold_ms: int = 200,
    refractory_period_ms: int = 0
) -> Dict:
    """
    Analyzes a signal to detect contractions and calculate related stats.
    If mvc_amplitude_threshold is provided, contractions are also flagged as 'good'.

    Biomedical Hypothesis: EMG signals during muscle contractions can exhibit oscillatory patterns
    due to motor unit firing synchronization, tremor, or mechanical artifacts. These oscillations
    may cause the signal to briefly drop below the detection threshold during what is physiologically
    a single contraction event. The merge_threshold_ms parameter addresses this by treating closely
    spaced contractions as a single physiological event, better reflecting the actual muscle activity.
    
    Clinical Assumptions:
    - Threshold factor: 20-30% of maximum amplitude is typical for contraction detection
      (Research suggests 20% of MVC or peak-to-peak amplitude as common clinical practice)
    - Minimum duration: Clinically significant contractions should exceed a minimum duration
      (Research suggests minimum durations in tens of milliseconds)
    - Smoothing window: ~50ms windows common in clinical practice
    - Merge threshold: 200ms default for physiologically related contractions
      (Based on typical motor unit firing rates and muscle response times)
    - Refractory period: 0ms default (disabled)
      (May need adjustment based on specific muscle physiology)
    - MVC threshold: External threshold represents clinically significant contraction level

    Args:
        signal: A numpy array of the EMG signal (can be raw, not rectified).
        sampling_rate: The sampling rate of the signal in Hz.
        threshold_factor: The percentage of the maximum signal amplitude to use
                        as the detection threshold (e.g., 0.3 for 30%).
        min_duration_ms: The minimum duration in milliseconds for a detected event
                         to be considered a contraction.
        smoothing_window: The size of the moving average window to smooth the signal.
        mvc_amplitude_threshold: Optional. If provided, contractions with max_amplitude
                                 at or above this value are considered 'good'.
                                 This can be channel-specific from session_mvc_values.
        contraction_duration_threshold_ms: Optional. If provided, contractions with duration
                                          at or above this value are considered to meet
                                          duration criteria for therapeutic compliance.
        merge_threshold_ms: The maximum time gap in milliseconds between two detected contractions
                           to consider them as a single physiological contraction. Default is 200ms,
                           which is based on typical motor unit firing rates and muscle response times.
        refractory_period_ms: The minimum time in milliseconds after a contraction ends before
                             a new contraction can be detected. Default is 0ms (disabled).

    Returns:
        A dictionary containing contraction statistics, a list of contractions (with 'is_good', 'meets_mvc', 
        'meets_duration' flags), and good_contraction_count (meeting both MVC and duration criteria).
    """
    base_return = {
        'contraction_count': 0, 'avg_duration_ms': 0.0, 'min_duration_ms': 0.0,
        'max_duration_ms': 0.0, 'total_time_under_tension_ms': 0.0,
        'avg_amplitude': 0.0, 'max_amplitude': 0.0,
        'contractions': [],
        'good_contraction_count': None, # Initialize - meets both MVC and duration
        'mvc_contraction_count': None, # Initialize - meets MVC only
        'duration_contraction_count': None, # Initialize - meets duration only
        'mvc_threshold_actual_value': mvc_amplitude_threshold, # Store what was used
        'duration_threshold_actual_value': contraction_duration_threshold_ms # Store what was used
    }

    if len(signal) < smoothing_window or smoothing_window <= 0:
        return base_return

    # 1. Rectify the signal
    rectified_signal = np.abs(signal)

    # 2. Smooth the signal with a moving average
    # Ensure smoothing_window is at least 1
    actual_smoothing_window = max(1, smoothing_window)
    smoothed_signal = np.convolve(rectified_signal, np.ones(actual_smoothing_window)/actual_smoothing_window, mode='same')

    # 3. Set threshold for burst detection
    max_smoothed_amplitude = np.max(smoothed_signal)
    if max_smoothed_amplitude < 1e-9: # effectively zero signal
        return base_return
        
    threshold = max_smoothed_amplitude * threshold_factor

    # 4. Detect activity above threshold
    above_threshold = smoothed_signal > threshold
    
    # Find start and end points of contractions
    diff = np.diff(above_threshold.astype(int))
    starts = np.where(diff == 1)[0] + 1 # diff is 1 sample shorter
    ends = np.where(diff == -1)[0] + 1   # diff is 1 sample shorter
    
    # Handle cases where activity starts or ends at the file boundaries
    if above_threshold[0]:
        starts = np.insert(starts, 0, 0)
    if above_threshold[-1] and (len(ends) == 0 or ends[-1] < len(above_threshold) - 1):
        ends = np.append(ends, len(above_threshold) - 1)
        
    # Ensure starts and ends pair up
    if len(starts) > len(ends):
        starts = starts[:len(ends)]
    elif len(ends) > len(starts):
        # This can happen if signal ends above threshold AND last diff was not -1.
        # Or if signal starts below threshold, goes up, and ends above threshold.
        # Example: [F,F,T,T,T] -> starts=[2], ends=[] -> should be ends=[4]
        # Example: [F,T,T,F,T,T] -> starts=[1,4], ends=[3] -> if ends[-1] < len(signal)-1 and signal[-1] is T
        # A simpler approach is to ensure starts < ends
        valid_pairs = []
        current_start_idx = 0
        while current_start_idx < len(starts):
            potential_ends = ends[ends > starts[current_start_idx]]
            if len(potential_ends) > 0:
                valid_pairs.append((starts[current_start_idx], potential_ends[0]))
                # Move to next start after this end
                current_start_idx = np.argmax(starts > potential_ends[0]) if np.any(starts > potential_ends[0]) else len(starts)
            else:
                break # No more valid ends for current or subsequent starts
        
        starts = np.array([p[0] for p in valid_pairs])
        ends = np.array([p[1] for p in valid_pairs])

    # 5. Filter contractions by minimum duration
    min_duration_samples = int((min_duration_ms / 1000) * sampling_rate)
    
    # Convert merge_threshold to samples
    merge_threshold_samples = int((merge_threshold_ms / 1000) * sampling_rate)
    refractory_period_samples = int((refractory_period_ms / 1000) * sampling_rate)
    
    # Filter by minimum duration and apply refractory period
    valid_contractions = []
    for i, (start_idx, end_idx) in enumerate(zip(starts, ends)):
        duration_samples = end_idx - start_idx
        if duration_samples >= min_duration_samples:
            # Apply refractory period if specified
            if refractory_period_samples > 0 and i > 0:
                last_end = valid_contractions[-1][1] if valid_contractions else 0
                if start_idx - last_end < refractory_period_samples:
                    continue  # Skip this contraction as it's within refractory period
            
            valid_contractions.append((start_idx, end_idx))
    
    # 6. Merge contractions that are close together
    if merge_threshold_samples > 0 and valid_contractions:
        merged_contractions = [valid_contractions[0]]
        for current_start, current_end in valid_contractions[1:]:
            prev_start, prev_end = merged_contractions[-1]
            
            # If current contraction starts soon after previous one ends, merge them
            if current_start - prev_end <= merge_threshold_samples:
                # Update the end time of the previous contraction to include this one
                merged_contractions[-1] = (prev_start, current_end)
            else:
                # Add as a new contraction
                merged_contractions.append((current_start, current_end))
        
        valid_contractions = merged_contractions
    
    # 7. Create contraction objects with detailed information
    contractions_list = []
    good_contraction_count = 0  # Meets both MVC and duration criteria
    mvc_contraction_count = 0   # Meets MVC criteria only
    duration_contraction_count = 0  # Meets duration criteria only

    for start_idx, end_idx in valid_contractions:
        segment = rectified_signal[start_idx:end_idx+1]  # Inclusive end for segment analysis
        if len(segment) == 0: 
            continue

        max_amp_in_segment = np.max(segment)
        duration_ms = ((end_idx - start_idx) / sampling_rate) * 1000
        
        # Enhanced quality assessment with separate criteria
        meets_mvc = False
        meets_duration = False
        
        if mvc_amplitude_threshold is not None:
            meets_mvc = max_amp_in_segment >= mvc_amplitude_threshold
            if meets_mvc:
                mvc_contraction_count += 1
                
        if contraction_duration_threshold_ms is not None:
            meets_duration = duration_ms >= contraction_duration_threshold_ms
            if meets_duration:
                duration_contraction_count += 1
        
        # 'is_good' represents meeting BOTH criteria (therapeutic compliance)
        is_good = None
        if mvc_amplitude_threshold is not None and contraction_duration_threshold_ms is not None:
            is_good = meets_mvc and meets_duration
            if is_good:
                good_contraction_count += 1
        elif mvc_amplitude_threshold is not None:
            # Backward compatibility: if only MVC threshold provided, use MVC only
            is_good = meets_mvc
            if is_good:
                good_contraction_count += 1
        
        contractions_list.append({
            'start_time_ms': (start_idx / sampling_rate) * 1000,
            'end_time_ms': (end_idx / sampling_rate) * 1000,  # end_idx is the last sample *in* the contraction
            'duration_ms': duration_ms,
            'mean_amplitude': float(np.mean(segment)),
            'max_amplitude': float(max_amp_in_segment),
            'is_good': is_good,
            'meets_mvc': meets_mvc if mvc_amplitude_threshold is not None else None,
            'meets_duration': meets_duration if contraction_duration_threshold_ms is not None else None
        })

    # 8. Calculate summary statistics
    if not contractions_list:
        base_return['good_contraction_count'] = 0 if mvc_amplitude_threshold is not None else None
        base_return['mvc_contraction_count'] = 0 if mvc_amplitude_threshold is not None else None
        base_return['duration_contraction_count'] = 0 if contraction_duration_threshold_ms is not None else None
        return base_return
        
    durations = [c['duration_ms'] for c in contractions_list]
    # Use mean_amplitude from *rectified original signal segment* for these summary stats
    mean_amplitudes_of_contractions = [c['mean_amplitude'] for c in contractions_list] 
    max_amplitudes_of_contractions = [c['max_amplitude'] for c in contractions_list]

    return {
        'contraction_count': len(contractions_list),
        'avg_duration_ms': float(np.mean(durations)) if durations else 0.0,
        'min_duration_ms': float(np.min(durations)) if durations else 0.0,
        'max_duration_ms': float(np.max(durations)) if durations else 0.0,
        'total_time_under_tension_ms': float(np.sum(durations)) if durations else 0.0,
        'avg_amplitude': float(np.mean(mean_amplitudes_of_contractions)) if mean_amplitudes_of_contractions else 0.0, # Avg of mean amplitudes
        'max_amplitude': float(np.max(max_amplitudes_of_contractions)) if max_amplitudes_of_contractions else 0.0, # Max of max amplitudes
        'contractions': contractions_list,
        'good_contraction_count': good_contraction_count if mvc_amplitude_threshold is not None else None,
        'mvc_contraction_count': mvc_contraction_count if mvc_amplitude_threshold is not None else None,
        'duration_contraction_count': duration_contraction_count if contraction_duration_threshold_ms is not None else None,
        'mvc_threshold_actual_value': mvc_amplitude_threshold,
        'duration_threshold_actual_value': contraction_duration_threshold_ms
    }


# --- Amplitude-based Metrics ---

def calculate_rms(signal: np.ndarray, sampling_rate: int) -> Dict[str, float]:
    """
    Calculates the Root Mean Square (RMS) of the signal.

    Biomedical Hypothesis: The amplitude of the surface EMG signal is, under
    non-fatiguing and isometric conditions, proportionally related to the force of
    muscle contraction. RMS is a measure of the signal's power and serves as a
    robust estimator of muscle activation intensity. An increase in RMS can
    indicate greater motor unit recruitment and thus improved muscle strength.
    
    Clinical Assumptions:
    - EMG amplitude linearly relates to muscle activation under non-fatiguing, isometric conditions
    - No normalization to MVC is performed within this function (must be done externally if needed)
    - Signal linearity assumption may not hold during dynamic contractions or fatigue

    Args:
        signal: A numpy array of the EMG signal.
        sampling_rate: The sampling rate of the signal in Hz (not used for this
                     calculation but kept for consistent function signatures).

    Returns:
        A dictionary containing the calculated 'rms' value.
    """
    if len(signal) == 0:
        return {"rms": 0.0}
    rms = np.sqrt(np.mean(signal**2))
    return {"rms": float(rms)}


def calculate_mav(signal: np.ndarray, sampling_rate: int) -> Dict[str, float]:
    """
    Calculates the Mean Absolute Value (MAV) of the signal.

    Biomedical Hypothesis: Similar to RMS, MAV quantifies the EMG signal's
    amplitude and correlates with contraction level. It's computationally simpler
    than RMS and less sensitive to large, sporadic spikes in the signal, making
    it a stable estimator of muscle activity.
    
    Clinical Assumptions:
    - MAV correlates with muscle contraction level
    - MAV is less sensitive to sporadic spikes compared to RMS
    - No normalization to MVC is performed (must be done externally)

    Args:
        signal: A numpy array of the EMG signal.
        sampling_rate: The sampling rate of the signal in Hz (not used for this
                     calculation but kept for consistent function signatures).

    Returns:
        A dictionary containing the calculated 'mav' value.
    """
    if len(signal) == 0:
        return {"mav": 0.0}
    mav = np.mean(np.abs(signal))
    return {"mav": float(mav)}


def moving_rms(signal: np.ndarray, window_size: int) -> np.ndarray:
    """
    Calculates the moving Root Mean Square (RMS) of a signal.
    This is often used to create a smooth envelope of the EMG signal.

    Args:
        signal (np.ndarray): The input signal, expected to be rectified (all positive).
        window_size (int): The size of the moving window in samples.

    Returns:
        np.ndarray: The moving RMS of the signal.
    """
    if window_size <= 0:
        return np.array([])
    
    # Ensure window size is not larger than signal length
    window_size = min(window_size, len(signal))
    
    squared_signal = np.power(signal, 2)
    window = np.ones(window_size) / float(window_size)
    
    # Use 'same' mode to ensure output is same length as input
    return np.sqrt(np.convolve(squared_signal, window, 'same'))


# --- Foundational Function for Spectral Analysis ---

def _calculate_psd(signal: np.ndarray, sampling_rate: int) -> tuple[np.ndarray, np.ndarray] | tuple[None, None]:
    """
    Calculates the Power Spectral Density (PSD) of a signal using Welch's method.

    Hypothesis: Welch's method is chosen as it provides a stable and reliable
    estimation of the power spectrum for non-stationary signals like EMG. It does
    this by averaging the periodograms of overlapping segments, reducing noise.
    
    Clinical Assumptions:
    - Minimum signal length of 256 samples is required for meaningful spectral analysis
    - Signal variation threshold (std > 1e-10) ensures sufficient signal quality
    - Default rectangular window is used (consider validating if Hanning/Hamming would be more appropriate)
    - 50% overlap between segments is implicit in implementation

    Args:
        signal: A numpy array of the EMG signal.
        sampling_rate: The sampling rate of the signal in Hz.

    Returns:
        A tuple containing:
        - Frequencies (ndarray).
        - Power Spectral Density (ndarray).
        Returns (None, None) if the signal is too short.
    """
    # Check if signal is long enough for spectral analysis
    # Welch method requires a minimum number of points
    min_samples_required = 256
    if len(signal) < min_samples_required:
        print(f"Warning: Signal too short for spectral analysis. Has {len(signal)} samples, needs {min_samples_required}.")
        return None, None
        
    # Check if signal has enough variation for meaningful spectral analysis
    if np.std(signal) < 1e-10:
        print(f"Warning: Signal has insufficient variation for spectral analysis. Standard deviation: {np.std(signal)}")
        return None, None
        
    try:
        # nperseg=256 is a common choice for EMG analysis
        freqs, psd = welch(signal, fs=sampling_rate, nperseg=min(256, len(signal)))
        return freqs, psd
    except Exception as e:
        print(f"Error in spectral analysis: {e}")
        return None, None

# --- Frequency-based Metrics (for Fatigue Analysis) ---

def calculate_mpf(signal: np.ndarray, sampling_rate: int) -> Dict[str, float]:
    """
    Calculates the Mean Power Frequency (MPF) of the signal.

    Biomedical Hypothesis: During sustained muscle contractions, metabolic byproducts
    accumulate, which slows the conduction velocity of muscle fibers. This physiological
    change manifests as a compression of the EMG power spectrum towards lower
    frequencies. MPF, the average frequency of the spectrum, will decrease as
    fatigue sets in, making it a classic indicator of muscle fatigue.
    
    Clinical Assumptions:
    - MPF decrease indicates muscle fatigue
    - Typical clinical threshold for fatigue: >10% decrease from baseline
    - Spectral compression reflects slowing of muscle fiber conduction velocity
    - Requires sufficient signal quality and length for reliable estimation

    Args:
        signal: A numpy array of the EMG signal.
        sampling_rate: The sampling rate of the signal in Hz.

    Returns:
        A dictionary containing the calculated 'mpf' value or None if calculation fails.
    """
    freqs, psd = _calculate_psd(signal, sampling_rate)
    if freqs is None or psd is None:
        return {"mpf": None}
    
    if np.sum(psd) == 0:
        return {"mpf": None}
    
    mpf = np.sum(freqs * psd) / np.sum(psd)
    return {"mpf": float(mpf)}


def calculate_mdf(signal: np.ndarray, sampling_rate: int) -> Dict[str, float]:
    """
    Calculates the Median Frequency (MDF) of the signal.

    Biomedical Hypothesis: MDF is the frequency that divides the power spectrum
    into two halves of equal power. Like MPF, MDF decreases with muscle fatigue
    due to the slowing of muscle fiber conduction velocity. It is often considered
    more robust than MPF because it is less affected by noise and random spikes
    in the power spectrum.
    
    Clinical Assumptions:
    - MDF decrease indicates muscle fatigue
    - MDF is more robust to noise than MPF
    - Typical clinical threshold for fatigue: >10% decrease from baseline
    - Requires sufficient signal quality for reliable estimation

    Args:
        signal: A numpy array of the EMG signal.
        sampling_rate: The sampling rate of the signal in Hz.

    Returns:
        A dictionary containing the calculated 'mdf' value or None if calculation fails.
    """
    freqs, psd = _calculate_psd(signal, sampling_rate)
    if freqs is None or psd is None:
        return {"mdf": None}

    if np.sum(psd) == 0:
        return {"mdf": None}

    total_power = np.sum(psd)
    cumulative_power = np.cumsum(psd)
    
    # Find the frequency at which cumulative power is 50% of total power
    median_freq_indices = np.where(cumulative_power >= total_power * 0.5)[0]
    if len(median_freq_indices) == 0:
        return {"mdf": None}
        
    median_freq_index = median_freq_indices[0]
    mdf = freqs[median_freq_index]
    
    return {"mdf": float(mdf)}


def calculate_fatigue_index_fi_nsm5(signal: np.ndarray, sampling_rate: int) -> Dict[str, float]:
    """
    Calculates Dimitrov's Fatigue Index (FI_nsm5) using normalized spectral moments.

    Biomedical Hypothesis: This index is a sensitive measure of muscle fatigue,
    designed to capture the compression and shape change of the power spectrum more
    effectively than mean or median frequency alone. It's the ratio of a low-frequency
    spectral moment (order -1) to a high-frequency one (order 5). As fatigue develops,
    power shifts to lower frequencies, increasing the numerator and decreasing the
    denominator, thus causing a significant rise in the index value.
    
    Clinical Assumptions:
    - FI_nsm5 is more sensitive to fatigue than MPF/MDF alone
    - Increasing values indicate increasing fatigue
    - No specific threshold for clinical significance is defined (needs validation)
    - Orders -1 and 5 are optimal for detecting spectral changes due to fatigue

    Reference: Dimitrov, G. V., et al. (2006). Med Sci Sports Exerc, 38(11), 1971-9.

    Args:
        signal: A numpy array of the EMG signal.
        sampling_rate: The sampling rate of the signal in Hz.

    Returns:
        A dictionary containing the calculated 'fatigue_index_fi_nsm5' or None if calculation fails.
    """
    freqs, psd = _calculate_psd(signal, sampling_rate)
    if freqs is None or psd is None:
        return {"fatigue_index_fi_nsm5": None}

    # Avoid division by zero for frequency; start from the second element
    valid_indices = freqs > 0
    freqs = freqs[valid_indices]
    psd = psd[valid_indices]

    if len(freqs) == 0 or np.sum(psd) == 0:
        return {"fatigue_index_fi_nsm5": None}
    
    # Calculate spectral moments M-1 and M5
    moment_neg_1 = np.sum((freqs**-1) * psd)
    moment_5 = np.sum((freqs**5) * psd)

    if moment_5 == 0:
        return {"fatigue_index_fi_nsm5": None}

    fi_nsm5 = moment_neg_1 / moment_5
    return {"fatigue_index_fi_nsm5": float(fi_nsm5)}



# --- Registry of Analysis Functions ---

# A registry of all available analysis functions
# This allows the processor to discover and use them easily.
ANALYSIS_FUNCTIONS = {
    "rms": calculate_rms,
    "mav": calculate_mav,
    "mpf": calculate_mpf,
    "mdf": calculate_mdf,
    "fatigue_index_fi_nsm5": calculate_fatigue_index_fi_nsm5,
} 
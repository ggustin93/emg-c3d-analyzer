"""
EMG Analysis Functions Module
=============================

This module contains a collection of functions for calculating various
EMG (Electromyography) metrics from signal data. Each function is designed
to be a standalone calculation that can be easily integrated into a larger
processing pipeline. The hypotheses and implementation choices for each metric are documented below.
"""

import numpy as np
from scipy.signal import welch
from typing import Dict

# --- Foundational Function for Spectral Analysis ---

def _calculate_psd(signal: np.ndarray, sampling_rate: int) -> tuple[np.ndarray, np.ndarray] | tuple[None, None]:
    """
    Calculates the Power Spectral Density (PSD) of a signal using Welch's method.

    Hypothesis: Welch's method is chosen as it provides a stable and reliable
    estimation of the power spectrum for non-stationary signals like EMG. It does
    this by averaging the periodograms of overlapping segments, reducing noise.

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

# --- Amplitude-based Metrics ---

def calculate_rms(signal: np.ndarray, sampling_rate: int) -> Dict[str, float]:
    """
    Calculates the Root Mean Square (RMS) of the signal.

    Biomedical Hypothesis: The amplitude of the surface EMG signal is, under
    non-fatiguing and isometric conditions, proportionally related to the force of
    muscle contraction. RMS is a measure of the signal's power and serves as a
    robust estimator of muscle activation intensity. An increase in RMS can
    indicate greater motor unit recruitment and thus improved muscle strength.

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

# --- Frequency-based Metrics (for Fatigue Analysis) ---

def calculate_mpf(signal: np.ndarray, sampling_rate: int) -> Dict[str, float]:
    """
    Calculates the Mean Power Frequency (MPF) of the signal.

    Biomedical Hypothesis: During sustained muscle contractions, metabolic byproducts
    accumulate, which slows the conduction velocity of muscle fibers. This physiological
    change manifests as a compression of the EMG power spectrum towards lower
    frequencies. MPF, the average frequency of the spectrum, will decrease as
    fatigue sets in, making it a classic indicator of muscle fatigue.

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

# --- Contraction Analysis ---

def analyze_contractions(
    signal: np.ndarray, 
    sampling_rate: int,
    threshold_factor: float,
    min_duration_ms: int,
    smoothing_window: int
) -> Dict:
    """
    Analyzes a signal to detect contractions and calculate related stats.

    Biomedical Hypothesis: A muscle 'contraction' is identified when the EMG
    signal's smoothed rectified amplitude surpasses a certain threshold for a
    minimum duration. The threshold is determined as a percentage of the peak
    amplitude of the smoothed, rectified signal across the entire recording. This
    method is effective for identifying significant bursts of activity relative
    to the maximum voluntary contraction level observed in the session.

    Args:
        signal: A numpy array of the EMG signal (can be raw, not rectified).
        sampling_rate: The sampling rate of the signal in Hz.
        threshold_factor: The percentage of the maximum signal amplitude to use
                        as the detection threshold (e.g., 0.3 for 30%).
        min_duration_ms: The minimum duration in milliseconds for a detected event
                         to be considered a contraction.
        smoothing_window: The size of the moving average window to smooth the signal.

    Returns:
        A dictionary containing contraction statistics.
    """
    if len(signal) < smoothing_window:
        return {
            'contraction_count': 0, 'avg_duration_ms': 0.0, 'min_duration_ms': 0.0,
            'max_duration_ms': 0.0, 'total_time_under_tension_ms': 0.0,
            'avg_amplitude': 0.0, 'max_amplitude': 0.0
        }

    # Note: Rectification is commented out as the input signal is expected to be
    # pre-processed (e.g., already rectified or an envelope). For raw EMG,
    # rectification would be a necessary first step.
    # rectified_signal = np.abs(signal)

    # 1. Smooth the signal (without rectifying first, to match reference)
    smoothed_signal = np.convolve(signal, np.ones(smoothing_window)/smoothing_window, mode='same')

    # 2. Determine threshold based on peak amplitude of the smoothed signal.
    signal_max = np.max(smoothed_signal)
    if signal_max <= 1e-10: # Check for near-zero signal to avoid issues
        return {
            'contraction_count': 0, 'avg_duration_ms': 0.0, 'min_duration_ms': 0.0,
            'max_duration_ms': 0.0, 'total_time_under_tension_ms': 0.0,
            'avg_amplitude': 0.0, 'max_amplitude': 0.0
        }
    
    activation_threshold = threshold_factor * signal_max
    
    # 4. Detect periods above the threshold
    is_active = smoothed_signal > activation_threshold
    min_samples = int((min_duration_ms / 1000) * sampling_rate)

    # Find start and end points of activations
    diff = np.diff(is_active.astype(int))
    starts = np.where(diff == 1)[0] + 1
    ends = np.where(diff == -1)[0] + 1

    # Handle cases where activation starts at the beginning or ends at the end
    if is_active[0]:
        starts = np.insert(starts, 0, 0)
    if is_active[-1]:
        ends = np.append(ends, len(is_active))

    if len(starts) == 0 or len(ends) == 0:
        return {
            'contraction_count': 0, 'avg_duration_ms': 0.0, 'min_duration_ms': 0.0,
            'max_duration_ms': 0.0, 'total_time_under_tension_ms': 0.0,
            'avg_amplitude': 0.0, 'max_amplitude': 0.0
        }

    # Ensure starts and ends align
    if ends[0] < starts[0]:
        ends = ends[1:]
    if len(starts) > len(ends):
        starts = starts[:len(ends)]

    # 5. Filter for valid contractions based on duration
    durations_samples = ends - starts
    valid_indices = np.where(durations_samples >= min_samples)[0]

    if len(valid_indices) == 0:
        return {
            'contraction_count': 0, 'avg_duration_ms': 0.0, 'min_duration_ms': 0.0,
            'max_duration_ms': 0.0, 'total_time_under_tension_ms': 0.0,
            'avg_amplitude': 0.0, 'max_amplitude': 0.0
        }

    valid_starts = starts[valid_indices]
    valid_ends = ends[valid_indices]
    valid_durations_samples = durations_samples[valid_indices]
    valid_durations_ms = (valid_durations_samples / sampling_rate) * 1000

    # 6. Calculate statistics from valid contractions
    if not valid_starts.any():
        return {
            'contraction_count': 0, 'avg_duration_ms': 0.0, 'min_duration_ms': 0.0,
            'max_duration_ms': 0.0, 'total_time_under_tension_ms': 0.0,
            'avg_amplitude': 0.0, 'max_amplitude': 0.0
        }
        
    contraction_peak_amplitudes = [np.max(smoothed_signal[s:e]) for s, e in zip(valid_starts, valid_ends)]
    
    contraction_count = len(valid_durations_ms)
    avg_duration_ms = np.mean(valid_durations_ms)
    min_duration_ms_val = np.min(valid_durations_ms)
    max_duration_ms_val = np.max(valid_durations_ms)
    total_time_under_tension_ms = np.sum(valid_durations_ms)
    avg_amplitude = np.mean(contraction_peak_amplitudes)
    max_amplitude = np.max(contraction_peak_amplitudes)

    return {
        'contraction_count': int(contraction_count),
        'avg_duration_ms': float(avg_duration_ms),
        'min_duration_ms': float(min_duration_ms_val),
        'max_duration_ms': float(max_duration_ms_val),
        'total_time_under_tension_ms': float(total_time_under_tension_ms),
        'avg_amplitude': float(avg_amplitude),
        'max_amplitude': float(max_amplitude)
    }

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
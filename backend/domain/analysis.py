"""
EMG Analysis Functions (Domain)
"""

import numpy as np
from scipy.signal import welch
from typing import Dict, Optional


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
    base_return = {
        'contraction_count': 0, 'avg_duration_ms': 0.0, 'min_duration_ms': 0.0,
        'max_duration_ms': 0.0, 'total_time_under_tension_ms': 0.0,
        'avg_amplitude': 0.0, 'max_amplitude': 0.0,
        'contractions': [],
        'good_contraction_count': 0,
        'mvc_contraction_count': 0,
        'duration_contraction_count': 0,
        'mvc_threshold_actual_value': mvc_amplitude_threshold,
        'duration_threshold_actual_value': contraction_duration_threshold_ms
    }

    if len(signal) < smoothing_window or smoothing_window <= 0:
        return base_return

    rectified_signal = np.abs(signal)

    actual_smoothing_window = max(1, smoothing_window)
    smoothed_signal = np.convolve(rectified_signal, np.ones(actual_smoothing_window)/actual_smoothing_window, mode='same')

    max_smoothed_amplitude = np.max(smoothed_signal)
    if max_smoothed_amplitude < 1e-9:
        return base_return

    threshold = max_smoothed_amplitude * threshold_factor
    above_threshold = smoothed_signal > threshold

    diff = np.diff(above_threshold.astype(int))
    starts = np.where(diff == 1)[0] + 1
    ends = np.where(diff == -1)[0] + 1

    if above_threshold[0]:
        starts = np.insert(starts, 0, 0)
    if above_threshold[-1] and (len(ends) == 0 or ends[-1] < len(above_threshold) - 1):
        ends = np.append(ends, len(above_threshold) - 1)

    if len(starts) > len(ends):
        starts = starts[:len(ends)]
    elif len(ends) > len(starts):
        valid_pairs = []
        current_start_idx = 0
        while current_start_idx < len(starts):
            potential_ends = ends[ends > starts[current_start_idx]]
            if len(potential_ends) > 0:
                valid_pairs.append((starts[current_start_idx], potential_ends[0]))
                current_start_idx = np.argmax(starts > potential_ends[0]) if np.any(starts > potential_ends[0]) else len(starts)
            else:
                break
        starts = np.array([p[0] for p in valid_pairs])
        ends = np.array([p[1] for p in valid_pairs])

    min_duration_samples = int((min_duration_ms / 1000) * sampling_rate)
    merge_threshold_samples = int((merge_threshold_ms / 1000) * sampling_rate)
    refractory_period_samples = int((refractory_period_ms / 1000) * sampling_rate)

    valid_contractions = []
    for i, (start_idx, end_idx) in enumerate(zip(starts, ends)):
        duration_samples = end_idx - start_idx
        if duration_samples >= min_duration_samples:
            if refractory_period_samples > 0 and i > 0:
                last_end = valid_contractions[-1][1] if valid_contractions else 0
                if start_idx - last_end < refractory_period_samples:
                    continue
            valid_contractions.append((start_idx, end_idx))

    if merge_threshold_samples > 0 and valid_contractions:
        merged_contractions = [valid_contractions[0]]
        for current_start, current_end in valid_contractions[1:]:
            prev_start, prev_end = merged_contractions[-1]
            if current_start - prev_end <= merge_threshold_samples:
                merged_contractions[-1] = (prev_start, current_end)
            else:
                merged_contractions.append((current_start, current_end))
        valid_contractions = merged_contractions

    contractions_list = []
    good_contraction_count = 0
    mvc_contraction_count = 0
    duration_contraction_count = 0

    for start_idx, end_idx in valid_contractions:
        segment = rectified_signal[start_idx:end_idx+1]
        if len(segment) == 0:
            continue
        max_amp_in_segment = np.max(segment)
        duration_ms = ((end_idx - start_idx) / sampling_rate) * 1000

        has_mvc_threshold = mvc_amplitude_threshold is not None
        has_duration_threshold = contraction_duration_threshold_ms is not None

        meets_mvc = bool(has_mvc_threshold and (max_amp_in_segment >= mvc_amplitude_threshold))
        meets_duration = bool(has_duration_threshold and (duration_ms >= contraction_duration_threshold_ms))

        if meets_mvc:
            mvc_contraction_count += 1
        if meets_duration:
            duration_contraction_count += 1

        if has_mvc_threshold and has_duration_threshold:
            is_good = meets_mvc and meets_duration
        elif has_mvc_threshold and not has_duration_threshold:
            is_good = meets_mvc
        elif has_duration_threshold and not has_mvc_threshold:
            is_good = meets_duration
        else:
            is_good = False

        if is_good:
            good_contraction_count += 1

        contractions_list.append({
            'start_time_ms': (start_idx / sampling_rate) * 1000,
            'end_time_ms': (end_idx / sampling_rate) * 1000,
            'duration_ms': duration_ms,
            'mean_amplitude': float(np.mean(segment)),
            'max_amplitude': float(max_amp_in_segment),
            'is_good': bool(is_good),
            'meets_mvc': bool(meets_mvc),
            'meets_duration': bool(meets_duration)
        })

    if not contractions_list:
        base_return['good_contraction_count'] = int(good_contraction_count)
        base_return['mvc_contraction_count'] = int(mvc_contraction_count)
        base_return['duration_contraction_count'] = int(duration_contraction_count)
        return base_return

    durations = [c['duration_ms'] for c in contractions_list]
    mean_amplitudes_of_contractions = [c['mean_amplitude'] for c in contractions_list]
    max_amplitudes_of_contractions = [c['max_amplitude'] for c in contractions_list]

    return {
        'contraction_count': len(contractions_list),
        'avg_duration_ms': float(np.mean(durations)) if durations else 0.0,
        'min_duration_ms': float(np.min(durations)) if durations else 0.0,
        'max_duration_ms': float(np.max(durations)) if durations else 0.0,
        'total_time_under_tension_ms': float(np.sum(durations)) if durations else 0.0,
        'avg_amplitude': float(np.mean(mean_amplitudes_of_contractions)) if mean_amplitudes_of_contractions else 0.0,
        'max_amplitude': float(np.max(max_amplitudes_of_contractions)) if max_amplitudes_of_contractions else 0.0,
        'contractions': contractions_list,
        'good_contraction_count': int(good_contraction_count),
        'mvc_contraction_count': int(mvc_contraction_count),
        'duration_contraction_count': int(duration_contraction_count),
        'mvc_threshold_actual_value': mvc_amplitude_threshold,
        'duration_threshold_actual_value': contraction_duration_threshold_ms
    }


def calculate_rms(signal: np.ndarray, sampling_rate: int) -> Dict[str, float]:
    if len(signal) == 0:
        return {"rms": 0.0}
    rms = np.sqrt(np.mean(signal**2))
    return {"rms": float(rms)}


def calculate_mav(signal: np.ndarray, sampling_rate: int) -> Dict[str, float]:
    if len(signal) == 0:
        return {"mav": 0.0}
    mav = np.mean(np.abs(signal))
    return {"mav": float(mav)}


def moving_rms(signal: np.ndarray, window_size: int) -> np.ndarray:
    if window_size <= 0:
        return np.array([])
    window_size = min(window_size, len(signal))
    squared_signal = np.power(signal, 2)
    window = np.ones(window_size) / float(window_size)
    return np.sqrt(np.convolve(squared_signal, window, 'same'))


def _calculate_psd(signal: np.ndarray, sampling_rate: int) -> tuple[np.ndarray, np.ndarray] | tuple[None, None]:
    min_samples_required = 256
    if len(signal) < min_samples_required:
        return None, None
    if np.std(signal) < 1e-10:
        return None, None
    try:
        freqs, psd = welch(signal, fs=sampling_rate, nperseg=min(256, len(signal)))
        return freqs, psd
    except Exception:
        return None, None


def calculate_mpf(signal: np.ndarray, sampling_rate: int) -> Dict[str, float]:
    freqs, psd = _calculate_psd(signal, sampling_rate)
    if freqs is None or psd is None:
        return {"mpf": None}
    if np.sum(psd) == 0:
        return {"mpf": None}
    mpf = np.sum(freqs * psd) / np.sum(psd)
    return {"mpf": float(mpf)}


def calculate_mdf(signal: np.ndarray, sampling_rate: int) -> Dict[str, float]:
    freqs, psd = _calculate_psd(signal, sampling_rate)
    if freqs is None or psd is None:
        return {"mdf": None}
    if np.sum(psd) == 0:
        return {"mdf": None}
    total_power = np.sum(psd)
    cumulative_power = np.cumsum(psd)
    median_freq_indices = np.where(cumulative_power >= total_power * 0.5)[0]
    if len(median_freq_indices) == 0:
        return {"mdf": None}
    median_freq_index = median_freq_indices[0]
    mdf = freqs[median_freq_index]
    return {"mdf": float(mdf)}


def calculate_fatigue_index_fi_nsm5(signal: np.ndarray, sampling_rate: int) -> Dict[str, float]:
    freqs, psd = _calculate_psd(signal, sampling_rate)
    if freqs is None or psd is None:
        return {"fatigue_index_fi_nsm5": None}
    valid_indices = freqs > 0
    freqs = freqs[valid_indices]
    psd = psd[valid_indices]
    if len(freqs) == 0 or np.sum(psd) == 0:
        return {"fatigue_index_fi_nsm5": None}
    moment_neg_1 = np.sum((freqs**-1) * psd)
    moment_5 = np.sum((freqs**5) * psd)
    if moment_5 == 0:
        return {"fatigue_index_fi_nsm5": None}
    fi_nsm5 = moment_neg_1 / moment_5
    return {"fatigue_index_fi_nsm5": float(fi_nsm5)}


ANALYSIS_FUNCTIONS = {
    "rms": calculate_rms,
    "mav": calculate_mav,
    "mpf": calculate_mpf,
    "mdf": calculate_mdf,
    "fatigue_index_fi_nsm5": calculate_fatigue_index_fi_nsm5,
}

__all__ = [
    'analyze_contractions',
    'calculate_rms',
    'calculate_mav',
    'calculate_mpf',
    'calculate_mdf',
    'calculate_fatigue_index_fi_nsm5',
    'moving_rms',
    'ANALYSIS_FUNCTIONS',
]


#!/usr/bin/env python3
"""
Direct test script for EMG analysis functions
============================================

This script directly tests the EMG analysis functions with sample data.
It is not a formal unit test but rather a debugging tool.
"""

import numpy as np
import sys
import os
from pathlib import Path
import matplotlib.pyplot as plt
from scipy import signal

# Get the absolute path to the project root directory
PROJECT_ROOT = str(Path(__file__).resolve().parents[2])

# Add the project root to the Python path
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from backend.emg_analysis import (
    calculate_rms,
    calculate_mav,
    calculate_mpf,
    calculate_mdf,
    calculate_fatigue_index_fi_nsm5,
    analyze_contractions
)

def main():
    """Run direct tests of EMG analysis functions."""
    # Generate sample EMG signal
    sampling_rate = 1000  # 1 kHz
    duration = 1.0  # 1 second
    t = np.linspace(0, duration, int(sampling_rate * duration))
    
    # Create synthetic EMG signal with multiple frequency components
    emg_signal = np.sin(2 * np.pi * 10 * t) + 0.5 * np.sin(2 * np.pi * 50 * t) + 0.25 * np.sin(2 * np.pi * 100 * t)
    
    # Add some noise
    noise = 0.1 * np.random.randn(len(t))
    emg_signal += noise
    
    # Create a signal with contractions
    contraction_signal = np.zeros_like(t)
    # Add three contractions
    contraction_signal[100:200] = 1.0  # 100ms contraction
    contraction_signal[400:600] = 2.0  # 200ms contraction
    contraction_signal[800:850] = 0.5  # 50ms contraction
    
    # Add noise to contraction signal
    contraction_signal += 0.05 * np.random.randn(len(t))
    
    # Calculate metrics for the EMG signal
    rms_result = calculate_rms(emg_signal, sampling_rate)
    mav_result = calculate_mav(emg_signal, sampling_rate)
    mpf_result = calculate_mpf(emg_signal, sampling_rate)
    mdf_result = calculate_mdf(emg_signal, sampling_rate)
    fatigue_result = calculate_fatigue_index_fi_nsm5(emg_signal, sampling_rate)
    
    # Analyze contractions
    contraction_result = analyze_contractions(
        contraction_signal, 
        sampling_rate,
        threshold_factor=0.3,
        min_duration_ms=50,
        smoothing_window=5
    )
    
    # Print results
    print("EMG Analysis Results:")
    print(f"RMS: {rms_result['rms']:.4f}")
    print(f"MAV: {mav_result['mav']:.4f}")
    print(f"MPF: {mpf_result['mpf']:.2f} Hz")
    print(f"MDF: {mdf_result['mdf']:.2f} Hz")
    print(f"Fatigue Index: {fatigue_result['fatigue_index_fi_nsm5']:.4f}")
    print(f"Contraction Count: {contraction_result['contraction_count']}")
    
    # Plot signals and contractions
    plt.figure(figsize=(12, 8))
    
    # Plot EMG signal
    plt.subplot(2, 1, 1)
    plt.plot(t, emg_signal)
    plt.title("Synthetic EMG Signal")
    plt.xlabel("Time (s)")
    plt.ylabel("Amplitude")
    
    # Plot contraction signal
    plt.subplot(2, 1, 2)
    plt.plot(t, contraction_signal)
    
    # Highlight detected contractions
    for contraction in contraction_result['contractions']:
        start_idx = contraction['start_idx']
        end_idx = contraction['end_idx']
        plt.axvspan(t[start_idx], t[end_idx], alpha=0.3, color='green')
    
    plt.title(f"Contraction Signal (Detected: {contraction_result['contraction_count']})")
    plt.xlabel("Time (s)")
    plt.ylabel("Amplitude")
    
    plt.tight_layout()
    
    # Save the plot
    output_dir = os.path.join(PROJECT_ROOT, "backend", "tests", "output")
    os.makedirs(output_dir, exist_ok=True)
    plt.savefig(os.path.join(output_dir, "emg_analysis_test.png"))
    
    print(f"Plot saved to {os.path.join(output_dir, 'emg_analysis_test.png')}")

if __name__ == "__main__":
    main() 
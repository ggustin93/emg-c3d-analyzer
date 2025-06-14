"""
Standalone test script for EMG analysis functions
================================================

This script tests the EMG analysis functions with sample data to verify they work correctly.
"""

import numpy as np
import json
import sys
import os

# Add the parent directory to the path so we can import the backend modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.emg_analysis import (
    calculate_rms,
    calculate_mav,
    calculate_mpf,
    calculate_mdf,
    calculate_fatigue_index_fi_nsm5,
    analyze_contractions
)

def test_functions_with_sample_data():
    """Test all EMG analysis functions with sample data."""
    # Create sample data
    # 1. Good data - should work for all functions
    sampling_rate = 1000  # 1kHz
    duration = 1.0  # 1 second
    t = np.linspace(0, duration, int(sampling_rate * duration))
    # Create a signal with multiple frequency components
    good_signal = np.sin(2 * np.pi * 10 * t) + 0.5 * np.sin(2 * np.pi * 50 * t) + 0.25 * np.sin(2 * np.pi * 100 * t)
    
    # 2. Short data - should fail spectral analysis
    short_signal = np.sin(2 * np.pi * 10 * t[:100])  # Only 100 samples
    
    # 3. Constant data - should fail spectral analysis
    constant_signal = np.ones(1000)
    
    # Test with good data
    print("\n=== Testing with good data (1000 samples) ===")
    results_good = {
        "rms": calculate_rms(good_signal, sampling_rate),
        "mav": calculate_mav(good_signal, sampling_rate),
        "mpf": calculate_mpf(good_signal, sampling_rate),
        "mdf": calculate_mdf(good_signal, sampling_rate),
        "fatigue_index": calculate_fatigue_index_fi_nsm5(good_signal, sampling_rate),
        "contractions": analyze_contractions(good_signal, sampling_rate, 0.5, 50, 25)
    }
    print(json.dumps(results_good, indent=2))
    
    # Test with short data
    print("\n=== Testing with short data (100 samples) ===")
    results_short = {
        "rms": calculate_rms(short_signal, sampling_rate),
        "mav": calculate_mav(short_signal, sampling_rate),
        "mpf": calculate_mpf(short_signal, sampling_rate),
        "mdf": calculate_mdf(short_signal, sampling_rate),
        "fatigue_index": calculate_fatigue_index_fi_nsm5(short_signal, sampling_rate)
    }
    print(json.dumps(results_short, indent=2))
    
    # Test with constant data
    print("\n=== Testing with constant data (1000 samples of value 1) ===")
    results_constant = {
        "rms": calculate_rms(constant_signal, sampling_rate),
        "mav": calculate_mav(constant_signal, sampling_rate),
        "mpf": calculate_mpf(constant_signal, sampling_rate),
        "mdf": calculate_mdf(constant_signal, sampling_rate),
        "fatigue_index": calculate_fatigue_index_fi_nsm5(constant_signal, sampling_rate)
    }
    print(json.dumps(results_constant, indent=2))

if __name__ == "__main__":
    test_functions_with_sample_data() 
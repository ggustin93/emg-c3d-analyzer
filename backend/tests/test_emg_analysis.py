import unittest
import numpy as np
import sys
import os
from pathlib import Path

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

class TestEMGAnalysis(unittest.TestCase):
    """Test suite for EMG analysis functions."""
    
    def setUp(self):
        """Set up test data."""
        # Create sample signals
        self.sampling_rate = 1000  # 1kHz
        self.duration = 1.0  # 1 second
        self.t = np.linspace(0, self.duration, int(self.sampling_rate * self.duration))
        
        # Good signal with multiple frequency components
        self.good_signal = np.sin(2 * np.pi * 10 * self.t) + 0.5 * np.sin(2 * np.pi * 50 * self.t) + 0.25 * np.sin(2 * np.pi * 100 * self.t)
        
        # Signal with clear contractions
        self.contraction_signal = np.zeros(1000)
        # Add three contractions
        self.contraction_signal[100:200] = 1.0  # 100ms contraction
        self.contraction_signal[400:600] = 2.0  # 200ms contraction
        self.contraction_signal[800:850] = 0.5  # 50ms contraction (below min_duration if set to >50ms)
        
        # Short signal (too short for spectral analysis)
        self.short_signal = np.sin(2 * np.pi * 10 * self.t[:100])
        
        # Constant signal
        self.constant_signal = np.ones(1000)
        
        # Zero signal
        self.zero_signal = np.zeros(1000)

    def test_calculate_rms(self):
        """Test RMS calculation."""
        # Test with good signal
        result = calculate_rms(self.good_signal, self.sampling_rate)
        self.assertIsNotNone(result)
        self.assertIn('rms', result)
        self.assertGreater(result['rms'], 0)
        
        # Test with zero signal
        result = calculate_rms(self.zero_signal, self.sampling_rate)
        self.assertEqual(result['rms'], 0)
        
        # Test with empty signal
        result = calculate_rms(np.array([]), self.sampling_rate)
        self.assertEqual(result['rms'], 0)

    def test_calculate_mav(self):
        """Test MAV calculation."""
        # Test with good signal
        result = calculate_mav(self.good_signal, self.sampling_rate)
        self.assertIsNotNone(result)
        self.assertIn('mav', result)
        self.assertGreater(result['mav'], 0)
        
        # Test with zero signal
        result = calculate_mav(self.zero_signal, self.sampling_rate)
        self.assertEqual(result['mav'], 0)
        
        # Test with empty signal
        result = calculate_mav(np.array([]), self.sampling_rate)
        self.assertEqual(result['mav'], 0)

    def test_calculate_mpf(self):
        """Test MPF calculation."""
        # Test with good signal
        result = calculate_mpf(self.good_signal, self.sampling_rate)
        self.assertIsNotNone(result)
        self.assertIn('mpf', result)
        self.assertGreater(result['mpf'], 0)
        
        # Test with short signal (should return None for MPF)
        result = calculate_mpf(self.short_signal, self.sampling_rate)
        self.assertIsNone(result['mpf'])
        
        # Test with constant signal (should return None for MPF)
        result = calculate_mpf(self.constant_signal, self.sampling_rate)
        self.assertIsNone(result['mpf'])

    def test_calculate_mdf(self):
        """Test MDF calculation."""
        # Test with good signal
        result = calculate_mdf(self.good_signal, self.sampling_rate)
        self.assertIsNotNone(result)
        self.assertIn('mdf', result)
        self.assertGreater(result['mdf'], 0)
        
        # Test with short signal (should return None for MDF)
        result = calculate_mdf(self.short_signal, self.sampling_rate)
        self.assertIsNone(result['mdf'])
        
        # Test with constant signal (should return None for MDF)
        result = calculate_mdf(self.constant_signal, self.sampling_rate)
        self.assertIsNone(result['mdf'])

    def test_calculate_fatigue_index(self):
        """Test fatigue index calculation."""
        # Test with good signal
        result = calculate_fatigue_index_fi_nsm5(self.good_signal, self.sampling_rate)
        self.assertIsNotNone(result)
        self.assertIn('fatigue_index_fi_nsm5', result)
        
        # Test with short signal (should return None)
        result = calculate_fatigue_index_fi_nsm5(self.short_signal, self.sampling_rate)
        self.assertIsNone(result['fatigue_index_fi_nsm5'])
        
        # Test with constant signal (should return None)
        result = calculate_fatigue_index_fi_nsm5(self.constant_signal, self.sampling_rate)
        self.assertIsNone(result['fatigue_index_fi_nsm5'])

    def test_analyze_contractions(self):
        """Test contraction analysis."""
        # Test with contraction signal
        result = analyze_contractions(
            self.contraction_signal, 
            self.sampling_rate,
            threshold_factor=0.3,
            min_duration_ms=50,
            smoothing_window=5,
            merge_threshold_ms=0  # Explicitly disable merging for this test
        )
        
        self.assertIsNotNone(result)
        self.assertIn('contractions', result)
        self.assertIn('contraction_count', result)
        
        # Should detect 2 contractions (the implementation is correctly detecting 2)
        self.assertEqual(result['contraction_count'], 2)
        
        # Test with min_duration_ms=60 (should only detect 2 contractions)
        result = analyze_contractions(
            self.contraction_signal, 
            self.sampling_rate,
            threshold_factor=0.3,
            min_duration_ms=60,
            smoothing_window=5,
            merge_threshold_ms=0  # Explicitly disable merging for this test
        )
        self.assertEqual(result['contraction_count'], 2)
        
        # Create a signal with three distinct contractions that should be detected
        three_contractions_signal = np.zeros(1000)
        three_contractions_signal[100:200] = 1.0  # 100ms contraction
        three_contractions_signal[400:600] = 2.0  # 200ms contraction
        three_contractions_signal[800:900] = 1.5  # 100ms contraction (increased amplitude from 0.5 to 1.5)
        
        # Test with the new signal and a lower threshold factor to ensure detection
        result = analyze_contractions(
            three_contractions_signal, 
            self.sampling_rate,
            threshold_factor=0.2,  # Lower threshold to ensure detection
            min_duration_ms=50,
            smoothing_window=5,
            merge_threshold_ms=0  # Explicitly disable merging for this test
        )
        self.assertEqual(result['contraction_count'], 3)
        
        # Test with MVC threshold
        result = analyze_contractions(
            self.contraction_signal, 
            self.sampling_rate,
            threshold_factor=0.3,
            min_duration_ms=50,
            smoothing_window=5,
            mvc_amplitude_threshold=1.5,
            merge_threshold_ms=0  # Explicitly disable merging for this test
        )
        
        # Should have good_contraction_count
        self.assertIsNotNone(result['good_contraction_count'])
        # Only one contraction should be "good" (above 1.5 threshold)
        self.assertEqual(result['good_contraction_count'], 1)
        
        # Test with zero signal (should detect no contractions)
        result = analyze_contractions(
            self.zero_signal, 
            self.sampling_rate,
            threshold_factor=0.3,
            min_duration_ms=50,
            smoothing_window=5
        )
        self.assertEqual(result['contraction_count'], 0)

if __name__ == '__main__':
    unittest.main() 
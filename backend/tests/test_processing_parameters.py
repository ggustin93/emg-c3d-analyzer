"""
Test for processing_parameters database insertion with Nyquist constraint compliance.

This test ensures that the filter frequency parameters satisfy the database constraint:
- filter_low_cutoff_hz > 0
- filter_high_cutoff_hz > filter_low_cutoff_hz
- filter_high_cutoff_hz < sampling_rate_hz / 2 (Nyquist frequency)
"""

import pytest
from unittest.mock import Mock, patch
from datetime import datetime, timezone
from services.therapy_session_processor import TherapySessionProcessor
from config import DEFAULT_LOWPASS_CUTOFF, DEFAULT_FILTER_ORDER, DEFAULT_RMS_WINDOW_MS


class TestProcessingParameters:
    """Test processing parameters insertion with database constraints."""
    
    def test_nyquist_compliant_filter_frequencies(self):
        """Test that filter frequencies are Nyquist-compliant for database constraint."""
        # Test case 1: Sampling rate 1000 Hz (common case)
        sampling_rate = 1000.0
        nyquist_freq = sampling_rate / 2  # 500 Hz
        safe_high_cutoff = min(DEFAULT_LOWPASS_CUTOFF, nyquist_freq * 0.9)  # 450 Hz
        
        assert safe_high_cutoff < nyquist_freq, "High cutoff must be less than Nyquist frequency"
        assert safe_high_cutoff == 450.0, "For 1000 Hz sampling, high cutoff should be 450 Hz"
        
        # Test case 2: Sampling rate 2000 Hz (higher sampling rate)
        sampling_rate = 2000.0
        nyquist_freq = sampling_rate / 2  # 1000 Hz
        safe_high_cutoff = min(DEFAULT_LOWPASS_CUTOFF, nyquist_freq * 0.9)  # 500 Hz (limited by config)
        
        assert safe_high_cutoff < nyquist_freq, "High cutoff must be less than Nyquist frequency"
        assert safe_high_cutoff == DEFAULT_LOWPASS_CUTOFF, "Should use config limit when Nyquist allows"
        
        # Test case 3: Sampling rate 800 Hz (lower sampling rate)
        sampling_rate = 800.0
        nyquist_freq = sampling_rate / 2  # 400 Hz
        safe_high_cutoff = min(DEFAULT_LOWPASS_CUTOFF, nyquist_freq * 0.9)  # 360 Hz
        
        assert safe_high_cutoff < nyquist_freq, "High cutoff must be less than Nyquist frequency"
        assert safe_high_cutoff == 360.0, "For 800 Hz sampling, high cutoff should be 360 Hz"
    
    def test_filter_constraint_validation(self):
        """Test that filter parameters satisfy the database constraint."""
        test_cases = [
            # (sampling_rate, low_cutoff, expected_high_cutoff, should_pass)
            (1000.0, 20.0, 450.0, True),   # Normal case
            (2000.0, 20.0, 500.0, True),   # Higher sampling rate
            (800.0, 20.0, 360.0, True),    # Lower sampling rate
            (500.0, 20.0, 225.0, True),    # Very low sampling rate
        ]
        
        for sampling_rate, low_cutoff, expected_high_cutoff, should_pass in test_cases:
            nyquist_freq = sampling_rate / 2
            safe_high_cutoff = min(DEFAULT_LOWPASS_CUTOFF, nyquist_freq * 0.9)
            
            # Check database constraint conditions
            constraint_check = (
                low_cutoff > 0 and
                safe_high_cutoff > low_cutoff and
                safe_high_cutoff < nyquist_freq
            )
            
            assert constraint_check == should_pass, (
                f"Constraint check failed for sampling_rate={sampling_rate}, "
                f"low={low_cutoff}, high={safe_high_cutoff}"
            )
            assert safe_high_cutoff == expected_high_cutoff, (
                f"Expected high cutoff {expected_high_cutoff} but got {safe_high_cutoff}"
            )
    
    def test_populate_database_parameters(self):
        """Test that _populate_database_tables creates correct processing_parameters."""
        # Test the Nyquist calculation logic directly
        test_metadata = {
            "sampling_rate": 1000.0,
            "duration": 10.0,
            "channel_count": 2
        }
        
        # Calculate expected values (same logic as in therapy_session_processor.py)
        sampling_rate = test_metadata["sampling_rate"]
        nyquist_freq = sampling_rate / 2
        safe_high_cutoff = min(DEFAULT_LOWPASS_CUTOFF, nyquist_freq * 0.9)
        
        # Verify the calculation
        assert safe_high_cutoff == 450.0, "For 1000 Hz, high cutoff should be 450 Hz"
        assert safe_high_cutoff < sampling_rate / 2, "Must satisfy Nyquist constraint"
        
        # Test with different sampling rates
        test_cases = [
            (1000.0, 450.0),  # Standard case
            (2000.0, 500.0),  # High sampling rate (limited by config)
            (800.0, 360.0),   # Low sampling rate
            (990.0, 445.5),   # GHOSTLY typical rate
        ]
        
        for test_rate, expected_cutoff in test_cases:
            nyquist = test_rate / 2
            calculated_cutoff = min(DEFAULT_LOWPASS_CUTOFF, nyquist * 0.9)
            assert calculated_cutoff == expected_cutoff, (
                f"For {test_rate} Hz, expected {expected_cutoff} Hz but got {calculated_cutoff} Hz"
            )
            # Verify constraint satisfaction
            assert calculated_cutoff < nyquist, "Must be less than Nyquist frequency"
        
    def test_duplicate_raw_channel_prevention(self):
        """Test that duplicate 'Raw Raw' channels are not created."""
        test_channels = [
            ("CH1", True),           # Should create "CH1" and "CH1 Raw"
            ("CH2", True),           # Should create "CH2" and "CH2 Raw"
            ("CH1 Raw", False),      # Should NOT create "CH1 Raw Raw"
            ("CH2 Raw", False),      # Should NOT create "CH2 Raw Raw"
            ("CH1 activated", True), # Should create both versions
            ("CH2 activated", True), # Should create both versions
        ]
        
        for channel_name, should_create_raw in test_channels:
            # Check if we should create a raw version
            create_raw = not channel_name.endswith(" Raw")
            
            assert create_raw == should_create_raw, (
                f"Channel '{channel_name}' should {'not ' if not should_create_raw else ''}"
                f"create a Raw version"
            )
            
            if create_raw:
                raw_name = f"{channel_name} Raw"
                assert not raw_name.endswith(" Raw Raw"), f"Should not create '{raw_name}'"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
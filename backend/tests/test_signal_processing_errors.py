"""Test EMG signal processing validation failure scenarios.

This test file validates the enhanced error handling for EMG signal processing,
ensuring that validation failures provide meaningful error messages with clinical context.
"""

import pytest
import numpy as np
from unittest.mock import Mock

from emg.signal_processing import validate_signal_quality, ProcessingParameters, preprocess_emg_signal


class TestEMGValidationErrors:
    """Test EMG validation error scenarios with enhanced messaging."""
    
    def test_signal_too_short_error_includes_clinical_context(self):
        """Test that signal too short error includes clinical requirements info.
        
        EXPECTED TO FAIL: Current implementation doesn't include clinical context in error message.
        """
        # Create a short signal (30 samples, like the problematic C3D file)
        short_signal = np.random.random(30)
        sampling_rate = 990  # Hz, from the problematic file
        
        is_valid, error_message = validate_signal_quality(short_signal, sampling_rate)
        
        assert not is_valid, "Signal should be invalid due to insufficient samples"
        
        # ENHANCED ERROR MESSAGE REQUIREMENTS (currently will fail):
        expected_components = [
            "Signal too short",  # Current message
            "30 samples",  # Actual sample count
            "1000 required",  # Required samples
            "0.03 seconds",  # Duration calculation (30/990)
            "10 seconds to 10 minutes",  # Clinical requirements
            "EMG analysis requires"  # Clinical context
        ]
        
        for component in expected_components:
            assert component in error_message, f"Error message should include '{component}' for clinical context"
    
    def test_signal_duration_calculation_in_error_message(self):
        """Test that error message includes actual signal duration calculation.
        
        EXPECTED TO FAIL: Current implementation doesn't calculate or show duration.
        """
        short_signal = np.random.random(50)
        sampling_rate = 1000  # Hz
        expected_duration = 50 / 1000  # 0.05 seconds
        
        is_valid, error_message = validate_signal_quality(short_signal, sampling_rate)
        
        assert not is_valid
        assert "0.05 seconds" in error_message, "Error should include calculated duration"
        assert "50 samples" in error_message, "Error should include actual sample count"
    
    def test_preprocessing_returns_structured_error_on_validation_failure(self):
        """Test that preprocessing returns structured error data when validation fails.
        
        EXPECTED TO FAIL: Current implementation may not return structured error with clinical context.
        """
        short_signal = np.random.random(30)
        sampling_rate = 990
        
        result = preprocess_emg_signal(short_signal, sampling_rate)
        
        # Should return structured error information
        assert result["processed_signal"] is None
        assert result["quality_metrics"]["valid"] is False
        
        error_message = result["quality_metrics"]["message"]
        
        # Enhanced error message should include clinical context
        clinical_indicators = [
            "EMG analysis requires",
            "10 seconds to 10 minutes",
            "0.03 seconds",  # Actual duration (30/990)
            "clinical requirements"
        ]
        
        for indicator in clinical_indicators:
            assert indicator in error_message, f"Structured error should include '{indicator}'"
    
    def test_minimum_duration_constants_are_documented(self):
        """Test that minimum duration requirements are properly documented in constants.
        
        EXPECTED TO FAIL: Current implementation doesn't have clinical duration constants.
        """
        # These constants should be added to ProcessingParameters
        assert hasattr(ProcessingParameters, 'MIN_CLINICAL_DURATION_SECONDS'), "Should define minimum clinical duration"
        assert hasattr(ProcessingParameters, 'MAX_CLINICAL_DURATION_SECONDS'), "Should define maximum clinical duration"
        
        # Expected values based on clinical requirements
        assert ProcessingParameters.MIN_CLINICAL_DURATION_SECONDS == 10, "Minimum should be 10 seconds"
        assert ProcessingParameters.MAX_CLINICAL_DURATION_SECONDS == 600, "Maximum should be 10 minutes (600 seconds)"
        
    def test_error_message_includes_sampling_rate_context(self):
        """Test that error messages include sampling rate information for better understanding.
        
        EXPECTED TO FAIL: Current error messages don't include sampling rate context.
        """
        short_signal = np.random.random(100)
        sampling_rate = 2000  # High sampling rate
        
        is_valid, error_message = validate_signal_quality(short_signal, sampling_rate)
        
        assert not is_valid
        assert "2000Hz" in error_message or "2000 Hz" in error_message, "Error should include sampling rate"
        assert "0.05 seconds" in error_message, "Error should show calculated duration (100/2000)"


class TestClinicalContextValidation:
    """Test clinical context validation for EMG signals."""
    
    def test_signal_too_long_error_with_clinical_context(self):
        """Test that excessively long signals are handled with clinical guidance.
        
        EXPECTED TO FAIL: Current implementation doesn't validate maximum duration.
        """
        # Create a very long signal (15 minutes at 1000Hz = 900,000 samples)
        long_signal = np.random.random(900000)
        sampling_rate = 1000
        
        is_valid, error_message = validate_signal_quality(long_signal, sampling_rate)
        
        # Should be invalid due to excessive length (>10 minutes clinical max)
        assert not is_valid, "Signal should be invalid due to excessive duration"
        
        clinical_components = [
            "Signal too long",
            "15.0 minutes",  # Calculated duration
            "10 minutes maximum",  # Clinical limit
            "clinical analysis"
        ]
        
        for component in clinical_components:
            assert component in error_message, f"Error should include '{component}'"
    
    def test_ideal_signal_duration_validation_passes(self):
        """Test that signals within clinical range (10s-10min) pass validation."""
        # Create a signal of ideal clinical duration (60 seconds)
        ideal_signal = np.random.random(60000)  # 60 seconds at 1000Hz
        sampling_rate = 1000
        
        is_valid, error_message = validate_signal_quality(ideal_signal, sampling_rate)
        
        assert is_valid, f"60-second signal should be valid for clinical analysis, got: {error_message}"
        assert error_message == "Signal quality acceptable", "Valid signals should have standard success message"
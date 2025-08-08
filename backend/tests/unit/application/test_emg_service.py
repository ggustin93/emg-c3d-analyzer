"""
Unit tests for EMG Analysis Service.

Tests the EMG service functionality in isolation.
"""

import pytest
import numpy as np
from ....application.services.emg_service import EMGAnalysisService


@pytest.mark.unit
class TestEMGAnalysisService:
    """Test cases for EMG Analysis Service."""
    
    def test_service_initialization(self, emg_service):
        """Test service initializes correctly."""
        assert emg_service is not None
        assert emg_service.processing_params is not None
    
    def test_generate_time_axis(self, emg_service):
        """Test time axis generation."""
        data_length = 1000
        sampling_rate = 500.0
        
        time_axis = emg_service.generate_time_axis(data_length, sampling_rate)
        
        assert len(time_axis) == data_length
        assert time_axis[0] == 0.0
        assert abs(time_axis[-1] - (data_length - 1) / sampling_rate) < 1e-10
    
    def test_analyze_channel_data(self, emg_service, sample_emg_data):
        """Test channel data analysis."""
        channel_data = sample_emg_data['CH1']
        channel_name = 'CH1'
        sampling_rate = sample_emg_data['sampling_rate']
        
        result = emg_service.analyze_channel_data(
            channel_data, 
            channel_name, 
            sampling_rate
        )
        
        # Check result structure
        assert 'analytics' in result
        assert 'contractions' in result
        assert 'processed_signal' in result
        assert 'processing_metadata' in result
        
        # Check analytics contains expected metrics
        analytics = result['analytics']
        expected_metrics = ['rms', 'mav', 'mpf', 'mdf', 'fi_nsm5']
        for metric in expected_metrics:
            assert metric in analytics
    
    def test_calculate_mvc_values(self, emg_service, sample_emg_data):
        """Test MVC value calculation."""
        emg_data = {
            'CH1': sample_emg_data['CH1'],
            'CH2': sample_emg_data['CH2']
        }
        
        mvc_values = emg_service.calculate_mvc_values(emg_data)
        
        assert 'CH1' in mvc_values
        assert 'CH2' in mvc_values
        assert isinstance(mvc_values['CH1'], float)
        assert isinstance(mvc_values['CH2'], float)
        assert mvc_values['CH1'] > 0
        assert mvc_values['CH2'] > 0
    
    def test_calculate_mvc_values_with_existing(
        self, 
        emg_service, 
        sample_emg_data, 
        sample_session_parameters
    ):
        """Test MVC calculation with existing values."""
        emg_data = {
            'CH1': sample_emg_data['CH1'],
            'CH2': sample_emg_data['CH2']
        }
        
        mvc_values = emg_service.calculate_mvc_values(
            emg_data, 
            sample_session_parameters
        )
        
        # Should use existing values from session parameters
        expected_mvc = sample_session_parameters.session_mvc_values
        assert mvc_values['CH1'] == expected_mvc['CH1']
        assert mvc_values['CH2'] == expected_mvc['CH2']
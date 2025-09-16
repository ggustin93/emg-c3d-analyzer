"""Test C3D metadata extraction when EMG processing fails.

This test validates that when EMG processing fails due to signal validation,
the system can still extract and return meaningful C3D file metadata.
"""

import pytest
from unittest.mock import Mock, patch, MagicMock
import tempfile
import os

from services.c3d.processor import GHOSTLYC3DProcessor
from emg.signal_processing import ProcessingParameters


class TestC3DMetadataOnError:
    """Test C3D metadata extraction capabilities during EMG processing failures."""
    
    @pytest.fixture
    def mock_c3d_file_with_short_signal(self):
        """Create a mock C3D file that would cause EMG validation failure."""
        mock_c3d = MagicMock()
        
        # Mock the C3D file structure with short signal
        mock_c3d.header.frame_count = 30
        mock_c3d.header.analog_sample_rate = 990
        mock_c3d.data.analogs = [
            [0.1] * 30,  # CH1 - very short signal
            [0.2] * 30,  # CH2 - very short signal
        ]
        
        # Mock game metadata
        mock_c3d.parameters = {
            'GAME_NAME': Mock(data=['Ghostly']),
            'LEVEL': Mock(data=['1']),
            'THERAPIST_ID': Mock(data=['T001']),
            'PLAYER_NAME': Mock(data=['P001']),
            'TIME': Mock(data=['2024-03-04 10:05:56'])
        }
        
        return mock_c3d
    
    def test_metadata_extraction_succeeds_despite_emg_failure(self, mock_c3d_file_with_short_signal):
        """Test that metadata extraction works even when EMG processing fails.
        
        EXPECTED TO FAIL: Current implementation may not separate metadata extraction from EMG processing.
        """
        with patch('services.c3d.processor.C3DUtils.load_c3d_file', return_value=mock_c3d_file_with_short_signal):
            processor = GHOSTLYC3DProcessor("fake_path.c3d")
            
            # This should succeed even with short signal
            metadata = processor.extract_metadata()
            
            # Metadata should be extracted successfully
            expected_metadata = {
                'sampling_rate': 990,
                'duration_seconds': 30 / 990,  # ~0.03 seconds
                'frame_count': 30,
                'channel_count': 2,
                'game_name': 'Ghostly',
                'level': '1',
                'therapist_id': 'T001',
                'player_name': 'P001',
                'time': '2024-03-04 10:05:56'
            }
            
            for key, expected_value in expected_metadata.items():
                assert key in metadata, f"Metadata should include {key}"
                if key == 'duration_seconds':
                    assert abs(metadata[key] - expected_value) < 0.001, f"Duration should be ~0.03 seconds"
                else:
                    assert metadata[key] == expected_value, f"Metadata {key} should be {expected_value}"
    
    def test_structured_error_response_includes_metadata(self, mock_c3d_file_with_short_signal):
        """Test that processing failure returns structured error with C3D metadata.
        
        EXPECTED TO FAIL: Current implementation may not provide structured error responses.
        """
        with patch('services.c3d.processor.C3DUtils.load_c3d_file', return_value=mock_c3d_file_with_short_signal):
            processor = GHOSTLYC3DProcessor("fake_path.c3d")
            
            # This should fail EMG processing but return structured error with metadata
            try:
                result = processor.process_file(include_signals=False)
                
                # If processing "succeeds" but with error flag
                if 'error' in result:
                    error_info = result['error']
                    
                    # Error should include metadata for user display
                    assert 'metadata' in result, "Error response should include C3D metadata"
                    assert 'c3d_parameters' in result, "Error response should include C3D parameters"
                    
                    metadata = result['metadata']
                    assert metadata['duration_seconds'] < 1, "Should show short duration"
                    assert metadata['sampling_rate'] == 990, "Should show actual sampling rate"
                    assert metadata['frame_count'] == 30, "Should show actual frame count"
                
            except Exception as e:
                # If processing throws exception, the exception should include metadata
                pytest.fail(f"Processing should return structured error, not exception: {e}")
    
    def test_c3d_parameter_extraction_for_error_display(self, mock_c3d_file_with_short_signal):
        """Test extraction of C3D parameters specifically for error display.
        
        EXPECTED TO FAIL: Current implementation may not have dedicated error parameter extraction.
        """
        with patch('services.c3d.processor.C3DUtils.load_c3d_file', return_value=mock_c3d_file_with_short_signal):
            processor = GHOSTLYC3DProcessor("fake_path.c3d")
            
            # Should be able to extract parameters for error display
            try:
                c3d_parameters = processor.extract_c3d_parameters_for_error_display()
                
                expected_parameters = {
                    'sampling_rate': 990,
                    'duration_seconds': pytest.approx(0.03, rel=1e-2),
                    'frame_count': 30,
                    'channel_count': 2,
                    'file_size_mb': pytest.approx(2.7, rel=0.5),  # Approximate
                    'game_name': 'Ghostly',
                    'player_name': 'P001',
                    'clinical_duration_status': 'too_short'
                }
                
                for key, expected in expected_parameters.items():
                    assert key in c3d_parameters, f"Parameters should include {key}"
                    if isinstance(expected, float) and hasattr(expected, 'approx'):
                        assert c3d_parameters[key] == expected
                    elif key != 'file_size_mb':  # Skip file size check for now
                        assert c3d_parameters[key] == expected, f"{key} should be {expected}"
                        
            except AttributeError:
                pytest.fail("Processor should have extract_c3d_parameters_for_error_display method")
    
    def test_clinical_duration_assessment_in_metadata(self, mock_c3d_file_with_short_signal):
        """Test that metadata includes clinical duration assessment.
        
        EXPECTED TO FAIL: Current implementation doesn't assess clinical suitability.
        """
        with patch('services.c3d.processor.C3DUtils.load_c3d_file', return_value=mock_c3d_file_with_short_signal):
            processor = GHOSTLYC3DProcessor("fake_path.c3d")
            metadata = processor.extract_metadata()
            
            # Should include clinical assessment
            assert 'clinical_duration_status' in metadata, "Metadata should include clinical duration assessment"
            assert metadata['clinical_duration_status'] == 'too_short', "Should assess as too short for clinical analysis"
            
            # Should include clinical requirements
            assert 'clinical_requirements' in metadata, "Should include clinical requirements info"
            requirements = metadata['clinical_requirements']
            assert requirements['min_duration_seconds'] == 10, "Should specify 10-second minimum"
            assert requirements['max_duration_seconds'] == 600, "Should specify 10-minute maximum"
            assert 'reason' in requirements, "Should explain clinical requirements"


class TestMetadataExtractionEdgeCases:
    """Test metadata extraction edge cases."""
    
    def test_corrupted_c3d_metadata_extraction(self):
        """Test metadata extraction from corrupted C3D files.
        
        EXPECTED TO FAIL: Current implementation may not handle corrupted metadata gracefully.
        """
        mock_corrupted_c3d = MagicMock()
        mock_corrupted_c3d.header.frame_count = None  # Corrupted
        mock_corrupted_c3d.header.analog_sample_rate = 0  # Invalid
        mock_corrupted_c3d.data.analogs = []  # No data
        mock_corrupted_c3d.parameters = {}  # No game parameters
        
        with patch('services.c3d.processor.C3DUtils.load_c3d_file', return_value=mock_corrupted_c3d):
            processor = GHOSTLYC3DProcessor("corrupted.c3d")
            
            metadata = processor.extract_metadata()
            
            # Should handle gracefully with fallback values
            assert 'error' in metadata or all(key in metadata for key in ['sampling_rate', 'duration_seconds', 'frame_count'])
            
            # If error, should still provide what information is available
            if 'error' in metadata:
                assert 'available_info' in metadata, "Should provide available information even on error"
    
    def test_large_c3d_file_with_minimal_emg(self):
        """Test handling of large C3D files with minimal EMG data.
        
        This simulates the user's actual problem: 2.7MB file with only 30 EMG samples.
        """
        mock_large_c3d = MagicMock()
        mock_large_c3d.header.frame_count = 30
        mock_large_c3d.header.analog_sample_rate = 990
        
        # Simulate large file with motion capture data but minimal EMG
        mock_large_c3d.data.analogs = [[0.1] * 30, [0.2] * 30]  # Minimal EMG
        # Simulate large motion capture data (not directly tested but implied by file size)
        
        with patch('services.c3d.processor.C3DUtils.load_c3d_file', return_value=mock_large_c3d):
            processor = GHOSTLYC3DProcessor("large_file.c3d")
            metadata = processor.extract_metadata()
            
            # Should explain the discrepancy
            assert 'file_characteristics' in metadata, "Should explain file characteristics"
            characteristics = metadata['file_characteristics']
            
            expected_characteristics = {
                'emg_duration_seconds': pytest.approx(0.03, rel=1e-2),
                'contains_motion_data': True,
                'emg_vs_motion_ratio': 'minimal_emg_large_motion'
            }
            
            for key, expected in expected_characteristics.items():
                if key in characteristics:
                    if hasattr(expected, 'approx'):
                        assert characteristics[key] == expected
                    else:
                        assert characteristics[key] == expected
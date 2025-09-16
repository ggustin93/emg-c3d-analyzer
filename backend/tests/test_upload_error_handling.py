"""Test upload endpoint error handling for EMG validation failures.

This test validates that the upload endpoint provides structured error responses
with C3D metadata when EMG processing fails, rather than generic error messages.
"""

import pytest
from unittest.mock import Mock, patch, MagicMock
from fastapi.testclient import TestClient
import tempfile
import os

from api.main import app
from services.c3d.processor import GHOSTLYC3DProcessor

client = TestClient(app)


class TestUploadErrorHandling:
    """Test upload endpoint error handling with structured responses."""
    
    @pytest.fixture
    def mock_c3d_file_short_signal(self):
        """Create a mock C3D file with insufficient EMG samples."""
        mock_c3d = MagicMock()
        mock_c3d.header.frame_count = 30
        mock_c3d.header.analog_sample_rate = 990
        mock_c3d.data.analogs = [
            [0.1] * 30,  # CH1 - very short signal
            [0.2] * 30,  # CH2 - very short signal
        ]
        
        # Mock game metadata - structure matches real C3D parameter access
        mock_c3d.parameters = {
            'GAME_NAME': {'data': ['Ghostly']},
            'LEVEL': {'data': ['1']},
            'THERAPIST_ID': {'data': ['T001']},
            'PLAYER_NAME': {'data': ['P001']},
            'TIME': {'data': ['2024-03-04 10:05:56']}
        }
        
        return mock_c3d
    
    def test_upload_endpoint_returns_structured_error_on_emg_failure(self, mock_c3d_file_short_signal):
        """Test that upload endpoint returns structured error with C3D metadata.
        
        EXPECTED TO FAIL: Current implementation may not provide structured error responses.
        """
        with tempfile.NamedTemporaryFile(suffix='.c3d', delete=False) as temp_file:
            temp_file.write(b"mock c3d content")
            temp_file_path = temp_file.name
        
        try:
            with patch('services.c3d.processor.C3DUtils.load_c3d_file', return_value=mock_c3d_file_short_signal):
                # Upload file through API endpoint
                with open(temp_file_path, 'rb') as f:
                    response = client.post(
                        "/upload",
                        files={"file": ("test.c3d", f, "application/octet-stream")},
                        data={"include_signals": "false"}
                    )
                
                # Should return structured error response, not 500
                assert response.status_code in [400, 422], f"Expected client error, got {response.status_code}"
                
                error_data = response.json()
                
                # Enhanced error response should include metadata
                expected_error_structure = {
                    'error_type': 'emg_validation_failure',
                    'message': 'EMG analysis not possible',
                    'c3d_metadata': {
                        'duration_seconds': pytest.approx(30/990, rel=1e-2),
                        'sampling_rate': 990,
                        'frame_count': 30,
                        'channel_count': 2,
                        'game_name': 'Ghostly',
                        'player_name': 'P001'
                    },
                    'clinical_requirements': {
                        'min_duration_seconds': 10,
                        'max_duration_seconds': 600,
                        'reason': 'EMG analysis requires sufficient signal duration for therapeutic assessment'
                    }
                }
                
                # Validate structured error format
                assert 'error_type' in error_data, "Error response should include error_type"
                assert error_data['error_type'] == 'emg_validation_failure'
                
                assert 'c3d_metadata' in error_data, "Error response should include C3D metadata"
                metadata = error_data['c3d_metadata']
                
                assert metadata['duration_seconds'] == pytest.approx(30/990, rel=1e-2)
                assert metadata['sampling_rate'] == 990
                assert metadata['frame_count'] == 30
                assert metadata['channel_count'] == 2
                
                assert 'clinical_requirements' in error_data, "Error response should include clinical requirements"
                requirements = error_data['clinical_requirements']
                assert requirements['min_duration_seconds'] == 10
                assert requirements['max_duration_seconds'] == 600
                
        finally:
            os.unlink(temp_file_path)
    
    def test_upload_endpoint_extracts_metadata_before_emg_processing(self, mock_c3d_file_short_signal):
        """Test that C3D metadata is extracted even when EMG processing fails.
        
        EXPECTED TO FAIL: Current implementation may not separate metadata extraction from EMG processing.
        """
        with tempfile.NamedTemporaryFile(suffix='.c3d', delete=False) as temp_file:
            temp_file.write(b"mock c3d content")
            temp_file_path = temp_file.name
        
        try:
            with patch('services.c3d.processor.C3DUtils.load_c3d_file', return_value=mock_c3d_file_short_signal):
                with open(temp_file_path, 'rb') as f:
                    response = client.post(
                        "/upload",
                        files={"file": ("test.c3d", f, "application/octet-stream")},
                        data={"include_signals": "false"}
                    )
                
                error_data = response.json()
                
                # Should extract basic file info even on EMG failure
                assert 'file_info' in error_data, "Should include file information"
                file_info = error_data['file_info']
                
                expected_file_info = {
                    'filename': 'test.c3d',
                    'contains_motion_data': True,  # Inferred from file size vs EMG data
                    'emg_channels': 2,
                    'file_type': 'c3d',
                    'processing_attempted': True,
                    'processing_successful': False
                }
                
                for key, expected_value in expected_file_info.items():
                    assert key in file_info, f"File info should include {key}"
                    assert file_info[key] == expected_value
                
        finally:
            os.unlink(temp_file_path)
    
    def test_upload_endpoint_provides_actionable_guidance_on_failure(self, mock_c3d_file_short_signal):
        """Test that error response includes actionable user guidance.
        
        EXPECTED TO FAIL: Current implementation doesn't provide user guidance.
        """
        with tempfile.NamedTemporaryFile(suffix='.c3d', delete=False) as temp_file:
            temp_file.write(b"mock c3d content")
            temp_file_path = temp_file.name
        
        try:
            with patch('services.c3d.processor.C3DUtils.load_c3d_file', return_value=mock_c3d_file_short_signal):
                with open(temp_file_path, 'rb') as f:
                    response = client.post(
                        "/upload",
                        files={"file": ("test.c3d", f, "application/octet-stream")},
                        data={"include_signals": "false"}
                    )
                
                error_data = response.json()
                
                # Should include actionable user guidance
                assert 'user_guidance' in error_data, "Error response should include user guidance"
                guidance = error_data['user_guidance']
                
                expected_guidance_elements = [
                    'Record longer EMG sessions (10 seconds to 10 minutes)',
                    'Check GHOSTLY game recording settings',
                    'Ensure proper EMG sensor connectivity',
                    'Verify EMG data is being captured during game play'
                ]
                
                assert 'secondary_recommendations' in guidance, "Guidance should include secondary_recommendations"
                recommendations = guidance['secondary_recommendations']
                
                # At least 2 actionable recommendations should be provided
                assert len(recommendations) >= 2, "Should provide multiple actionable recommendations"
                
                # Check that recommendations are helpful and specific
                recommendation_text = ' '.join(recommendations)
                assert '10 seconds' in recommendation_text, "Should mention specific duration requirements"
                assert 'EMG' in recommendation_text, "Should mention EMG specifically"
                
        finally:
            os.unlink(temp_file_path)
    
    def test_upload_endpoint_preserves_error_context_across_processing_stages(self, mock_c3d_file_short_signal):
        """Test that error context is maintained throughout processing pipeline.
        
        EXPECTED TO FAIL: Current implementation may lose context during error propagation.
        """
        with tempfile.NamedTemporaryFile(suffix='.c3d', delete=False) as temp_file:
            temp_file.write(b"mock c3d content")
            temp_file_path = temp_file.name
        
        try:
            with patch('services.c3d.processor.C3DUtils.load_c3d_file', return_value=mock_c3d_file_short_signal):
                with open(temp_file_path, 'rb') as f:
                    response = client.post(
                        "/upload",
                        files={"file": ("test.c3d", f, "application/octet-stream")},
                        data={"include_signals": "false"}
                    )
                
                error_data = response.json()
                
                # Should preserve processing context through error pipeline
                assert 'processing_context' in error_data, "Should include processing context"
                context = error_data['processing_context']
                
                expected_context = {
                    'stage_reached': 'emg_validation',  # How far processing got
                    'c3d_load_successful': True,
                    'metadata_extraction_successful': True,
                    'emg_validation_successful': False,
                    'failure_reason': 'insufficient_signal_duration'
                }
                
                for key, expected_value in expected_context.items():
                    assert key in context, f"Processing context should include {key}"
                    assert context[key] == expected_value, f"Context {key} should be {expected_value}"
                
                # Should also include timing information for debugging
                assert 'processing_time_ms' in context, "Should include processing timing"
                assert isinstance(context['processing_time_ms'], (int, float))
                assert context['processing_time_ms'] > 0
                
        finally:
            os.unlink(temp_file_path)


class TestUploadErrorHandlingEdgeCases:
    """Test edge cases for upload error handling."""
    
    def test_corrupted_c3d_file_error_response(self):
        """Test error response for corrupted C3D files.
        
        EXPECTED TO FAIL: Current implementation may not handle corrupted files gracefully.
        """
        with tempfile.NamedTemporaryFile(suffix='.c3d', delete=False) as temp_file:
            temp_file.write(b"not a valid c3d file")
            temp_file_path = temp_file.name
        
        try:
            with open(temp_file_path, 'rb') as f:
                response = client.post(
                    "/upload",
                    files={"file": ("corrupted.c3d", f, "application/octet-stream")},
                    data={"include_signals": "false"}
                )
            
            error_data = response.json()
            
            # Should handle gracefully with appropriate error type
            assert 'error_type' in error_data
            assert error_data['error_type'] in ['file_corruption', 'invalid_c3d_format']
            
            # Should still try to provide what information is available
            assert 'file_info' in error_data
            assert error_data['file_info']['filename'] == 'corrupted.c3d'
            assert error_data['file_info']['processing_successful'] is False
            
        finally:
            os.unlink(temp_file_path)
    
    def test_large_c3d_with_minimal_emg_error_explanation(self):
        """Test explanation for large C3D files with minimal EMG data.
        
        This simulates the user's actual problem: 2.7MB file with only 30 EMG samples.
        """
        mock_large_c3d = MagicMock()
        mock_large_c3d.header.frame_count = 30
        mock_large_c3d.header.analog_sample_rate = 990
        mock_large_c3d.data.analogs = [[0.1] * 30, [0.2] * 30]  # Minimal EMG
        mock_large_c3d.parameters = {
            'GAME_NAME': {'data': ['Ghostly']}
        }
        
        with tempfile.NamedTemporaryFile(suffix='.c3d', delete=False) as temp_file:
            # Create larger file to simulate the original problem
            temp_file.write(b"x" * (2700 * 1024))  # ~2.7MB
            temp_file_path = temp_file.name
        
        try:
            with patch('services.c3d.processor.C3DUtils.load_c3d_file', return_value=mock_large_c3d):
                with open(temp_file_path, 'rb') as f:
                    response = client.post(
                        "/upload",
                        files={"file": ("large_file.c3d", f, "application/octet-stream")},
                        data={"include_signals": "false"}
                    )
                
                error_data = response.json()
                
                # Should explain the discrepancy between file size and EMG data
                assert 'file_analysis' in error_data, "Should analyze file characteristics"
                analysis = error_data['file_analysis']
                
                expected_analysis = {
                    'file_size_mb': pytest.approx(2.7, rel=0.1),
                    'emg_duration_seconds': pytest.approx(30/990, rel=1e-2),  # 30 frames at 990 Hz
                    'size_duration_discrepancy': True,
                    'likely_contains_motion_data': True,
                    'emg_portion_of_file': 'minimal'
                }
                
                for key, expected_value in expected_analysis.items():
                    if key in analysis:
                        assert analysis[key] == expected_value
                
        finally:
            os.unlink(temp_file_path)
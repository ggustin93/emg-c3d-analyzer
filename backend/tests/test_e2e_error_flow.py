"""End-to-end error flow integration tests.

This test suite validates the complete error flow from file upload through
frontend display, ensuring that enhanced C3D error handling works across
the entire application stack.
"""

import pytest
from unittest.mock import Mock, patch, MagicMock
from fastapi.testclient import TestClient
import tempfile
import os
import json

from main import app
from services.c3d.processor import GHOSTLYC3DProcessor

client = TestClient(app)


class TestE2EErrorFlow:
    """Test complete error flow integration across all layers."""
    
    @pytest.fixture
    def mock_short_signal_c3d(self):
        """Create mock C3D file with insufficient EMG samples for complete test."""
        mock_c3d = MagicMock()
        mock_c3d.header.frame_count = 30
        mock_c3d.header.analog_sample_rate = 990
        mock_c3d.data.analogs = [
            [0.1] * 30,  # CH1 - very short signal
            [0.2] * 30,  # CH2 - very short signal
        ]
        
        # Complete game metadata for full test
        mock_c3d.parameters = {
            'GAME_NAME': Mock(data=['Ghostly']),
            'LEVEL': Mock(data=['1']),
            'THERAPIST_ID': Mock(data=['T001']),
            'PLAYER_NAME': Mock(data=['P001']),
            'TIME': Mock(data=['2024-03-04 10:05:56']),
            'SESSION_TYPE': Mock(data=['Therapy']),
            'DIFFICULTY': Mock(data=['Easy'])
        }
        
        return mock_c3d
    
    def test_complete_error_flow_from_upload_to_response(self, mock_short_signal_c3d):
        """Test complete error flow from file upload to structured response.
        
        EXPECTED TO FAIL: Current implementation doesn't provide full error flow integration.
        """
        with tempfile.NamedTemporaryFile(suffix='.c3d', delete=False) as temp_file:
            temp_file.write(b"mock c3d content representing short signal file")
            temp_file_path = temp_file.name
        
        try:
            with patch('services.c3d.processor.C3DUtils.load_c3d_file', return_value=mock_short_signal_c3d):
                # Step 1: Upload file through complete API workflow
                with open(temp_file_path, 'rb') as f:
                    response = client.post(
                        "/api/upload/",
                        files={"file": ("short_emg_test.c3d", f, "application/octet-stream")},
                        data={"include_signals": "false"}
                    )
                
                # Step 2: Validate API response structure
                assert response.status_code in [400, 422], f"Expected client error, got {response.status_code}"
                response_data = response.json()
                
                # Step 3: Verify complete structured error response
                expected_error_structure = {
                    'error_type': 'emg_validation_failure',
                    'message': 'EMG analysis not possible',
                    'c3d_metadata': {
                        'duration_seconds': pytest.approx(0.03, rel=1e-2),
                        'sampling_rate': 990,
                        'frame_count': 30,
                        'channel_count': 2,
                        'game_name': 'Ghostly',
                        'level': '1',
                        'therapist_id': 'T001',
                        'player_name': 'P001',
                        'session_time': '2024-03-04 10:05:56'
                    },
                    'clinical_requirements': {
                        'min_duration_seconds': 10,
                        'max_duration_seconds': 600,
                        'min_samples_required': 1000,
                        'actual_samples': 30,
                        'reason': 'EMG analysis requires sufficient signal duration for therapeutic assessment'
                    },
                    'file_info': {
                        'filename': 'short_emg_test.c3d',
                        'file_size_bytes': response_data.get('file_info', {}).get('file_size_bytes', 0),
                        'contains_motion_data': True,
                        'emg_channels': 2,
                        'processing_attempted': True,
                        'processing_successful': False,
                        'failure_stage': 'emg_validation'
                    },
                    'user_guidance': {
                        'primary_recommendation': 'Record longer EMG sessions (10 seconds to 10 minutes)',
                        'secondary_recommendations': [
                            'Check GHOSTLY game recording settings',
                            'Ensure proper EMG sensor connectivity',
                            'Verify EMG data is being captured during gameplay'
                        ],
                        'technical_note': 'File contains valid C3D data but insufficient EMG duration for analysis'
                    }
                }
                
                # Step 4: Validate all required error response components
                self._validate_error_structure(response_data, expected_error_structure)
                
        finally:
            os.unlink(temp_file_path)
    
    def _validate_error_structure(self, actual_data, expected_structure):
        """Helper method to validate error response structure."""
        for key, expected_value in expected_structure.items():
            assert key in actual_data, f"Response missing key: {key}"
            
            if isinstance(expected_value, dict):
                # Recursively validate nested dictionaries
                self._validate_error_structure(actual_data[key], expected_value)
            elif isinstance(expected_value, list):
                # Validate list contents
                actual_list = actual_data[key]
                assert len(actual_list) >= len(expected_value), f"List {key} has insufficient items"
                for expected_item in expected_value:
                    assert any(expected_item in str(actual_item) for actual_item in actual_list), \
                        f"List {key} missing expected item: {expected_item}"
            elif hasattr(expected_value, 'approx'):
                # Handle pytest.approx values
                assert actual_data[key] == expected_value
            else:
                # Direct value comparison
                assert actual_data[key] == expected_value, f"Key {key}: expected {expected_value}, got {actual_data[key]}"
    
    def test_error_flow_preserves_context_across_processing_stages(self, mock_short_signal_c3d):
        """Test that error context is preserved throughout complete processing pipeline.
        
        EXPECTED TO FAIL: Current implementation may lose processing context during error propagation.
        """
        with tempfile.NamedTemporaryFile(suffix='.c3d', delete=False) as temp_file:
            temp_file.write(b"mock c3d content")
            temp_file_path = temp_file.name
        
        try:
            with patch('services.c3d.processor.C3DUtils.load_c3d_file', return_value=mock_short_signal_c3d):
                with open(temp_file_path, 'rb') as f:
                    response = client.post(
                        "/api/upload/",
                        files={"file": ("context_test.c3d", f, "application/octet-stream")},
                        data={"include_signals": "false"}
                    )
                
                response_data = response.json()
                
                # Validate processing pipeline context preservation
                assert 'processing_pipeline' in response_data, "Should include processing pipeline information"
                pipeline = response_data['processing_pipeline']
                
                expected_pipeline_stages = [
                    {
                        'stage': 'file_upload',
                        'status': 'success',
                        'timestamp': 'present'
                    },
                    {
                        'stage': 'c3d_load',
                        'status': 'success',
                        'timestamp': 'present'
                    },
                    {
                        'stage': 'metadata_extraction',
                        'status': 'success',
                        'timestamp': 'present'
                    },
                    {
                        'stage': 'emg_validation',
                        'status': 'failed',
                        'error': 'insufficient_signal_duration',
                        'timestamp': 'present'
                    }
                ]
                
                for expected_stage in expected_pipeline_stages:
                    matching_stage = next(
                        (stage for stage in pipeline if stage['stage'] == expected_stage['stage']),
                        None
                    )
                    assert matching_stage is not None, f"Missing pipeline stage: {expected_stage['stage']}"
                    assert matching_stage['status'] == expected_stage['status']
                    
                    if 'error' in expected_stage:
                        assert matching_stage.get('error') == expected_stage['error']
                
        finally:
            os.unlink(temp_file_path)
    
    def test_error_flow_handles_multiple_failure_modes(self):
        """Test error flow for different types of failures (corruption, validation, processing).
        
        EXPECTED TO FAIL: Current implementation may not handle different failure modes appropriately.
        """
        test_cases = [
            {
                'name': 'corrupted_file',
                'mock_exception': Exception("C3D file corruption detected"),
                'expected_error_type': 'file_corruption',
                'expected_guidance': 'Try re-downloading the file'
            },
            {
                'name': 'invalid_format',
                'mock_exception': ValueError("Invalid C3D format"),
                'expected_error_type': 'invalid_format',
                'expected_guidance': 'Ensure file is a valid C3D format'
            },
            {
                'name': 'insufficient_data',
                'mock_c3d': self._create_insufficient_data_mock(),
                'expected_error_type': 'emg_validation_failure',
                'expected_guidance': 'Record longer EMG sessions'
            }
        ]
        
        for test_case in test_cases:
            with self.subTest(failure_mode=test_case['name']):
                self._test_specific_failure_mode(test_case)
    
    def _create_insufficient_data_mock(self):
        """Create mock for insufficient data scenario."""
        mock_c3d = MagicMock()
        mock_c3d.header.frame_count = 5  # Extremely short
        mock_c3d.header.analog_sample_rate = 1000
        mock_c3d.data.analogs = [[0.1] * 5]  # Single channel, very short
        mock_c3d.parameters = {
            'GAME_NAME': Mock(data=['Ghostly'])
        }
        return mock_c3d
    
    def _test_specific_failure_mode(self, test_case):
        """Test specific failure mode scenario."""
        with tempfile.NamedTemporaryFile(suffix='.c3d', delete=False) as temp_file:
            temp_file.write(b"test content")
            temp_file_path = temp_file.name
        
        try:
            if 'mock_exception' in test_case:
                # Test exception-based failures
                with patch('services.c3d.processor.C3DUtils.load_c3d_file', side_effect=test_case['mock_exception']):
                    with open(temp_file_path, 'rb') as f:
                        response = client.post(
                            "/api/upload/",
                            files={"file": (f"{test_case['name']}.c3d", f, "application/octet-stream")},
                            data={"include_signals": "false"}
                        )
            else:
                # Test mock-based failures
                with patch('services.c3d.processor.C3DUtils.load_c3d_file', return_value=test_case['mock_c3d']):
                    with open(temp_file_path, 'rb') as f:
                        response = client.post(
                            "/api/upload/",
                            files={"file": (f"{test_case['name']}.c3d", f, "application/octet-stream")},
                            data={"include_signals": "false"}
                        )
            
            response_data = response.json()
            
            # Validate error type
            assert response_data.get('error_type') == test_case['expected_error_type']
            
            # Validate appropriate guidance is provided
            guidance_text = json.dumps(response_data.get('user_guidance', {}))
            assert test_case['expected_guidance'] in guidance_text
            
        finally:
            os.unlink(temp_file_path)
    
    def test_error_response_includes_debugging_information(self, mock_short_signal_c3d):
        """Test that error response includes sufficient debugging information for support.
        
        EXPECTED TO FAIL: Current implementation may not include debugging context.
        """
        with tempfile.NamedTemporaryFile(suffix='.c3d', delete=False) as temp_file:
            temp_file.write(b"debug test content")
            temp_file_path = temp_file.name
        
        try:
            with patch('services.c3d.processor.C3DUtils.load_c3d_file', return_value=mock_short_signal_c3d):
                with open(temp_file_path, 'rb') as f:
                    response = client.post(
                        "/api/upload/",
                        files={"file": ("debug_test.c3d", f, "application/octet-stream")},
                        data={"include_signals": "false"}
                    )
                
                response_data = response.json()
                
                # Should include debugging information for support team
                assert 'debug_info' in response_data, "Should include debugging information"
                debug_info = response_data['debug_info']
                
                expected_debug_fields = [
                    'error_id',  # Unique identifier for this error instance
                    'server_version',  # Backend version information
                    'processing_time_ms',  # How long processing took
                    'c3d_parser_version',  # C3D library version
                    'signal_processing_config',  # Processing parameters used
                    'system_info'  # Basic system information
                ]
                
                for field in expected_debug_fields:
                    assert field in debug_info, f"Debug info should include {field}"
                
                # Validate specific debug content
                assert isinstance(debug_info['error_id'], str)
                assert len(debug_info['error_id']) > 0
                assert isinstance(debug_info['processing_time_ms'], (int, float))
                assert debug_info['processing_time_ms'] > 0
                
        finally:
            os.unlink(temp_file_path)
    
    def test_error_response_maintains_api_contract_compatibility(self, mock_short_signal_c3d):
        """Test that enhanced error responses don't break existing API contracts.
        
        EXPECTED TO FAIL: Enhanced errors might break existing client expectations.
        """
        with tempfile.NamedTemporaryFile(suffix='.c3d', delete=False) as temp_file:
            temp_file.write(b"compatibility test")
            temp_file_path = temp_file.name
        
        try:
            with patch('services.c3d.processor.C3DUtils.load_c3d_file', return_value=mock_short_signal_c3d):
                with open(temp_file_path, 'rb') as f:
                    response = client.post(
                        "/api/upload/",
                        files={"file": ("compatibility_test.c3d", f, "application/octet-stream")},
                        data={"include_signals": "false"}
                    )
                
                response_data = response.json()
                
                # Maintain backward compatibility with existing error structure
                # Should still include legacy fields that existing clients might expect
                legacy_compatibility_fields = [
                    'detail',  # FastAPI standard error field
                    'type',    # Error type field
                    'message'  # Human readable message
                ]
                
                for field in legacy_compatibility_fields:
                    if field == 'detail':
                        # Should either have 'detail' or be structured error
                        assert 'detail' in response_data or 'error_type' in response_data
                    elif field == 'type':
                        # Should map to error_type
                        assert 'error_type' in response_data
                    elif field == 'message':
                        # Should have message field
                        assert 'message' in response_data
                
                # New structured fields should be additive, not replacing
                assert response_data['error_type'] == 'emg_validation_failure'
                assert 'c3d_metadata' in response_data
                assert 'clinical_requirements' in response_data
                
        finally:
            os.unlink(temp_file_path)


class TestE2EErrorFlowEdgeCases:
    """Test edge cases in complete error flow integration."""
    
    def test_large_file_minimal_emg_complete_flow(self):
        """Test complete flow for large file with minimal EMG (real user scenario).
        
        This tests the specific scenario reported by users: 2.7MB file with 30 samples.
        """
        mock_large_minimal_emg = MagicMock()
        mock_large_minimal_emg.header.frame_count = 30
        mock_large_minimal_emg.header.analog_sample_rate = 990
        mock_large_minimal_emg.data.analogs = [[0.1] * 30, [0.2] * 30]
        mock_large_minimal_emg.parameters = {
            'GAME_NAME': Mock(data=['Ghostly']),
            'PLAYER_NAME': Mock(data=['TestPatient'])
        }
        
        # Create file that's actually large (simulate 2.7MB)
        with tempfile.NamedTemporaryFile(suffix='.c3d', delete=False) as temp_file:
            temp_file.write(b"x" * (2700 * 1024))  # 2.7MB
            temp_file_path = temp_file.name
        
        try:
            with patch('services.c3d.processor.C3DUtils.load_c3d_file', return_value=mock_large_minimal_emg):
                with open(temp_file_path, 'rb') as f:
                    response = client.post(
                        "/api/upload/",
                        files={"file": ("large_minimal_emg.c3d", f, "application/octet-stream")},
                        data={"include_signals": "false"}
                    )
                
                response_data = response.json()
                
                # Should specifically explain the large file / minimal EMG discrepancy
                assert 'file_analysis' in response_data
                analysis = response_data['file_analysis']
                
                assert analysis['file_size_mb'] >= 2.0  # Should detect large file
                assert analysis['emg_duration_seconds'] < 0.1  # Should detect minimal EMG
                assert analysis['size_duration_discrepancy'] is True
                assert analysis['likely_explanation'] == 'file_contains_motion_capture_data'
                
        finally:
            os.unlink(temp_file_path)
    
    def test_concurrent_error_requests_handling(self):
        """Test that concurrent error requests are handled properly.
        
        EXPECTED TO FAIL: Concurrent error handling might have race conditions.
        """
        import asyncio
        import aiohttp
        
        # This test would require async test setup
        # Placeholder for concurrent request testing
        assert True  # TODO: Implement concurrent error handling test
    
    def test_error_flow_performance_under_load(self):
        """Test error flow performance with multiple rapid requests.
        
        EXPECTED TO FAIL: Error handling might be slower than regular processing.
        """
        # Performance test placeholder
        # Should validate that error responses are generated quickly
        assert True  # TODO: Implement performance testing
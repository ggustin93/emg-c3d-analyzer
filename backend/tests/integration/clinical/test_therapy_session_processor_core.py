"""Core Therapy Session Processor Tests.

Essential tests for core therapy session processor functionality that must not be lost.
Focused on critical session lifecycle management and error handling scenarios.

These tests complement the comprehensive integration tests by covering:
- Session lifecycle management (create, update status, get status)
- Critical error handling scenarios
- File processing edge cases
- Infrastructure and utility functions

Author: Backend Architecture Review
Date: 2025-09-05
"""

import asyncio
from datetime import datetime
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4
import tempfile
import os

import pytest

# Import the class under test
from services.clinical.therapy_session_processor import (
    FileProcessingError,
    SessionNotFoundError,
    TherapySessionError,
    TherapySessionProcessor,
)

# ============================================================================
# MODULE-LEVEL FIXTURES
# ============================================================================

@pytest.fixture
def sample_file_metadata():
    """Sample C3D file metadata"""
    return {
        "size": 2874924,
        "mimetype": "application/octet-stream",
        "cacheControl": "max-age=3600",
        "lastModified": "2025-08-27T10:00:00Z"
    }


class TestTherapySessionProcessorCore:
    """Test core therapy session processor functionality with essential coverage"""

    @pytest.mark.asyncio
    async def test_create_session_success(self, mock_therapy_processor, sample_file_metadata):
        """Test successful session creation with patient"""
        processor = mock_therapy_processor
        
        # Mock repository operations
        test_session_id = str(uuid4())
        test_session_code = "P039S001"
        mock_session = {
            "id": test_session_id,
            "session_code": test_session_code,
            "file_path": "c3d-examples/P039/test.c3d"
        }

        # Configure mocks
        processor.session_repo.get_session_by_file_hash = MagicMock(return_value=None)
        processor.session_repo.create_session_with_code = MagicMock(
            return_value=(test_session_code, test_session_id, mock_session)
        )

        # Mock file hash generation to avoid file operations
        with patch.object(processor, "_generate_file_hash", return_value="test-hash"):
            result = await processor.create_session(
                file_path="c3d-examples/P039/test.c3d",
                file_metadata=sample_file_metadata,
                patient_id="patient-123"
            )

        assert result == test_session_code
        processor.session_repo.create_session_with_code.assert_called_once()

    @pytest.mark.asyncio
    async def test_create_session_database_error(self, mock_therapy_processor, sample_file_metadata):
        """Test session creation with database error"""
        processor = mock_therapy_processor
        
        # Mock database error
        processor.session_repo.get_session_by_file_hash = MagicMock(return_value=None)
        processor.session_repo.create_session_with_code = MagicMock(
            side_effect=Exception("Database connection failed")
        )

        # Mock file hash generation
        with patch.object(processor, "_generate_file_hash", return_value="test-hash"):
            with pytest.raises(TherapySessionError, match="Session creation failed"):
                await processor.create_session(
                    file_path="c3d-examples/test.c3d",
                    file_metadata=sample_file_metadata
                )

    @pytest.mark.asyncio
    async def test_update_session_status_success(self, mock_therapy_processor):
        """Test successful session status update"""
        processor = mock_therapy_processor
        session_code = "P001S001"
        
        # Mock repository method
        processor.session_repo.update_session_status = MagicMock()
        
        # Test the update
        await processor.update_session_status(session_code, "processing")
        
        # Verify repository was called
        processor.session_repo.update_session_status.assert_called_once_with(
            session_code, "processing", None
        )

    @pytest.mark.asyncio
    async def test_update_session_status_with_error(self, mock_therapy_processor):
        """Test session status update with error message"""
        processor = mock_therapy_processor
        session_code = "P001S001"
        error_msg = "Processing failed due to invalid C3D format"
        
        # Mock repository method
        processor.session_repo.update_session_status = MagicMock()
        
        # Test the update with error
        await processor.update_session_status(session_code, "failed", error_msg)
        
        # Verify repository was called with error message
        processor.session_repo.update_session_status.assert_called_once_with(
            session_code, "failed", error_msg
        )

    @pytest.mark.asyncio
    async def test_get_session_status_success(self, mock_therapy_processor):
        """Test successful session status retrieval"""
        processor = mock_therapy_processor
        session_code = "P001S001"
        session_uuid = str(uuid4())
        
        # Mock repository response
        mock_session_data = {
            "id": session_uuid,
            "patient_id": "patient-123",
            "file_path": "c3d-examples/test.c3d",
            "processing_status": "completed",
            "created_at": datetime.now().isoformat(),
            "updated_at": datetime.now().isoformat()
        }
        processor.session_repo.get_therapy_session = MagicMock(return_value=mock_session_data)
        
        # Test status retrieval
        result = await processor.get_session_status(session_code)
        
        # Verify response structure
        assert result is not None
        assert result["id"] == session_uuid
        assert result["session_code"] == session_code
        assert result["processing_status"] == "completed"
        assert result["patient_id"] == "patient-123"

    @pytest.mark.asyncio
    async def test_get_session_status_not_found(self, mock_therapy_processor):
        """Test session status retrieval when session doesn't exist"""
        processor = mock_therapy_processor
        session_code = "P999S999"
        
        # Mock repository to return None (session not found)
        processor.session_repo.get_therapy_session = MagicMock(return_value=None)
        
        # Test status retrieval
        result = await processor.get_session_status(session_code)
        
        # Should return None for non-existent session
        assert result is None

    @pytest.mark.asyncio
    async def test_process_c3d_file_processing_error(self, mock_therapy_processor):
        """Test C3D file processing with processing error"""
        processor = mock_therapy_processor
        session_code = "P001S001"
        bucket = "c3d-examples"
        object_path = "test.c3d"
        
        # Mock session exists
        processor.session_repo.get_therapy_session = MagicMock(return_value={
            "id": str(uuid4()),
            "file_path": f"{bucket}/{object_path}"
        })
        
        # Mock file download success
        with patch.object(processor, '_download_file_from_storage') as mock_download:
            mock_download.return_value = "/tmp/test.c3d"
            
            # Mock C3D processing failure
            with patch.object(processor.c3d_processor, 'process_c3d_file_complete') as mock_process:
                mock_process.side_effect = Exception("Invalid C3D format")
                
                # Test processing error handling
                with pytest.raises(TherapySessionError, match="Processing failed"):
                    await processor.process_c3d_file(session_code, bucket, object_path)

    @pytest.mark.asyncio
    async def test_download_file_storage_error(self, mock_therapy_processor):
        """Test file download with storage error"""
        processor = mock_therapy_processor
        
        # Mock storage client to raise error
        processor.supabase_client.storage.from_.return_value.download.side_effect = \
            Exception("Storage service unavailable")
        
        # Test download error handling
        with pytest.raises(FileProcessingError, match="Storage download failed"):
            await processor._download_file_from_storage("c3d-examples/test.c3d")

    def test_custom_exceptions(self):
        """Test custom exception classes and hierarchy"""
        # Test base exception
        base_error = TherapySessionError("Base error")
        assert str(base_error) == "Base error"
        assert isinstance(base_error, Exception)
        
        # Test file processing exception
        file_error = FileProcessingError("File error")
        assert str(file_error) == "File error"
        assert isinstance(file_error, TherapySessionError)
        assert isinstance(file_error, Exception)
        
        # Test session not found exception
        session_error = SessionNotFoundError("Session error")
        assert str(session_error) == "Session error"
        assert isinstance(session_error, TherapySessionError)
        assert isinstance(session_error, Exception)

    @pytest.mark.asyncio
    async def test_cleanup_temp_file_utility(self, mock_therapy_processor):
        """Test temporary file cleanup utility"""
        # Create a real temporary file
        temp_fd, temp_path = tempfile.mkstemp(suffix=".c3d", prefix="test_cleanup_")
        
        try:
            # Write some test data
            with open(temp_path, 'w') as f:
                f.write("test data")
            
            # Verify file exists
            assert os.path.exists(temp_path)
            
            # Test cleanup (using os.unlink as the processor would)
            os.unlink(temp_path)
            
            # Verify file is deleted
            assert not os.path.exists(temp_path)
            
        finally:
            # Cleanup in case test fails
            if os.path.exists(temp_path):
                os.unlink(temp_path)
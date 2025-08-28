"""
Critical Therapy Session Processor Tests
========================================

KISS, DRY implementation testing core therapy session orchestration logic that was missing from coverage.
Tests the critical business logic that orchestrates the entire C3D processing workflow.

Author: Senior Engineer  
Date: 2025-08-27
"""

import os
import tempfile
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, mock_open, patch
from uuid import uuid4

import pytest

# Import the class under test
from services.clinical.therapy_session_processor import (
    FileProcessingError,
    SessionNotFoundError,
    TherapySessionError,
    TherapySessionProcessor,
)


class TestTherapySessionProcessorCore:
    """Test core therapy session processor functionality"""

    @pytest.fixture
    def processor(self):
        """Create processor instance with mocked dependencies"""
        with patch("services.clinical.therapy_session_processor.get_supabase_client"):
            processor = TherapySessionProcessor()
            # Mock the database operations
            processor.db_ops = MagicMock()
            processor.supabase_client = MagicMock()
            return processor

    @pytest.fixture
    def sample_file_metadata(self):
        """Sample C3D file metadata"""
        return {
            "size": 2874924,
            "mimetype": "application/octet-stream",
            "cacheControl": "max-age=3600",
            "lastModified": "2025-08-27T10:00:00Z"
        }

    @pytest.fixture
    def sample_c3d_result(self):
        """Sample C3D processing result"""
        return {
            "success": True,
            "metadata": {
                "file_path": "P039/test.c3d",
                "duration_seconds": 175.1,
                "sampling_rate": 990.0,
                "session_date": datetime(2023, 3, 21, 17, 50, 17),
                "channels": ["CH1", "CH2"]
            },
            "analytics": {
                "CH1": {
                    "contractions_detected": 20,
                    "mvc_amplitude": 0.001234,
                    "rms_mean": 0.000456,
                    "total_contraction_time": 45.2
                },
                "CH2": {
                    "contractions_detected": 9,
                    "mvc_amplitude": 0.000987,
                    "rms_mean": 0.000234,
                    "total_contraction_time": 32.1
                }
            },
            "performance_scores": {
                "overall_score": 72.5,
                "compliance_score": 85.0,
                "symmetry_score": 65.0
            }
        }

    @pytest.mark.asyncio
    async def test_create_session_success(self, processor, sample_file_metadata):
        """Test successful session creation"""
        # Mock repository operations
        test_session_id = str(uuid4())
        mock_session = {"id": test_session_id, "file_path": "c3d-examples/P039/test.c3d"}
        
        # Mock the methods used by create_session
        processor.session_repo.get_session_by_file_hash = MagicMock(return_value=None)  # No existing session
        processor.session_repo.create_therapy_session = MagicMock(return_value=mock_session)
        
        # Mock file hash calculation to avoid file operations
        with patch.object(processor, '_calculate_file_hash_from_path', return_value="test-hash"):
            result = await processor.create_session(
                file_path="c3d-examples/P039/test.c3d",
                file_metadata=sample_file_metadata,
                patient_id="patient-123"
            )

        assert result == test_session_id

        # Verify repository calls
        processor.session_repo.create_therapy_session.assert_called_once()
        call_args = processor.session_repo.create_therapy_session.call_args[0][0]  # First positional arg
        assert call_args["file_path"] == "c3d-examples/P039/test.c3d"
        assert call_args["patient_id"] == "patient-123"
        assert call_args["file_size_bytes"] == 2874924

    @pytest.mark.asyncio
    async def test_create_session_without_patient(self, processor, sample_file_metadata):
        """Test session creation without patient ID"""
        test_session_id = str(uuid4())
        mock_session = {"id": test_session_id, "file_path": "c3d-examples/anonymous/test.c3d"}
        
        # Mock repository operations
        processor.session_repo.get_session_by_file_hash = MagicMock(return_value=None)
        processor.session_repo.create_therapy_session = MagicMock(return_value=mock_session)
        
        # Mock file hash calculation to avoid file operations
        with patch.object(processor, '_calculate_file_hash_from_path', return_value="test-hash"):
            result = await processor.create_session(
                file_path="c3d-examples/anonymous/test.c3d",
                file_metadata=sample_file_metadata
            )

        assert result == test_session_id

        # Verify repository calls
        processor.session_repo.create_therapy_session.assert_called_once()
        call_args = processor.session_repo.create_therapy_session.call_args[0][0]
        assert call_args["patient_id"] is None

    @pytest.mark.asyncio
    async def test_create_session_database_error(self, processor, sample_file_metadata):
        """Test session creation handles database errors"""
        # Mock repository operations to fail
        processor.session_repo.get_session_by_file_hash = MagicMock(return_value=None)
        processor.session_repo.create_therapy_session = MagicMock(
            side_effect=Exception("Database connection failed")
        )
        
        # Mock file hash calculation to avoid file operations
        with patch.object(processor, '_calculate_file_hash_from_path', return_value="test-hash"):
            with pytest.raises(TherapySessionError, match="Failed to create therapy session"):
                await processor.create_session(
                    file_path="c3d-examples/P039/test.c3d",
                    file_metadata=sample_file_metadata
                )

    @pytest.mark.asyncio
    async def test_update_session_status_success(self, processor):
        """Test successful session status update"""
        processor.session_repo.update_session_status = AsyncMock(return_value=True)

        await processor.update_session_status("session-123", "completed")

        processor.session_repo.update_session_status.assert_called_once_with(
            "session-123", "completed", None
        )

    @pytest.mark.asyncio
    async def test_update_session_status_with_error(self, processor):
        """Test session status update with error message"""
        processor.session_repo.update_session_status = AsyncMock(return_value=True)

        await processor.update_session_status(
            "session-123",
            "failed",
            error_message="C3D file corrupted"
        )

        processor.session_repo.update_session_status.assert_called_once_with(
            "session-123", "failed", "C3D file corrupted"
        )

    @pytest.mark.asyncio
    async def test_get_session_status_success(self, processor):
        """Test successful session status retrieval"""
        mock_status = {
            "processing_status": "completed",
            "file_path": "c3d-examples/P039/test.c3d",
            "created_at": "2025-08-27T10:00:00Z",
            "processed_at": "2025-08-27T10:05:00Z",
            "analytics_cache": {"channels_analyzed": 2}
        }
        processor.session_repo.get_session_status = AsyncMock(return_value=mock_status)

        result = await processor.get_session_status("session-123")

        assert result == mock_status
        processor.session_repo.get_session_status.assert_called_once_with("session-123")

    @pytest.mark.asyncio
    async def test_get_session_status_not_found(self, processor):
        """Test session status retrieval for missing session"""
        processor.session_repo.get_session_status = AsyncMock(return_value=None)

        result = await processor.get_session_status("nonexistent-session")

        assert result is None


class TestTherapySessionProcessorFileHandling:
    """Test file download and processing functionality"""

    @pytest.fixture
    def processor(self):
        with patch("services.clinical.therapy_session_processor.get_supabase_client"):
            processor = TherapySessionProcessor()
            processor.session_repo = MagicMock()
            processor.supabase_client = MagicMock()
            return processor

    @pytest.mark.asyncio
    async def test_download_c3d_file_success(self, processor):
        """Test successful C3D file download"""
        # Mock Supabase storage download
        mock_file_content = b"C3D file binary data"
        processor.supabase_client.storage.from_.return_value.download.return_value = mock_file_content

        with patch("tempfile.NamedTemporaryFile") as mock_temp:
            mock_file = MagicMock()
            mock_file.name = "/tmp/test_c3d_file.c3d"
            mock_temp.return_value.__enter__.return_value = mock_file

            result = await processor._download_c3d_file("c3d-examples", "P039/test.c3d")

            assert result == "/tmp/test_c3d_file.c3d"

            # Verify file was written
            mock_file.write.assert_called_once_with(mock_file_content)
            mock_file.flush.assert_called_once()

    @pytest.mark.asyncio
    async def test_download_c3d_file_storage_error(self, processor):
        """Test C3D file download handles storage errors"""
        processor.supabase_client.storage.from_.return_value.download.side_effect = Exception("File not found")

        with pytest.raises(FileProcessingError, match="Failed to download C3D file"):
            await processor._download_c3d_file("c3d-examples", "P039/missing.c3d")

    @patch("services.clinical.therapy_session_processor.GHOSTLYC3DProcessor")
    @pytest.mark.asyncio
    async def test_process_c3d_file_success(self, mock_processor_class, processor, sample_c3d_result):
        """Test successful complete C3D file processing"""
        # Mock file download
        processor._download_c3d_file = AsyncMock(return_value="/tmp/test.c3d")

        # Mock C3D processor
        mock_c3d_processor = MagicMock()
        mock_c3d_processor.process_file.return_value = sample_c3d_result
        mock_processor_class.return_value = mock_c3d_processor

        # Mock database operations
        processor.session_repo.populate_session_data = AsyncMock(return_value=True)

        result = await processor.process_c3d_file(
            session_id="session-123",
            bucket="c3d-examples",
            object_path="P039/test.c3d"
        )

        assert result["success"] is True
        assert result["channels_analyzed"] == 2
        assert result["overall_score"] == 72.5

        # Verify workflow
        processor._download_c3d_file.assert_called_once_with("c3d-examples", "P039/test.c3d")
        mock_c3d_processor.process_file.assert_called_once_with("/tmp/test.c3d")
        processor.session_repo.populate_session_data.assert_called_once()

    @patch("services.clinical.therapy_session_processor.GHOSTLYC3DProcessor")
    @pytest.mark.asyncio
    async def test_process_c3d_file_processing_error(self, mock_processor_class, processor):
        """Test C3D file processing handles C3D processing errors"""
        processor._download_c3d_file = AsyncMock(return_value="/tmp/test.c3d")

        # Mock C3D processor failure
        mock_c3d_processor = MagicMock()
        mock_c3d_processor.process_file.return_value = {
            "success": False,
            "error": "Invalid C3D format"
        }
        mock_processor_class.return_value = mock_c3d_processor

        result = await processor.process_c3d_file(
            session_id="session-123",
            bucket="c3d-examples",
            object_path="P039/corrupted.c3d"
        )

        assert result["success"] is False
        assert result["error"] == "Invalid C3D format"

    @patch("services.clinical.therapy_session_processor.GHOSTLYC3DProcessor")
    @pytest.mark.asyncio
    async def test_process_c3d_file_database_population_error(self, mock_processor_class, processor, sample_c3d_result):
        """Test C3D processing handles database population errors"""
        processor._download_c3d_file = AsyncMock(return_value="/tmp/test.c3d")

        # Mock successful C3D processing
        mock_c3d_processor = MagicMock()
        mock_c3d_processor.process_file.return_value = sample_c3d_result
        mock_processor_class.return_value = mock_c3d_processor

        # Mock database population failure
        processor.session_repo.populate_session_data = AsyncMock(
            side_effect=Exception("Database constraint violation")
        )

        result = await processor.process_c3d_file(
            session_id="session-123",
            bucket="c3d-examples",
            object_path="P039/test.c3d"
        )

        assert result["success"] is False
        assert "Database constraint violation" in result["error"]

    @patch("os.unlink")
    @patch("services.clinical.therapy_session_processor.GHOSTLYC3DProcessor")
    @pytest.mark.asyncio
    async def test_process_c3d_file_cleanup(self, mock_processor_class, mock_unlink, processor, sample_c3d_result):
        """Test C3D processing cleans up temporary files"""
        temp_file_path = "/tmp/test_cleanup.c3d"
        processor._download_c3d_file = AsyncMock(return_value=temp_file_path)

        mock_c3d_processor = MagicMock()
        mock_c3d_processor.process_file.return_value = sample_c3d_result
        mock_processor_class.return_value = mock_c3d_processor

        processor.session_repo.populate_session_data = AsyncMock(return_value=True)

        await processor.process_c3d_file(
            session_id="session-123",
            bucket="c3d-examples",
            object_path="P039/test.c3d"
        )

        # Verify temp file cleanup
        mock_unlink.assert_called_once_with(temp_file_path)

    @patch("os.unlink")
    @patch("services.clinical.therapy_session_processor.GHOSTLYC3DProcessor")
    @pytest.mark.asyncio
    async def test_process_c3d_file_cleanup_on_error(self, mock_processor_class, mock_unlink, processor):
        """Test C3D processing cleans up temporary files even on errors"""
        temp_file_path = "/tmp/test_error_cleanup.c3d"
        processor._download_c3d_file = AsyncMock(return_value=temp_file_path)

        # Mock C3D processor exception
        mock_c3d_processor = MagicMock()
        mock_c3d_processor.process_file.side_effect = Exception("Processing failed")
        mock_processor_class.return_value = mock_c3d_processor

        result = await processor.process_c3d_file(
            session_id="session-123",
            bucket="c3d-examples",
            object_path="P039/test.c3d"
        )

        assert result["success"] is False
        # Verify temp file cleanup even on error
        mock_unlink.assert_called_once_with(temp_file_path)


class TestTherapySessionProcessorIntegration:
    """Test integration scenarios and error handling"""

    @pytest.fixture
    def processor(self):
        with patch("services.clinical.therapy_session_processor.get_supabase_client"):
            processor = TherapySessionProcessor()
            processor.session_repo = MagicMock()
            processor.supabase_client = MagicMock()
            return processor

    @pytest.mark.asyncio
    async def test_full_workflow_success(self, processor):
        """Test complete end-to-end workflow success"""
        # Test session creation -> processing -> status update

        # 1. Create session
        test_session_id = str(uuid4())
        mock_session = {"id": test_session_id, "file_path": "c3d-examples/P039/test.c3d"}
        processor.session_repo.get_session_by_file_hash = MagicMock(return_value=None)
        processor.session_repo.create_therapy_session = MagicMock(return_value=mock_session)

        # Mock file hash calculation to avoid file operations
        with patch.object(processor, '_calculate_file_hash_from_path', return_value="test-hash"):
            session_id = await processor.create_session(
                file_path="c3d-examples/P039/test.c3d",
                file_metadata={"size": 1024}
            )

        # 2. Update to processing
        processor.session_repo.update_session_status = AsyncMock(return_value=True)
        await processor.update_session_status(session_id, "processing")

        # 3. Get status
        mock_status = {"processing_status": "processing", "file_path": "c3d-examples/P039/test.c3d"}
        processor.session_repo.get_session_status = AsyncMock(return_value=mock_status)

        status = await processor.get_session_status(session_id)

        # Verify workflow
        assert status["processing_status"] == "processing"
        assert processor.session_repo.create_therapy_session.called
        assert processor.session_repo.update_session_status.called
        assert processor.session_repo.get_session_status.called

    def test_custom_exceptions(self):
        """Test custom exception classes"""
        # Test TherapySessionError
        with pytest.raises(TherapySessionError):
            raise TherapySessionError("Base session error")

        # Test FileProcessingError inheritance
        with pytest.raises(TherapySessionError):
            raise FileProcessingError("File processing failed")

        # Test SessionNotFoundError inheritance
        with pytest.raises(TherapySessionError):
            raise SessionNotFoundError("Session not found")

    @pytest.mark.asyncio
    async def test_concurrent_session_creation(self, processor):
        """Test multiple concurrent session creations"""
        import asyncio

        # Mock repository operations
        call_count = 0
        def mock_create_session(session_data):
            nonlocal call_count
            call_count += 1
            session_id = f"session-{call_count}"
            return {"id": session_id, "file_path": session_data.get("file_path", "")}

        processor.session_repo.get_session_by_file_hash = MagicMock(return_value=None)
        processor.session_repo.create_therapy_session = MagicMock(side_effect=mock_create_session)

        # Create multiple sessions concurrently
        tasks = []
        with patch.object(processor, '_calculate_file_hash_from_path', return_value="test-hash"):
            for i in range(5):
                task = processor.create_session(
                    file_path=f"c3d-examples/P{i:03d}/test_{i}.c3d",
                    file_metadata={"size": 1024 * (i + 1)}
                )
                tasks.append(task)

            results = await asyncio.gather(*tasks)

        # Verify all sessions created with unique IDs
        assert len(results) == 5
        assert len(set(results)) == 5  # All unique
        assert all(result.startswith("session-") for result in results)

    @pytest.mark.asyncio
    async def test_error_recovery_workflow(self, processor):
        """Test error recovery and retry logic"""
        # Mock initial failure followed by success
        failure_count = 0

        def mock_create_with_retry(session_data):
            nonlocal failure_count
            failure_count += 1
            if failure_count <= 2:
                raise Exception("Temporary database error")
            return {"id": "session-success-after-retry", "file_path": session_data.get("file_path", "")}

        processor.session_repo.get_session_by_file_hash = MagicMock(return_value=None)
        processor.session_repo.create_therapy_session = MagicMock(side_effect=mock_create_with_retry)

        # This should fail initially (we're not implementing retry logic in this test)
        with patch.object(processor, '_calculate_file_hash_from_path', return_value="test-hash"):
            with pytest.raises(TherapySessionError):
                await processor.create_session(
                    file_path="c3d-examples/P039/test.c3d",
                    file_metadata={"size": 1024}
                )

    def test_processor_initialization(self):
        """Test processor initializes correctly with dependencies"""
        with patch("services.clinical.therapy_session_processor.get_supabase_client") as mock_client:
            with patch("services.clinical.therapy_session_processor.TherapySessionRepository") as mock_repo:
                processor = TherapySessionProcessor()

                # Verify dependencies are initialized
                mock_client.assert_called_once_with(use_service_key=True)
                mock_repo.assert_called_once()
                assert processor.supabase_client is not None
                assert processor.session_repo is not None

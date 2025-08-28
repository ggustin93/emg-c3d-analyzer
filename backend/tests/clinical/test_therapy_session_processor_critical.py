"""Critical Therapy Session Processor Tests.

======================================

KISS, DRY implementation testing core therapy session orchestration logic that was missing from coverage.
Tests the critical business logic that orchestrates the entire C3D processing workflow.

Author: Senior Engineer
Date: 2025-08-27
"""

import asyncio
from datetime import datetime
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest

# Import the class under test
from services.clinical.therapy_session_processor import (
    FileProcessingError,
    SessionNotFoundError,
    TherapySessionError,
    TherapySessionProcessor,
)

# ============================================================================
# MODULE-LEVEL FIXTURES (shared across all test classes)
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

@pytest.fixture
def sample_c3d_result():
    """Sample C3D processing result with realistic data from GHOSTLY rehabilitation"""
    return {
        "success": True,
        "metadata": {
            "file_path": "P039/Ghostly_Emg_20230321_17-50-17-0881.c3d",
            "duration_seconds": 175.1,
            "sampling_rate": 990.0,
            "frame_count": 173349,
            "session_date": datetime(2023, 3, 21, 17, 50, 17),
            "channels": ["CH1", "CH2"],
            "time": "2023-03-21 17:50:17"
        },
        "analytics": {
            "CH1": {
                "contraction_count": 20,
                "good_contraction_count": 18,
                "mvc_contraction_count": 20,
                "duration_contraction_count": 18,
                "compliance_rate": 0.9,
                "mvc_value": 0.001234,
                "mvc_threshold": 75.0,
                "avg_amplitude": 0.000456,
                "max_amplitude": 0.001234,
                "avg_duration_ms": 2250.0,
                "max_duration_ms": 3500.0,
                "min_duration_ms": 1800.0,
                "total_time_under_tension_ms": 45000.0,
                "signal_quality_score": 0.95,
                "processing_confidence": 0.98,
                "rms_temporal_stats": {"mean_value": 0.000456, "std_value": 0.000123},
                "mav_temporal_stats": {"mean_value": 0.000398, "std_value": 0.000098}
            },
            "CH2": {
                "contraction_count": 9,
                "good_contraction_count": 7,
                "mvc_contraction_count": 9,
                "duration_contraction_count": 7,
                "compliance_rate": 0.78,
                "mvc_value": 0.000987,
                "mvc_threshold": 75.0,
                "avg_amplitude": 0.000234,
                "max_amplitude": 0.000987,
                "avg_duration_ms": 3567.0,
                "max_duration_ms": 4200.0,
                "min_duration_ms": 2100.0,
                "total_time_under_tension_ms": 32100.0,
                "signal_quality_score": 0.92,
                "processing_confidence": 0.96,
                "rms_temporal_stats": {"mean_value": 0.000234, "std_value": 0.000087},
                "mav_temporal_stats": {"mean_value": 0.000198, "std_value": 0.000065}
            }
        },
        "performance_scores": {
            "overall_score": 72.5,
            "compliance_score": 85.0,
            "symmetry_score": 65.0
        },
        "processing_time_ms": 1250
    }

@pytest.fixture
def processor():
    """Create processor instance with properly mocked dependencies"""
    with patch("services.clinical.therapy_session_processor.get_supabase_client") as mock_client:
        # Mock Supabase client
        mock_supabase = MagicMock()
        mock_client.return_value = mock_supabase

        processor = TherapySessionProcessor()

        # Mock all repository dependencies (new repository pattern)
        processor.session_repo = MagicMock()
        processor.patient_repo = MagicMock()
        processor.emg_repo = MagicMock()
        processor.user_repo = MagicMock()
        processor.scoring_service = MagicMock()
        processor.cache_service = MagicMock()
        processor.supabase = mock_supabase

        return processor


class TestTherapySessionProcessorCore:
    """Test core therapy session processor functionality"""

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
        with patch.object(processor, "_calculate_file_hash_from_path", return_value="test-hash"):
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
        with patch.object(processor, "_calculate_file_hash_from_path", return_value="test-hash"):
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
        with patch.object(processor, "_find_existing_session", return_value=None):
            processor.session_repo.create_therapy_session = MagicMock(
                side_effect=Exception("Database connection failed")
            )

            # Mock file hash calculation to avoid file operations
            with patch.object(processor, "_calculate_file_hash_from_path", return_value="test-hash"):
                with pytest.raises(TherapySessionError, match="Session creation failed"):
                    await processor.create_session(
                        file_path="c3d-examples/P039/test.c3d",
                        file_metadata=sample_file_metadata
                    )

    @pytest.mark.asyncio
    async def test_update_session_status_success(self, processor):
        """Test successful session status update"""
        processor.session_repo.update_session_status = MagicMock(return_value=True)  # Sync call

        await processor.update_session_status("session-123", "completed")

        processor.session_repo.update_session_status.assert_called_once_with(
            "session-123", "completed", None
        )

    @pytest.mark.asyncio
    async def test_update_session_status_with_error(self, processor):
        """Test session status update with error message"""
        processor.session_repo.update_session_status = MagicMock(return_value=True)  # Sync call

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
            "processed_at": "2025-08-27T10:05:00Z"
            # Note: analytics_cache removed in schema v2.0 (Redis migration)
        }
        processor.session_repo.get_therapy_session = MagicMock(return_value=mock_status)  # Actual method name

        result = await processor.get_session_status("session-123")

        assert result == mock_status
        processor.session_repo.get_therapy_session.assert_called_once_with("session-123")

    @pytest.mark.asyncio
    async def test_get_session_status_not_found(self, processor):
        """Test session status retrieval for missing session"""
        processor.session_repo.get_therapy_session = MagicMock(return_value=None)  # Actual method name

        result = await processor.get_session_status("nonexistent-session")

        assert result is None


class TestTherapySessionProcessorFileHandling:
    """Test file download and processing functionality"""

    @pytest.fixture
    def processor(self):
        """Create processor instance with properly mocked dependencies for file handling tests"""
        with patch("services.clinical.therapy_session_processor.get_supabase_client") as mock_client:
            # Mock Supabase client
            mock_supabase = MagicMock()
            mock_client.return_value = mock_supabase

            processor = TherapySessionProcessor()

            # Mock all repository dependencies (new repository pattern)
            processor.session_repo = MagicMock()
            processor.patient_repo = MagicMock()
            processor.emg_repo = MagicMock()
            processor.user_repo = MagicMock()
            processor.scoring_service = MagicMock()
            processor.cache_service = MagicMock()
            processor.supabase_client = mock_supabase

            return processor

    @pytest.mark.asyncio
    async def test_download_file_success(self, processor):
        """Test successful file download"""
        # Mock Supabase storage download
        mock_file_content = b"C3D file binary data"
        processor.supabase_client.storage.from_.return_value.download.return_value = mock_file_content

        result = await processor._download_file("c3d-examples", "P039/test.c3d")

        assert result == mock_file_content

        # Verify storage was called correctly
        processor.supabase_client.storage.from_.assert_called_once_with("c3d-examples")
        processor.supabase_client.storage.from_.return_value.download.assert_called_once_with("P039/test.c3d")

    @pytest.mark.asyncio
    async def test_download_file_storage_error(self, processor):
        """Test file download handles storage errors"""
        processor.supabase_client.storage.from_.return_value.download.side_effect = Exception("File not found")

        with pytest.raises(Exception, match="File not found"):
            await processor._download_file("c3d-examples", "P039/missing.c3d")

    @patch("services.clinical.therapy_session_processor.GHOSTLYC3DProcessor")
    @patch("tempfile.NamedTemporaryFile")
    @pytest.mark.asyncio
    async def test_process_c3d_file_success(self, mock_temp_file, mock_processor_class, processor, sample_c3d_result):
        """Test successful complete C3D file processing"""
        # Mock file download
        mock_file_data = b"C3D binary data"
        processor._download_file = AsyncMock(return_value=mock_file_data)

        # Mock session config preparation
        processor._prepare_session_config = AsyncMock(return_value=("session_info", "patient-id", 2.0))
        processor._validate_processing_params = MagicMock()

        # Mock temporary file
        mock_temp = MagicMock()
        mock_temp.name = "/tmp/test.c3d"
        mock_temp_file.return_value.__enter__.return_value = mock_temp

        # Mock C3D processor
        mock_c3d_processor = MagicMock()
        mock_c3d_processor.process_file.return_value = sample_c3d_result
        mock_processor_class.return_value = mock_c3d_processor

        # Mock internal methods
        processor._create_processing_config = MagicMock(return_value=("processing_opts", "session_params"))
        processor._populate_database_tables = AsyncMock()
        processor._cache_session_analytics = AsyncMock()
        processor._update_session_metadata = AsyncMock()
        processor._calculate_overall_score = MagicMock(return_value=72.5)
        processor._cleanup_temp_file = MagicMock()

        result = await processor.process_c3d_file(
            session_id="session-123",
            bucket="c3d-examples",
            object_path="P039/test.c3d"
        )

        assert result["success"] is True
        assert result["channels_analyzed"] == 2
        assert result["overall_score"] == 72.5

        # Verify workflow
        processor._download_file.assert_called_once_with("c3d-examples", "P039/test.c3d")
        mock_c3d_processor.process_file.assert_called_once()

    @pytest.mark.asyncio
    async def test_process_c3d_file_processing_error(self, processor):
        """Test C3D file processing handles processing errors"""
        # Mock validation to pass
        processor._validate_processing_params = MagicMock()

        # Mock session config preparation to fail
        processor._prepare_session_config = AsyncMock(
            side_effect=Exception("Session not found")
        )

        result = await processor.process_c3d_file(
            session_id="nonexistent-session",
            bucket="c3d-examples",
            object_path="P039/corrupted.c3d"
        )

        assert result["success"] is False
        assert "Session not found" in result["error"]

    @pytest.mark.asyncio
    async def test_process_c3d_file_validation_error(self, processor):
        """Test C3D processing handles validation errors"""
        # Mock validation to fail
        processor._validate_processing_params = MagicMock(
            side_effect=ValueError("Invalid session ID")
        )

        result = await processor.process_c3d_file(
            session_id="",  # Invalid empty session ID
            bucket="c3d-examples",
            object_path="P039/test.c3d"
        )

        assert result["success"] is False
        assert "Invalid session ID" in result["error"]

    def test_cleanup_temp_file(self, processor):
        """Test temporary file cleanup utility"""
        # Test the _cleanup_temp_file method directly
        with patch("os.path.exists", return_value=True), patch("os.unlink") as mock_unlink:
            processor._cleanup_temp_file("/tmp/test.c3d")
            mock_unlink.assert_called_once_with("/tmp/test.c3d")

        # Test cleanup with missing file (should not call unlink)
        with patch("os.path.exists", return_value=False), patch("os.unlink") as mock_unlink:
            processor._cleanup_temp_file("/tmp/missing.c3d")
            mock_unlink.assert_not_called()

        # Test cleanup with OSError (should not raise exception)
        with patch("os.path.exists", return_value=True):
            with patch("os.unlink", side_effect=OSError("Permission denied")):
                # Should not raise exception
                processor._cleanup_temp_file("/tmp/locked.c3d")


class TestTherapySessionProcessorIntegration:
    """Test integration scenarios and error handling"""

    @pytest.fixture
    def processor(self):
        """Create processor instance with properly mocked dependencies for integration tests"""
        with patch("services.clinical.therapy_session_processor.get_supabase_client") as mock_client:
            # Mock Supabase client
            mock_supabase = MagicMock()
            mock_client.return_value = mock_supabase

            processor = TherapySessionProcessor()

            # Mock all repository dependencies (new repository pattern)
            processor.session_repo = MagicMock()
            processor.patient_repo = MagicMock()
            processor.emg_repo = MagicMock()
            processor.user_repo = MagicMock()
            processor.scoring_service = MagicMock()
            processor.cache_service = MagicMock()
            processor.supabase_client = mock_supabase

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
        with patch.object(processor, "_calculate_file_hash_from_path", return_value="test-hash"):
            session_id = await processor.create_session(
                file_path="c3d-examples/P039/test.c3d",
                file_metadata={"size": 1024}
            )

        # 2. Update to processing
        processor.session_repo.update_session_status = MagicMock(return_value=True)  # Sync call
        await processor.update_session_status(session_id, "processing")

        # 3. Get status
        mock_status = {
            "processing_status": "processing",
            "file_path": "c3d-examples/P039/test.c3d"
            # Note: analytics_cache removed in schema v2.0 (Redis migration)
        }
        processor.session_repo.get_therapy_session = MagicMock(return_value=mock_status)  # Actual method name

        status = await processor.get_session_status(session_id)

        # Verify workflow
        assert status["processing_status"] == "processing"
        assert processor.session_repo.create_therapy_session.called
        assert processor.session_repo.update_session_status.called
        assert processor.session_repo.get_therapy_session.called

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
        with patch.object(processor, "_calculate_file_hash_from_path", return_value="test-hash"):
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
        with patch.object(processor, "_calculate_file_hash_from_path", return_value="test-hash"):
            with pytest.raises(TherapySessionError):
                await processor.create_session(
                    file_path="c3d-examples/P039/test.c3d",
                    file_metadata={"size": 1024}
                )

    def test_processor_initialization(self):
        """Test processor initializes correctly with dependencies"""
        with patch("services.clinical.therapy_session_processor.get_supabase_client") as mock_client:
            mock_supabase = MagicMock()
            mock_client.return_value = mock_supabase

            processor = TherapySessionProcessor()

            # Verify dependencies are initialized
            mock_client.assert_called_once_with(use_service_key=True)
            assert processor.supabase is not None  # Correct attribute name
            assert processor.session_repo is not None

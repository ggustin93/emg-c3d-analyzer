"""Critical Webhook System Tests.

============================

KISS, DRY implementation testing core webhook business logic that was missing from coverage.
Tests the critical path: Supabase Storage webhook -> Session creation -> Background processing

Author: Senior Engineer
Date: 2025-08-27
"""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from api.main import app
from api.routes.webhooks import SupabaseStorageEvent


class TestWebhookSystemCritical:
    """Test critical webhook functionality that was missing coverage."""

    @pytest.fixture
    def client(self):
        return TestClient(app)

    @pytest.fixture
    def valid_c3d_webhook_payload(self):
        """Real Supabase Storage webhook payload for C3D upload."""
        return {
            "type": "INSERT",
            "table": "objects",
            "schema": "storage",
            "record": {
                "id": "12345678-1234-5678-9012-123456789012",
                "name": "P039/Ghostly_Emg_20230321_17-50-17-0881.c3d",
                "bucket_id": "c3d-examples",
                "owner": "user123",
                "created_at": "2025-08-27T10:00:00Z",
                "updated_at": "2025-08-27T10:00:00Z",
                "last_accessed_at": None,
                "metadata": {
                    "size": 2874924,
                    "mimetype": "application/octet-stream",
                    "cacheControl": "max-age=3600",
                },
            },
        }

    @pytest.fixture
    def invalid_webhook_payload(self):
        """Non-C3D file payload that should be ignored."""
        return {
            "type": "INSERT",
            "table": "objects",
            "schema": "storage",
            "record": {
                "name": "some-document.pdf",
                "bucket_id": "documents",
                "metadata": {"size": 1024},
            },
        }

    def test_supabase_storage_event_model(self):
        """Test SupabaseStorageEvent model parsing and properties."""
        payload = {
            "type": "INSERT",
            "table": "objects",
            "schema": "storage",
            "record": {
                "name": "P042/test_file.c3d",
                "bucket_id": "c3d-examples",
                "metadata": {"size": 1024},
            },
        }

        event = SupabaseStorageEvent(**payload)

        assert event.type == "INSERT"
        assert event.table == "objects"
        assert event.object_name == "P042/test_file.c3d"
        assert event.bucket_id == "c3d-examples"
        assert event.patient_code == "P042"
        assert event.is_c3d_upload is True

    def test_patient_code_extraction(self):
        """Test patient code extraction from various file paths."""
        test_cases = [
            ("P039/file.c3d", "P039"),
            ("P123/subfolder/file.c3d", "P123"),
            ("no_patient/file.c3d", None),
            ("file.c3d", None),
            ("", None),
        ]

        for file_path, expected_code in test_cases:
            payload = {
                "type": "INSERT",
                "table": "objects",
                "schema": "storage",
                "record": {"name": file_path, "bucket_id": "c3d-examples"},
            }
            event = SupabaseStorageEvent(**payload)
            assert event.patient_code == expected_code

    def test_webhook_ignores_non_c3d_files(self, client, invalid_webhook_payload):
        """Test webhook correctly ignores non-C3D files."""
        response = client.post(
            "/webhooks/storage/c3d-upload",
            json=invalid_webhook_payload,
            headers={"Content-Type": "application/json"},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert "Ignored" in data["message"]
        assert data["session_id"] is None

    @patch("api.routes.webhooks.session_processor")
    @patch("api.routes.webhooks.PatientRepository")
    def test_webhook_c3d_processing_success(
        self, mock_patient_repo, mock_processor, client, valid_c3d_webhook_payload
    ):
        """Test successful C3D webhook processing workflow."""
        # Mock patient lookup
        mock_patient_instance = MagicMock()
        mock_patient_instance.get_patient_by_code.return_value = {"id": "patient-uuid-123"}
        mock_patient_repo.return_value = mock_patient_instance

        # Mock session processor with async methods
        test_session_id = "session-uuid-456"
        mock_processor.create_session = AsyncMock(return_value=test_session_id)
        mock_processor.update_session_status = AsyncMock()
        mock_processor.process_c3d_file = AsyncMock()

        response = client.post(
            "/webhooks/storage/c3d-upload",
            json=valid_c3d_webhook_payload,
            headers={"Content-Type": "application/json"},
        )

        assert response.status_code == 200
        data = response.json()

        # Verify response
        assert data["success"] is True
        assert data["session_id"] == test_session_id
        assert "processing initiated" in data["message"]
        assert data["processing_time_ms"] is not None

        # Verify patient lookup was called
        mock_patient_instance.get_patient_by_code.assert_called_once_with("P039")

        # Verify session creation was called with correct parameters
        mock_processor.create_session.assert_called_once()
        call_args = mock_processor.create_session.call_args
        assert (
            call_args.kwargs["file_path"]
            == "c3d-examples/P039/Ghostly_Emg_20230321_17-50-17-0881.c3d"
        )
        assert call_args.kwargs["patient_id"] == "patient-uuid-123"
        assert call_args.kwargs["file_metadata"]["size"] == 2874924

    @patch("api.routes.webhooks.session_processor")
    def test_webhook_patient_not_found(self, mock_processor, client, valid_c3d_webhook_payload):
        """Test webhook handles missing patient gracefully."""
        # Mock session processor with async methods
        test_session_id = "session-uuid-no-patient"
        mock_processor.create_session = AsyncMock(return_value=test_session_id)
        mock_processor.update_session_status = AsyncMock()
        mock_processor.process_c3d_file = AsyncMock()

        with patch("api.routes.webhooks.PatientRepository") as mock_repo_class:
            mock_repo = MagicMock()
            mock_repo.get_patient_by_code.return_value = None  # Patient not found
            mock_repo_class.return_value = mock_repo

            response = client.post(
                "/webhooks/storage/c3d-upload",
                json=valid_c3d_webhook_payload,
                headers={"Content-Type": "application/json"},
            )

            assert response.status_code == 200
            data = response.json()
            assert data["success"] is True

            # Verify session created without patient_id
            mock_processor.create_session.assert_called_once()
            call_args = mock_processor.create_session.call_args
            assert call_args.kwargs["patient_id"] is None

    def test_webhook_invalid_json(self, client):
        """Test webhook handles invalid JSON payload."""
        response = client.post(
            "/webhooks/storage/c3d-upload",
            data="invalid json{",
            headers={"Content-Type": "application/json"},
        )

        assert response.status_code == 400
        assert "Invalid JSON payload" in response.json()["message"]

    @patch("api.routes.webhooks.session_processor")
    def test_webhook_session_creation_failure(
        self, mock_processor, client, valid_c3d_webhook_payload
    ):
        """Test webhook handles session creation errors."""
        # Mock session processor to raise an exception
        mock_processor.create_session = AsyncMock(
            side_effect=Exception("Database connection failed")
        )
        mock_processor.update_session_status = AsyncMock()
        mock_processor.process_c3d_file = AsyncMock()

        response = client.post(
            "/webhooks/storage/c3d-upload",
            json=valid_c3d_webhook_payload,
            headers={"Content-Type": "application/json"},
        )

        assert response.status_code == 500
        assert "Processing error" in response.json()["message"]

    @patch("api.routes.webhooks.session_processor")
    def test_webhook_status_endpoint_success(self, mock_processor, client):
        """Test webhook status endpoint returns session information."""
        session_id = "test-session-123"
        mock_status = {
            "processing_status": "completed",
            "file_path": "c3d-examples/P039/test.c3d",
            "created_at": "2025-08-27T10:00:00Z",
            "processed_at": "2025-08-27T10:05:00Z",
            "analytics_cache": {"channels_analyzed": 2},
        }
        mock_processor.get_session_status = AsyncMock(return_value=mock_status)

        response = client.get(f"/webhooks/storage/status/{session_id}")

        assert response.status_code == 200
        data = response.json()
        assert data["session_id"] == session_id
        assert data["status"] == "completed"
        assert data["has_analysis"] is True

    @patch("api.routes.webhooks.session_processor")
    def test_webhook_status_endpoint_not_found(self, mock_processor, client):
        """Test webhook status endpoint handles missing sessions."""
        mock_processor.get_session_status = AsyncMock(return_value=None)
        mock_processor.update_session_status = AsyncMock()
        mock_processor.process_c3d_file = AsyncMock()

        response = client.get("/webhooks/storage/status/nonexistent-session")

        assert response.status_code == 404
        assert "Session not found" in response.json()["message"]

    def test_webhook_health_endpoint(self, client):
        """Test webhook health check endpoint."""
        response = client.get("/webhooks/health")

        assert response.status_code == 200
        data = response.json()
        assert data["service"] == "C3D Webhook Processing"
        assert data["status"] == "healthy"
        assert "therapy_sessions" in data["database_tables"]
        assert "background_processing" in data["features"]


class TestWebhookSecurity:
    """Test webhook security features."""

    @pytest.fixture
    def client(self):
        return TestClient(app)

    @pytest.fixture
    def valid_payload(self):
        return {
            "type": "INSERT",
            "table": "objects",
            "schema": "storage",
            "record": {"name": "test.c3d", "bucket_id": "c3d-examples"},
        }

    @patch("api.routes.webhooks.session_processor")
    @patch("api.routes.webhooks.settings")
    def test_webhook_signature_verification_disabled(
        self, mock_settings, mock_processor, client, valid_payload
    ):
        """Test webhook works when signature verification is disabled."""
        mock_settings.WEBHOOK_SECRET = ""  # Disabled
        mock_processor.create_session = AsyncMock(return_value="session-123")
        mock_processor.update_session_status = AsyncMock()
        mock_processor.process_c3d_file = AsyncMock()

        response = client.post(
            "/webhooks/storage/c3d-upload",
            json=valid_payload,
            headers={"Content-Type": "application/json"},
        )

        # Should succeed without signature
        assert response.status_code == 200

    @patch("api.routes.webhooks.session_processor")
    @patch("api.routes.webhooks.webhook_security")
    @patch("api.routes.webhooks.settings")
    def test_webhook_signature_verification_success(
        self, mock_settings, mock_security, mock_processor, client, valid_payload
    ):
        """Test webhook succeeds with valid signature."""
        mock_settings.WEBHOOK_SECRET = "test-secret-key"
        mock_security.verify_signature.return_value = True
        mock_processor.create_session = AsyncMock(return_value="session-123")
        mock_processor.update_session_status = AsyncMock()
        mock_processor.process_c3d_file = AsyncMock()

        response = client.post(
            "/webhooks/storage/c3d-upload",
            json=valid_payload,
            headers={"Content-Type": "application/json", "x-supabase-signature": "valid-signature"},
        )

        assert response.status_code == 200

    @patch("api.routes.webhooks.session_processor")
    @patch("api.routes.webhooks.webhook_security")
    @patch("api.routes.webhooks.settings")
    def test_webhook_signature_verification_failure(
        self, mock_settings, mock_security, mock_processor, client, valid_payload
    ):
        """Test webhook rejects invalid signature."""
        mock_settings.WEBHOOK_SECRET = "test-secret-key"
        mock_security.verify_signature.return_value = False
        mock_processor.create_session = AsyncMock(return_value="session-123")
        mock_processor.update_session_status = AsyncMock()
        mock_processor.process_c3d_file = AsyncMock()

        response = client.post(
            "/webhooks/storage/c3d-upload",
            json=valid_payload,
            headers={
                "Content-Type": "application/json",
                "x-supabase-signature": "invalid-signature",
            },
        )

        assert response.status_code == 401
        assert "Invalid signature" in response.json()["message"]


class TestBackgroundProcessing:
    """Test background processing functionality."""

    @patch("api.routes.webhooks.session_processor")
    @pytest.mark.asyncio
    async def test_background_processing_success(self, mock_processor):
        """Test successful background C3D processing."""
        from api.routes.webhooks import _process_c3d_background

        # Mock successful processing
        mock_processor.update_session_status = AsyncMock()
        mock_processor.process_c3d_file = AsyncMock(
            return_value={"success": True, "channels_analyzed": 2, "overall_score": 85.5}
        )

        await _process_c3d_background(
            session_id="test-session", bucket="c3d-examples", object_path="P039/test.c3d"
        )

        # Verify processing workflow
        assert mock_processor.update_session_status.call_count == 2

        # Check status updates
        calls = mock_processor.update_session_status.call_args_list
        assert calls[0][0] == ("test-session", "processing")
        assert calls[1][0] == ("test-session", "completed")

        # Verify file processing called
        mock_processor.process_c3d_file.assert_called_once_with(
            session_id="test-session", bucket="c3d-examples", object_path="P039/test.c3d"
        )

    @patch("api.routes.webhooks.session_processor")
    @pytest.mark.asyncio
    async def test_background_processing_failure(self, mock_processor):
        """Test background processing handles errors correctly."""
        from api.routes.webhooks import _process_c3d_background

        # Mock processing failure
        mock_processor.update_session_status = AsyncMock()
        mock_processor.process_c3d_file = AsyncMock(
            return_value={"success": False, "error": "C3D file corrupted"}
        )

        await _process_c3d_background(
            session_id="failed-session", bucket="c3d-examples", object_path="P039/corrupted.c3d"
        )

        # Verify error handling workflow
        assert mock_processor.update_session_status.call_count == 2

        calls = mock_processor.update_session_status.call_args_list
        assert calls[0][0] == ("failed-session", "processing")
        assert calls[1][0] == ("failed-session", "failed")
        assert calls[1][1]["error_message"] == "C3D file corrupted"

    @patch("api.routes.webhooks.session_processor")
    @pytest.mark.asyncio
    async def test_background_processing_exception(self, mock_processor):
        """Test background processing handles exceptions."""
        from api.routes.webhooks import _process_c3d_background

        # Mock exception during processing
        mock_processor.update_session_status = AsyncMock()
        mock_processor.process_c3d_file = AsyncMock(side_effect=Exception("Database timeout"))

        await _process_c3d_background(
            session_id="exception-session", bucket="c3d-examples", object_path="P039/test.c3d"
        )

        # Verify exception handling
        calls = mock_processor.update_session_status.call_args_list
        assert calls[-1][0] == ("exception-session", "failed")
        assert "Database timeout" in calls[-1][1]["error_message"]

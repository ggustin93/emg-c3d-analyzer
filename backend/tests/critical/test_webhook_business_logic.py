"""
CRITICAL Business Logic Tests - KISS Implementation
==================================================

Senior engineer approach: Focus on core business logic that was missing test coverage.
Tests the critical webhook + therapy session orchestration without complex mocking.

Author: Senior Engineer
Date: 2025-08-27
"""

import json
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi.testclient import TestClient

# Import what we're testing
from api.main import app
from api.routes.webhooks import SupabaseStorageEvent


class TestCriticalWebhookLogic:
    """Test the critical webhook business logic that was missing coverage"""

    def test_supabase_event_parsing_and_validation(self):
        """Test core business logic: Supabase event parsing and C3D detection"""

        # Test 1: Valid C3D upload should be detected
        valid_c3d_payload = {
            "type": "INSERT",
            "table": "objects",
            "schema": "storage",
            "record": {
                "name": "P039/Ghostly_Emg_20230321.c3d",
                "bucket_id": "c3d-examples",
                "metadata": {"size": 1024}
            }
        }

        event = SupabaseStorageEvent(**valid_c3d_payload)
        assert event.is_c3d_upload is True
        assert event.patient_code == "P039"
        assert event.object_name == "P039/Ghostly_Emg_20230321.c3d"

        # Test 2: Non-C3D files should be ignored
        non_c3d_payload = {
            "type": "INSERT",
            "table": "objects",
            "schema": "storage",
            "record": {
                "name": "document.pdf",
                "bucket_id": "documents",
                "metadata": {"size": 1024}
            }
        }

        event = SupabaseStorageEvent(**non_c3d_payload)
        assert event.is_c3d_upload is False

        # Test 3: Wrong bucket should be ignored
        wrong_bucket_payload = {
            "type": "INSERT",
            "table": "objects",
            "schema": "storage",
            "record": {
                "name": "test.c3d",
                "bucket_id": "wrong-bucket",
                "metadata": {"size": 1024}
            }
        }

        event = SupabaseStorageEvent(**wrong_bucket_payload)
        assert event.is_c3d_upload is False

    def test_patient_code_extraction_business_logic(self):
        """Test patient code extraction from file paths - critical for clinical workflows"""

        test_cases = [
            # Standard patient codes
            ("P039/file.c3d", "P039"),
            ("P123/session_data/file.c3d", "P123"),
            ("P001/nested/deep/file.c3d", "P001"),

            # Edge cases that should return None
            ("file.c3d", None),  # No folder structure
            ("data/file.c3d", None),  # Doesn't start with P
            ("", None),  # Empty path
            ("P/file.c3d", "P"),  # Just P without number (but still valid patient code)
        ]

        for file_path, expected_code in test_cases:
            payload = {
                "type": "INSERT",
                "table": "objects",
                "schema": "storage",
                "record": {"name": file_path, "bucket_id": "c3d-examples"}
            }
            event = SupabaseStorageEvent(**payload)
            assert event.patient_code == expected_code, f"Failed for {file_path}"

    @patch("api.routes.webhooks.session_processor")
    def test_webhook_endpoint_critical_path_success(self, mock_processor):
        """Test the critical success path of webhook processing"""

        # Setup mocks for the critical path
        mock_processor.create_session = AsyncMock(return_value="session-123")
        mock_processor.update_session_status = AsyncMock()
        mock_processor.process_c3d_file = AsyncMock()

        client = TestClient(app)

        # Test the critical success path
        valid_payload = {
            "type": "INSERT",
            "table": "objects",
            "schema": "storage",
            "record": {
                "name": "P039/test.c3d",
                "bucket_id": "c3d-examples",
                "metadata": {"size": 2874924}
            }
        }

        response = client.post(
            "/webhooks/storage/c3d-upload",
            json=valid_payload,
            headers={"Content-Type": "application/json"}
        )

        # Verify critical business logic
        assert response.status_code == 200
        data = response.json()

        assert data["success"] is True
        assert data["session_id"] == "session-123"
        assert "processing initiated" in data["message"]
        assert data["processing_time_ms"] is not None

        # Verify session creation was called
        mock_processor.create_session.assert_called_once()
        call_kwargs = mock_processor.create_session.call_args.kwargs
        assert "c3d-examples/P039/test.c3d" in call_kwargs["file_path"]
        assert call_kwargs["file_metadata"]["size"] == 2874924

    @patch("api.routes.webhooks.session_processor")
    def test_webhook_endpoint_ignores_non_c3d(self, mock_processor):
        """Test webhook correctly ignores non-C3D files (critical filtering logic)"""

        client = TestClient(app)

        # Test non-C3D file is ignored
        non_c3d_payload = {
            "type": "INSERT",
            "table": "objects",
            "schema": "storage",
            "record": {
                "name": "document.pdf",
                "bucket_id": "documents",
                "metadata": {"size": 1024}
            }
        }

        response = client.post(
            "/webhooks/storage/c3d-upload",
            json=non_c3d_payload,
            headers={"Content-Type": "application/json"}
        )

        assert response.status_code == 200
        data = response.json()

        # Critical: Should be successful but ignored
        assert data["success"] is True
        assert "Ignored" in data["message"]
        assert data["session_id"] is None

        # Critical: Should NOT create session for non-C3D files
        mock_processor.create_session.assert_not_called()

    @patch("api.routes.webhooks.session_processor")
    @patch("api.routes.webhooks.PatientRepository")
    def test_webhook_error_handling(self, mock_patient_repo, mock_processor):
        """Test critical error handling in webhook processing"""

        # Mock patient lookup (required for error path)
        mock_patient_instance = MagicMock()
        mock_patient_instance.get_patient_by_code.return_value = {"id": "patient-123"}
        mock_patient_repo.return_value = mock_patient_instance

        # Mock session processor failure
        mock_processor.create_session = AsyncMock(side_effect=Exception("Database connection failed"))
        mock_processor.update_session_status = AsyncMock()
        mock_processor.process_c3d_file = AsyncMock()

        client = TestClient(app)

        valid_payload = {
            "type": "INSERT",
            "table": "objects",
            "schema": "storage",
            "record": {
                "name": "P039/test.c3d",
                "bucket_id": "c3d-examples",
                "metadata": {"size": 1024}
            }
        }

        response = client.post(
            "/webhooks/storage/c3d-upload",
            json=valid_payload,
            headers={"Content-Type": "application/json"}
        )

        # Critical: Should return 500 error when session creation fails
        assert response.status_code == 500
        error_response = response.json()
        # Handle different error formats
        if "detail" in error_response:
            assert "Processing error" in error_response["detail"]
        else:
            assert "Database connection failed" in str(error_response)

    def test_webhook_invalid_json_handling(self):
        """Test webhook handles invalid JSON (basic error handling)"""

        client = TestClient(app)

        response = client.post(
            "/webhooks/storage/c3d-upload",
            content=b"invalid json{",  # Invalid JSON as bytes
            headers={"Content-Type": "application/json"}
        )

        assert response.status_code == 400
        error_response = response.json()
        # Handle different error formats
        if "detail" in error_response:
            assert "Invalid JSON payload" in error_response["detail"]
        else:
            assert "JSON" in str(error_response)

    @patch("api.routes.webhooks.session_processor")
    def test_webhook_status_endpoint_basic(self, mock_processor):
        """Test status endpoint basic functionality"""

        # Mock successful status retrieval
        mock_status = {
            "processing_status": "completed",
            "file_path": "c3d-examples/P039/test.c3d",
            "created_at": "2025-08-27T10:00:00Z",
            "analytics_cache": {"channels_analyzed": 2}
        }
        mock_processor.get_session_status = AsyncMock(return_value=mock_status)

        client = TestClient(app)

        response = client.get("/webhooks/storage/status/test-session-123")

        assert response.status_code == 200
        data = response.json()

        assert data["session_id"] == "test-session-123"
        assert data["status"] == "completed"
        assert data["has_analysis"] is True

    def test_webhook_health_endpoint(self):
        """Test webhook health endpoint (basic functionality check)"""

        client = TestClient(app)

        response = client.get("/webhooks/health")

        assert response.status_code == 200
        data = response.json()

        assert data["service"] == "C3D Webhook Processing"
        assert data["status"] == "healthy"
        assert "therapy_sessions" in data["database_tables"]
        assert "background_processing" in data["features"]


class TestCriticalBackgroundProcessing:
    """Test critical background processing logic"""

    @patch("api.routes.webhooks.session_processor")
    @pytest.mark.asyncio
    async def test_background_processing_success_path(self, mock_processor):
        """Test successful background processing workflow"""

        from api.routes.webhooks import _process_c3d_background

        # Mock successful processing workflow
        mock_processor.update_session_status = AsyncMock()
        mock_processor.process_c3d_file = AsyncMock(return_value={
            "success": True,
            "channels_analyzed": 2,
            "overall_score": 72.5
        })

        # Execute background processing
        await _process_c3d_background(
            session_id="test-session-123",
            bucket="c3d-examples",
            object_path="P039/test.c3d"
        )

        # Verify critical workflow steps
        assert mock_processor.update_session_status.call_count == 2

        # Check status progression: processing -> completed
        calls = mock_processor.update_session_status.call_args_list
        assert calls[0][0] == ("test-session-123", "processing")
        assert calls[1][0] == ("test-session-123", "completed")

        # Verify file processing was called
        mock_processor.process_c3d_file.assert_called_once_with(
            session_id="test-session-123",
            bucket="c3d-examples",
            object_path="P039/test.c3d"
        )

    @patch("api.routes.webhooks.session_processor")
    @pytest.mark.asyncio
    async def test_background_processing_failure_handling(self, mock_processor):
        """Test background processing handles failures correctly"""

        from api.routes.webhooks import _process_c3d_background

        # Mock processing failure
        mock_processor.update_session_status = AsyncMock()
        mock_processor.process_c3d_file = AsyncMock(return_value={
            "success": False,
            "error": "C3D file corrupted"
        })

        # Execute background processing
        await _process_c3d_background(
            session_id="failed-session-123",
            bucket="c3d-examples",
            object_path="P039/corrupted.c3d"
        )

        # Verify error handling workflow
        assert mock_processor.update_session_status.call_count == 2

        calls = mock_processor.update_session_status.call_args_list
        assert calls[0][0] == ("failed-session-123", "processing")
        assert calls[1][0] == ("failed-session-123", "failed")
        assert calls[1][1]["error_message"] == "C3D file corrupted"


class TestCriticalBusinessRules:
    """Test critical business rules and edge cases"""

    def test_c3d_file_validation_rules(self):
        """Test C3D file validation business rules"""

        # Rule 1: Only .c3d files should be processed
        c3d_extensions = [".c3d", ".C3D"]  # Case insensitive
        non_c3d_extensions = [".txt", ".pdf", ".json", ".zip", ""]

        for ext in c3d_extensions:
            payload = {
                "type": "INSERT",
                "table": "objects",
                "schema": "storage",
                "record": {
                    "name": f"P039/test{ext}",
                    "bucket_id": "c3d-examples"
                }
            }
            event = SupabaseStorageEvent(**payload)
            assert event.is_c3d_upload is True, f"Should accept {ext} files"

        for ext in non_c3d_extensions:
            payload = {
                "type": "INSERT",
                "table": "objects",
                "schema": "storage",
                "record": {
                    "name": f"P039/test{ext}",
                    "bucket_id": "c3d-examples"
                }
            }
            event = SupabaseStorageEvent(**payload)
            assert event.is_c3d_upload is False, f"Should reject {ext} files"

    def test_bucket_validation_rules(self):
        """Test bucket validation business rules"""

        # Rule 2: Only 'c3d-examples' bucket should be processed
        valid_buckets = ["c3d-examples"]
        invalid_buckets = ["documents", "images", "backups", ""]

        for bucket in valid_buckets:
            payload = {
                "type": "INSERT",
                "table": "objects",
                "schema": "storage",
                "record": {
                    "name": "P039/test.c3d",
                    "bucket_id": bucket
                }
            }
            event = SupabaseStorageEvent(**payload)
            assert event.is_c3d_upload is True, f"Should accept {bucket} bucket"

        for bucket in invalid_buckets:
            payload = {
                "type": "INSERT",
                "table": "objects",
                "schema": "storage",
                "record": {
                    "name": "P039/test.c3d",
                    "bucket_id": bucket
                }
            }
            event = SupabaseStorageEvent(**payload)
            assert event.is_c3d_upload is False, f"Should reject {bucket} bucket"

    def test_event_type_validation_rules(self):
        """Test event type validation business rules"""

        # Rule 3: Only INSERT events should be processed
        valid_events = ["INSERT"]
        invalid_events = ["UPDATE", "DELETE", ""]

        for event_type in valid_events:
            payload = {
                "type": event_type,
                "table": "objects",
                "schema": "storage",
                "record": {
                    "name": "P039/test.c3d",
                    "bucket_id": "c3d-examples"
                }
            }
            event = SupabaseStorageEvent(**payload)
            assert event.is_c3d_upload is True, f"Should accept {event_type} events"

        for event_type in invalid_events:
            payload = {
                "type": event_type,
                "table": "objects",
                "schema": "storage",
                "record": {
                    "name": "P039/test.c3d",
                    "bucket_id": "c3d-examples"
                }
            }
            event = SupabaseStorageEvent(**payload)
            assert event.is_c3d_upload is False, f"Should reject {event_type} events"


# Summary: These tests cover the critical business logic that was missing:
# 1. Supabase event parsing and C3D file detection
# 2. Patient code extraction from file paths
# 3. Webhook endpoint success/failure paths
# 4. File filtering and validation rules
# 5. Background processing workflow
# 6. Error handling and edge cases
# 7. Business rules validation (file types, buckets, event types)
#
# This provides the senior engineer-level KISS testing approach focusing on
# critical business logic without over-complex mocking infrastructure.
